//! Serialized release registry and bounded Team-only cleanup. No personal fact deletion.
use crate::{infrastructure::postgres::PostgresClient, services::team_trust::safe_views};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    sync::Arc,
};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RegistryEntry {
    pub generation: i64,
    pub retention_before: Option<DateTime<Utc>>,
    pub weeks: Vec<NaiveDate>,
    pub access_hash: String,
    #[serde(default)]
    pub publication_marks: BTreeMap<NaiveDate, BTreeSet<String>>,
    #[serde(default)]
    pub invalidated_weeks: BTreeSet<NaiveDate>,
    #[serde(default)]
    pub deleted: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Disposition {
    pub provider: String,
    pub delivery_id: String,
    pub payload_hash: String,
    pub reason: String,
    pub disposed_at: DateTime<Utc>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct Registry {
    pub schema_version: u8,
    pub checked_at: DateTime<Utc>,
    pub organizations: BTreeMap<Uuid, RegistryEntry>,
    #[serde(default)]
    pub dispositions: Vec<Disposition>,
}
fn covers_history(current: &RegistryEntry, old: &RegistryEntry) -> bool {
    old.weeks.iter().all(|week| current.weeks.contains(week))
        && old.invalidated_weeks.is_subset(&current.invalidated_weeks)
        && old.publication_marks.iter().all(|(week, marks)| {
            current.invalidated_weeks.contains(week)
                || current.publication_marks.get(week).is_some_and(|live| marks.is_subset(live))
        })
        // An older ledger with only a week list cannot establish which views were released.
        && old.weeks.iter().all(|week| old.publication_marks.contains_key(week)
            || old.invalidated_weeks.contains(week) || current.invalidated_weeks.contains(week))
}
pub struct TeamTrustRepository {
    pub postgres: Arc<PostgresClient>,
}
impl TeamTrustRepository {
    pub fn new(postgres: Arc<PostgresClient>) -> Self {
        Self { postgres }
    }
    pub async fn policy(&self, org: Uuid) -> Result<String> {
        self.postgres.execute("INSERT INTO team_report_policies(organization_id) VALUES($1) ON CONFLICT DO NOTHING", &[&org]).await?;
        Ok(self
            .postgres
            .query_one(
                "SELECT timezone FROM team_report_policies WHERE organization_id=$1",
                &[&org],
            )
            .await?
            .get(0))
    }
    pub async fn registry_entry(&self, org: Uuid) -> Result<RegistryEntry> {
        let row=self.postgres.query_one("SELECT r.generation,m.retention_before FROM team_rollouts r LEFT JOIN team_privacy_markers m USING(organization_id) WHERE r.organization_id=$1", &[&org]).await?;
        let access=self.postgres.query_one("SELECT jsonb_build_object('consents',COALESCE((SELECT jsonb_agg(jsonb_build_object('user',c.user_id,'version',c.consent_version,'aggregate',c.share_aggregate,'individual',c.share_individual,'aggregate_from',c.aggregate_from,'individual_from',c.individual_from) ORDER BY c.user_id) FROM organization_analytics_consents c WHERE c.organization_id=$1),'[]'::jsonb), 'members',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.user_id) FROM organization_members m WHERE m.organization_id=$1),'[]'::jsonb), 'scopes',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.repository_id) FROM team_repository_scopes s WHERE s.organization_id=$1),'[]'::jsonb))", &[&org]).await?.get::<_,serde_json::Value>(0);
        let weeks=self.postgres.query("SELECT DISTINCT week_start FROM team_weekly_publications WHERE organization_id=$1 ORDER BY week_start", &[&org]).await?.iter().map(|r|r.get(0)).collect();
        let rows=self.postgres.query("SELECT week_start,view_key,generation,fingerprint,contributors,invalidated_at FROM team_weekly_publications WHERE organization_id=$1 ORDER BY week_start,view_key",&[&org]).await?;
        let mut publication_marks: BTreeMap<NaiveDate, BTreeSet<String>> = BTreeMap::new();
        let mut invalidated_weeks = BTreeSet::new();
        for row in rows {
            let week: NaiveDate = row.get(0);
            if row.get::<_, Option<DateTime<Utc>>>(5).is_some() {
                invalidated_weeks.insert(week);
            }
            let marker = serde_json::to_vec(&(
                week,
                row.get::<_, String>(1),
                row.get::<_, i64>(2),
                row.get::<_, String>(3),
                row.get::<_, Vec<Uuid>>(4),
            ))?;
            publication_marks
                .entry(week)
                .or_default()
                .insert(format!("{:x}", Sha256::digest(marker)));
        }
        // An invalidated week is a permanent barrier; no per-view contributor data is needed.
        publication_marks.retain(|week, _| !invalidated_weeks.contains(week));
        Ok(RegistryEntry {
            generation: row.get(0),
            retention_before: row.get(1),
            weeks,
            access_hash: format!("{:x}", Sha256::digest(serde_json::to_vec(&access)?)),
            publication_marks,
            invalidated_weeks,
            deleted: false,
        })
    }
    pub async fn guard(&self, org: Uuid) -> Result<()> {
        let path = std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH")
            .context("Team privacy ledger is not configured")?;
        let ledger: Registry = serde_json::from_slice(
            &std::fs::read(path).context("Team privacy ledger unavailable")?,
        )?;
        ensure!(
            ledger.schema_version == 1
                && (0..=300).contains(
                    &Utc::now()
                        .signed_duration_since(ledger.checked_at)
                        .num_seconds()
                ),
            "Team privacy ledger freshness unconfirmed"
        );
        let expected = ledger
            .organizations
            .get(&org)
            .context("Team privacy ledger scope missing")?;
        ensure!(
            !expected.deleted,
            "organization deleted in independent registry"
        );
        let current = self.registry_entry(org).await?;
        ensure!(
            current.generation == expected.generation
                && current.access_hash == expected.access_hash
                && current.retention_before == expected.retention_before
                && covers_history(&current, expected),
            "Team privacy ledger differs from restored/live data"
        );
        Ok(())
    }
    /// Under the same row lock used by consent generation triggers. Shared by API and CSV.
    pub async fn release(
        &self,
        org: Uuid,
        week: NaiveDate,
        key: &str,
        generation: i64,
        fingerprint: &str,
        contributors: &BTreeSet<Uuid>,
    ) -> Result<bool> {
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let current: i64 = tx
            .query_one(
                "SELECT generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
                &[&org],
            )
            .await?
            .get(0);
        ensure!(current == generation, "sharing changed during publication");
        let rows=tx.query("SELECT view_key,fingerprint,contributors,invalidated_at,generation FROM team_weekly_publications WHERE organization_id=$1 AND week_start=$2", &[&org,&week]).await?;
        if rows.iter().any(|r| {
            r.get::<_, Option<DateTime<Utc>>>("invalidated_at")
                .is_some()
        }) {
            return Ok(false);
        }
        if rows.iter().any(|r| {
            r.get::<_, String>("view_key") == key
                && (r.get::<_, String>("fingerprint") != fingerprint
                    || r.get::<_, i64>("generation") != generation)
        }) {
            tx.execute("UPDATE team_weekly_publications SET invalidated_at=now() WHERE organization_id=$1 AND week_start=$2", &[&org,&week]).await?;
            tx.execute("SELECT team_bump_generation($1)", &[&org])
                .await?;
            tx.commit().await?;
            return Ok(false);
        }
        let previous = rows
            .iter()
            .map(|r| {
                (
                    r.get::<_, Vec<Uuid>>("contributors").into_iter().collect(),
                    r.get::<_, String>("fingerprint"),
                )
            })
            .collect::<Vec<_>>();
        if !safe_views(&previous, contributors, fingerprint) {
            return Ok(false);
        }
        let people = contributors.iter().copied().collect::<Vec<_>>();
        tx.execute("INSERT INTO team_weekly_publications(organization_id,week_start,view_key,generation,fingerprint,contributors) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", &[&org,&week,&key,&generation,&fingerprint,&people]).await?;
        tx.execute("UPDATE team_report_policies SET locked_at=COALESCE(locked_at,now()) WHERE organization_id=$1", &[&org]).await?;
        tx.commit().await?;
        Ok(true)
    }
    /// The ledger lives outside database backups. Never replace a newer head with restored state.
    pub async fn export_registry(&self, path: &Path) -> Result<()> {
        ensure!(path.is_absolute(), "privacy ledger path must be absolute");
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        tx.query_one("SELECT pg_advisory_xact_lock(74103031)", &[])
            .await?;
        ensure!(
            path.exists(),
            "privacy ledger missing: explicit initialization or restore reconciliation required"
        );
        let mut previous = if path.exists() {
            serde_json::from_slice::<Registry>(&std::fs::read(path)?)?
        } else {
            Registry {
                schema_version: 1,
                checked_at: Utc::now(),
                organizations: BTreeMap::new(),
                dispositions: vec![],
            }
        };
        ensure!(
            previous.schema_version == 1,
            "privacy registry schema unsupported"
        );
        let staging_path = path.with_extension("tmp");
        if staging_path.exists() {
            let candidate: Registry = serde_json::from_slice(&std::fs::read(&staging_path)?)?;
            ensure!(
                candidate.schema_version == 1
                    && candidate.checked_at >= previous.checked_at
                    && previous.organizations.iter().all(|(org, old)| candidate
                        .organizations
                        .get(org)
                        .is_some_and(|new| new.generation >= old.generation
                            && (new.generation > old.generation
                                || new.access_hash == old.access_hash)
                            && (!old.deleted || new.deleted)
                            && old
                                .retention_before
                                .is_none_or(|at| new.retention_before.is_some_and(|b| b >= at))
                            && covers_history(new, old)))
                    && previous
                        .dispositions
                        .iter()
                        .all(|d| candidate.dispositions.contains(d)),
                "abandoned privacy registry file is not a monotonic head"
            );
            // A crash between fsync and rename must not discard a newer revocation.
            std::fs::rename(&staging_path, path)?;
            previous = candidate;
        }
        let live=tx.query("SELECT r.organization_id FROM team_rollouts r JOIN organizations o ON o.id=r.organization_id WHERE o.deleted_at IS NULL ORDER BY r.organization_id FOR UPDATE OF r", &[]).await?;
        let live_ids = live
            .iter()
            .map(|r| r.get::<_, Uuid>(0))
            .collect::<BTreeSet<_>>();
        for (org, entry) in previous.organizations.iter_mut() {
            if !live_ids.contains(org) {
                entry.deleted = true;
            }
        }
        for row in live {
            let org: Uuid = row.get(0);
            let entry = self.registry_entry(org).await?;
            if let Some(old) = previous.organizations.get(&org) {
                ensure!(!old.deleted, "restored organization was previously deleted");
                ensure!(entry.generation>=old.generation,"restored state is older than privacy registry; restore reconciliation required");
                if entry.generation == old.generation {
                    ensure!(
                        entry.access_hash == old.access_hash,
                        "access changed without generation; refuse registry overwrite"
                    )
                }
                ensure!(
                    old.retention_before.is_none_or(|cutoff| entry
                        .retention_before
                        .is_some_and(|new| new >= cutoff)),
                    "retention marker regressed"
                );
                ensure!(covers_history(&entry, old), "publication history regressed");
            }
            previous.organizations.insert(org, entry);
        }
        let dispositions=self.postgres.query("SELECT provider,delivery_id,payload_hash,reason,disposed_at FROM team_webhook_dispositions ORDER BY provider,delivery_id",&[]).await?;
        let current_dispositions = dispositions
            .into_iter()
            .map(|r| Disposition {
                provider: r.get(0),
                delivery_id: r.get(1),
                payload_hash: r.get(2),
                reason: r.get(3),
                disposed_at: r.get(4),
            })
            .collect::<Vec<_>>();
        ensure!(
            previous
                .dispositions
                .iter()
                .all(|old| current_dispositions.contains(old)),
            "webhook disposition registry regressed after restore"
        );
        previous.dispositions = current_dispositions;
        previous.checked_at = Utc::now();
        let staging_path = path.with_extension("tmp");
        let bytes = serde_json::to_vec_pretty(&previous)?;
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&staging_path)
            .context("privacy ledger atomic file busy; inspect abandoned temporary file")?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        std::fs::rename(staging_path, path)?;
        #[cfg(unix)]
        std::fs::File::open(path.parent().context("registry parent missing")?)?.sync_all()?;
        tx.commit().await?;
        Ok(())
    }
    /// Restore always closes sharing first. Old released weeks stay permanently closed.
    pub async fn reconcile_restore(&self, ledger: &Registry) -> Result<()> {
        ensure!(
            ledger.schema_version == 1
                && (0..=300).contains(
                    &Utc::now()
                        .signed_duration_since(ledger.checked_at)
                        .num_seconds()
                ),
            "restore requires fresh independent privacy ledger"
        );
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        tx.execute("UPDATE team_rollouts SET enabled=FALSE", &[])
            .await?;
        tx.execute("UPDATE organization_analytics_consents SET share_aggregate=FALSE,share_individual=FALSE WHERE share_aggregate OR share_individual",&[]).await?;
        for (org, entry) in &ledger.organizations {
            if tx
                .query_opt(
                    "SELECT 1 FROM organizations WHERE id=$1 FOR UPDATE",
                    &[&org],
                )
                .await?
                .is_none()
            {
                continue;
            }
            tx.execute(
                "UPDATE team_rollouts SET enabled=FALSE WHERE organization_id=$1",
                &[&org],
            )
            .await?;
            tx.execute("UPDATE organization_analytics_consents SET share_aggregate=FALSE,share_individual=FALSE WHERE organization_id=$1", &[&org]).await?;
            if entry.deleted {
                tx.execute(
                    "UPDATE organizations SET deleted_at=COALESCE(deleted_at,now()) WHERE id=$1",
                    &[&org],
                )
                .await?;
            }
            tx.execute("UPDATE team_rollouts SET generation=GREATEST(generation,$2)+1 WHERE organization_id=$1", &[&org,&entry.generation]).await?;
            tx.execute("INSERT INTO team_privacy_markers(organization_id,retention_before) VALUES($1,$2) ON CONFLICT(organization_id) DO UPDATE SET retention_before=GREATEST(team_privacy_markers.retention_before,EXCLUDED.retention_before)", &[&org,&entry.retention_before]).await?;
            for week in &entry.weeks {
                tx.execute("INSERT INTO team_weekly_publications(organization_id,week_start,view_key,generation,fingerprint,contributors,invalidated_at) VALUES($1,$2,'restore_barrier',$3,'withheld','{}',now()) ON CONFLICT DO NOTHING", &[&org,&week,&entry.generation]).await?;
            }
            tx.execute(
                "UPDATE team_weekly_publications SET invalidated_at=now() WHERE organization_id=$1",
                &[&org],
            )
            .await?;
            tx.execute("INSERT INTO team_cleanup_jobs(organization_id) VALUES($1) ON CONFLICT(organization_id) DO UPDATE SET phase=0,completed_at=NULL,retry_at=now()", &[&org]).await?;
        }
        for d in &ledger.dispositions {
            tx.execute("INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",&[&d.provider,&d.delivery_id,&d.payload_hash,&d.reason,&d.disposed_at]).await?;
            tx.execute(
                "DELETE FROM team_webhook_inbox WHERE provider=$1 AND delivery_id=$2",
                &[&d.provider, &d.delivery_id],
            )
            .await?;
        }
        let hash = format!("{:x}", Sha256::digest(serde_json::to_vec(ledger)?));
        for org in ledger.organizations.keys() {
            tx.execute("INSERT INTO team_restore_checkpoints(organization_id,ledger_hash) SELECT id,$2 FROM organizations WHERE id=$1 ON CONFLICT(organization_id) DO UPDATE SET ledger_hash=EXCLUDED.ledger_hash,verified_at=now()",&[org,&hash]).await?;
        }
        tx.commit().await?;
        Ok(())
    }
    /// One bounded chunk in one transaction. Crash rolls back both effects and checkpoint;
    /// SKIP LOCKED plus token/expiry protect competing workers without network under lock.
    pub async fn cleanup_tick(&self, now: DateTime<Utc>) -> Result<bool> {
        let cutoff = crate::services::team_trust::cutoff(now);
        self.postgres.execute("INSERT INTO team_cleanup_jobs(organization_id) SELECT id FROM organizations WHERE deleted_at IS NULL ON CONFLICT(organization_id) DO UPDATE SET completed_at=NULL,phase=0,retry_at=$1::timestamptz WHERE team_cleanup_jobs.completed_at < $1::timestamptz - interval '1 hour'", &[&now]).await?;
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let Some(job)=tx.query_opt("SELECT organization_id,phase,cutoff FROM team_cleanup_jobs WHERE completed_at IS NULL AND retry_at<=$1 AND (lease_until IS NULL OR lease_until<$1) ORDER BY retry_at FOR UPDATE SKIP LOCKED LIMIT 1", &[&now]).await? else {return Ok(false)};
        let org: Uuid = job.get(0);
        let phase: i32 = job.get(1);
        let cutoff: DateTime<Utc> = job.get::<_, Option<DateTime<Utc>>>(2).unwrap_or(cutoff);
        let token = Uuid::now_v7();
        tx.execute("UPDATE team_cleanup_jobs SET lease_token=$2,lease_until=$3::timestamptz+interval '60 seconds',cutoff=COALESCE(cutoff,$4),attempts=attempts+1 WHERE organization_id=$1", &[&org,&token,&now,&cutoff]).await?;
        if (5..=6).contains(&phase) {
            tx.query_one("SELECT pg_advisory_xact_lock(74103032)", &[])
                .await?;
        }
        let count=match phase {
   0 => tx.execute("DELETE FROM team_session_links WHERE id IN (SELECT l.id FROM team_session_links l LEFT JOIN organization_analytics_consents c USING(organization_id,user_id) LEFT JOIN organization_members m USING(organization_id,user_id) WHERE l.organization_id=$1 AND (l.created_at<$2 OR COALESCE(c.share_aggregate,FALSE)=FALSE OR m.user_id IS NULL OR m.deactivated_at IS NOT NULL) LIMIT 100)", &[&org,&cutoff]).await?,
   1 => {
    let allocations=tx.execute("DELETE FROM team_usage_allocations WHERE (user_id,usage_identity) IN (SELECT a.user_id,a.usage_identity FROM team_usage_allocations a JOIN team_session_links l ON l.id=a.link_id LEFT JOIN organization_analytics_consents c ON c.organization_id=l.organization_id AND c.user_id=l.user_id WHERE l.organization_id=$1 AND (a.created_at<$2 OR NOT COALESCE(c.share_individual,FALSE)) LIMIT 100)", &[&org,&cutoff]).await?;
    let history=tx.execute("DELETE FROM team_link_history WHERE id IN (SELECT h.id FROM team_link_history h JOIN team_session_links l ON l.id=h.link_id WHERE l.organization_id=$1 AND h.changed_at<$2 LIMIT 100)", &[&org,&cutoff]).await?;
    allocations.max(history)
   },
   2 => tx.execute("DELETE FROM team_work_items WHERE (organization_id,repository_id,external_id) IN (SELECT organization_id,repository_id,external_id FROM team_work_items WHERE organization_id=$1 AND provider_updated_at<$2 LIMIT 100)", &[&org,&cutoff]).await?,
   3 => tx.execute("DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs WHERE organization_id=$1 AND created_at<$2 LIMIT 100)", &[&org,&cutoff]).await?,
   4 => tx.execute("DELETE FROM team_consent_history WHERE (organization_id,user_id,version) IN (SELECT h.organization_id,h.user_id,h.version FROM team_consent_history h JOIN organization_analytics_consents c USING(organization_id,user_id) WHERE h.organization_id=$1 AND h.effective_at<$2 AND h.version<c.consent_version LIMIT 100)", &[&org,&cutoff]).await?,
   5 => { tx.execute("UPDATE team_webhook_inbox SET metadata=jsonb_build_object('disposition','expired_before_processing'),error_code='retention_expired',dead_letter_at=COALESCE(dead_letter_at,$1) WHERE (provider,delivery_id) IN (SELECT provider,delivery_id FROM team_webhook_inbox WHERE provider='github' AND received_at<$2 AND processed_at IS NULL AND metadata->>'disposition' IS DISTINCT FROM 'expired_before_processing' LIMIT 100)", &[&now,&cutoff]).await? },
   6 => {
    tx.execute("INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at) SELECT provider,delivery_id,payload_hash,COALESCE(error_code,'processed_retention'),$2 FROM team_webhook_inbox WHERE provider='github' AND received_at<$1 AND (processed_at IS NOT NULL OR metadata->>'disposition'='expired_before_processing') ORDER BY received_at,delivery_id LIMIT 100 ON CONFLICT DO NOTHING", &[&cutoff,&now]).await?;
    tx.execute("DELETE FROM team_webhook_inbox WHERE (provider,delivery_id) IN (SELECT provider,delivery_id FROM team_webhook_inbox WHERE provider='github' AND received_at<$1 AND EXISTS (SELECT 1 FROM team_webhook_dispositions d WHERE d.provider=team_webhook_inbox.provider AND d.delivery_id=team_webhook_inbox.delivery_id) LIMIT 100)", &[&cutoff]).await?
   },
   _ => 0,
  };
        if phase >= 7 {
            tx.execute("INSERT INTO team_privacy_markers(organization_id,retention_before) VALUES($1,$2) ON CONFLICT(organization_id) DO UPDATE SET retention_before=GREATEST(team_privacy_markers.retention_before,EXCLUDED.retention_before),changed_at=now()", &[&org,&cutoff]).await?;
            tx.execute("UPDATE team_weekly_publications SET invalidated_at=COALESCE(invalidated_at,now()),contributors='{}',fingerprint='expired' WHERE organization_id=$1 AND week_start<$2::timestamptz::date", &[&org,&cutoff]).await?;
            tx.execute("UPDATE team_cleanup_jobs SET completed_at=$2,cutoff=NULL,phase=0,lease_token=NULL,lease_until=NULL,error_code=NULL WHERE organization_id=$1", &[&org,&now]).await?;
        } else {
            tx.execute("UPDATE team_cleanup_jobs SET phase=phase+$2,lease_token=NULL,lease_until=NULL,error_code=NULL WHERE organization_id=$1", &[&org,&(if count<100 {1}else{0})]).await?;
        }
        tx.commit().await?;
        Ok(true)
    }
}
