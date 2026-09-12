use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Duration, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::presence::{PresenceInvite, PresenceRoom, PresenceRoomKind, PresenceZone};

pub struct PresenceRepository {
    postgres: Arc<PostgresClient>,
}

impl PresenceRepository {
    pub fn new(postgres: Arc<PostgresClient>) -> Self {
        Self { postgres }
    }

    pub async fn ensure_team_room(&self, team_id: Uuid, name: &str) -> Result<PresenceRoom> {
        let existing = self
            .postgres
            .client()
            .query_opt(
                "SELECT id, kind, team_id, owner_user_id, name, expires_at, ended_at, created_at, updated_at
                 FROM presence_rooms WHERE team_id = $1 AND ended_at IS NULL LIMIT 1",
                &[&team_id],
            )
            .await
            .context("failed to load team presence room")?;
        if let Some(row) = existing {
            let room = room_from_row(&row)?;
            self.ensure_zones(room.id).await?;
            return Ok(room);
        }

        let id = Uuid::now_v7();
        let trimmed = trim_name(name, 80)?;
        // Multiple API instances can discover a newly-created team at the same time. The
        // partial unique index is the source of truth; make the insert idempotent and load
        // the winner instead of surfacing a spurious unique-constraint error to one caller.
        let row = self
            .postgres
            .client()
            .query_opt(
                "INSERT INTO presence_rooms (id, kind, team_id, name)
                 VALUES ($1, 'team', $2, $3)
                 ON CONFLICT DO NOTHING
                 RETURNING id, kind, team_id, owner_user_id, name, expires_at, ended_at, created_at, updated_at",
                &[&id, &team_id, &trimmed],
            )
            .await
            .context("failed to create team presence room")?;
        let row = match row {
            Some(row) => row,
            None => self
                .postgres
                .client()
                .query_one(
                    "SELECT id, kind, team_id, owner_user_id, name, expires_at, ended_at, created_at, updated_at
                     FROM presence_rooms
                     WHERE team_id = $1 AND ended_at IS NULL
                     LIMIT 1",
                    &[&team_id],
                )
                .await
                .context("failed to load concurrently-created team presence room")?,
        };
        let room = room_from_row(&row)?;
        self.ensure_zones(room.id).await?;
        Ok(room)
    }

    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<PresenceRoom>> {
        let teams = self
            .postgres
            .client()
            .query(
                "SELECT DISTINCT t.id, t.name
                 FROM teams t
                 JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
                    AND tm.role IN ('lead', 'member')
                 JOIN organization_members om ON om.organization_id = t.organization_id
                    AND om.user_id = $1 AND om.deactivated_at IS NULL AND om.seat_type = 'developer'",
                &[&user_id],
            )
            .await
            .context("failed to list user's teams for presence")?;
        for team in teams {
            self.ensure_team_room(team.get("id"), team.get("name"))
                .await?;
        }
        let team_rows = self
            .postgres
            .client()
            .query(
                "SELECT r.id, r.kind, r.team_id, r.owner_user_id, r.name, r.expires_at, r.ended_at,
                        r.created_at, r.updated_at
                 FROM presence_rooms r
                 JOIN teams t ON t.id = r.team_id
                 JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
                    AND tm.role IN ('lead', 'member')
                 JOIN organization_members om ON om.organization_id = t.organization_id
                    AND om.user_id = $1 AND om.deactivated_at IS NULL AND om.seat_type = 'developer'
                 WHERE r.kind = 'team' AND r.ended_at IS NULL
                 ORDER BY r.updated_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list team presence rooms")?;
        let adhoc_rows = self
            .postgres
            .client()
            .query(
                "SELECT DISTINCT r.id, r.kind, r.team_id, r.owner_user_id, r.name, r.expires_at, r.ended_at,
                        r.created_at, r.updated_at
                 FROM presence_rooms r
                 LEFT JOIN presence_room_grants g ON g.room_id = r.id AND g.user_id = $1
                 WHERE r.kind = 'adhoc' AND r.ended_at IS NULL
                   AND r.expires_at > now()
                   AND (r.owner_user_id = $1 OR (g.user_id IS NOT NULL AND g.revoked_at IS NULL))
                 ORDER BY r.updated_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list ad-hoc presence rooms")?;

        team_rows
            .into_iter()
            .chain(adhoc_rows)
            .map(|row| room_from_row(&row))
            .collect()
    }

    pub async fn get(&self, room_id: Uuid) -> Result<Option<PresenceRoom>> {
        let row = self
            .postgres
            .client()
            .query_opt(
                "SELECT id, kind, team_id, owner_user_id, name, expires_at, ended_at, created_at, updated_at
                 FROM presence_rooms WHERE id = $1 LIMIT 1",
                &[&room_id],
            )
            .await
            .context("failed to load presence room")?;
        row.map(|row| room_from_row(&row)).transpose()
    }

    pub async fn room_for_invite(&self, token_hash: &str) -> Result<Option<PresenceRoom>> {
        let row = self
            .postgres
            .client()
            .query_opt(
                "SELECT r.id, r.kind, r.team_id, r.owner_user_id, r.name, r.expires_at,
                        r.ended_at, r.created_at, r.updated_at
                 FROM presence_room_invites i
                 JOIN presence_rooms r ON r.id = i.room_id
                 WHERE i.token_hash = $1
                   AND i.revoked_at IS NULL
                   AND i.expires_at > now()
                   AND r.ended_at IS NULL
                   AND (r.expires_at IS NULL OR r.expires_at > now())
                 LIMIT 1",
                &[&token_hash],
            )
            .await
            .context("failed to resolve presence invite preview")?;
        row.map(|row| room_from_row(&row)).transpose()
    }

    pub async fn zones(&self, room_id: Uuid) -> Result<Vec<PresenceZone>> {
        let rows = self
            .postgres
            .client()
            .query(
                "SELECT id, room_id, label, sort_order, center_x, center_y, width, height
                 FROM presence_room_zones WHERE room_id = $1 ORDER BY sort_order ASC",
                &[&room_id],
            )
            .await
            .context("failed to load presence zones")?;
        rows.into_iter().map(zone_from_row).collect()
    }

    pub async fn create_adhoc(
        &self,
        owner_user_id: Uuid,
        name: &str,
        expires_in_seconds: i64,
    ) -> Result<PresenceRoom> {
        let seconds = match expires_in_seconds {
            3600 | 86_400 | 604_800 => expires_in_seconds,
            _ => return Err(anyhow!("expires_in_seconds must be 3600, 86400 or 604800")),
        };
        let id = Uuid::now_v7();
        let expires_at = Utc::now() + Duration::seconds(seconds);
        let trimmed = trim_name(name, 80)?;
        let row = self
            .postgres
            .client()
            .query_one(
                "INSERT INTO presence_rooms (id, kind, owner_user_id, name, expires_at)
                 VALUES ($1, 'adhoc', $2, $3, $4)
                 RETURNING id, kind, team_id, owner_user_id, name, expires_at, ended_at, created_at, updated_at",
                &[&id, &owner_user_id, &trimmed, &expires_at],
            )
            .await
            .context("failed to create ad-hoc presence room")?;
        self.ensure_zones(id).await?;
        self.grant(id, owner_user_id).await?;
        room_from_row(&row)
    }

    pub async fn can_join(&self, room: &PresenceRoom, user_id: Uuid) -> Result<bool> {
        if room.ended_at.is_some() || room.expires_at.is_some_and(|expires| expires <= Utc::now()) {
            return Ok(false);
        }
        // A child room must never outlive the parent office's authorization.
        if let Some(row) = self.postgres.query_opt("SELECT parent_id FROM presence_spaces WHERE room_id=$1", &[&room.id]).await? {
            let parent_id: Uuid = row.get(0);
            let Some(parent) = self.get(parent_id).await? else { return Ok(false); };
            if !Box::pin(self.can_join(&parent, user_id)).await? { return Ok(false); }
        }
        match room.kind {
            PresenceRoomKind::Team => {
                let team_id = room
                    .team_id
                    .ok_or_else(|| anyhow!("team presence room is missing team_id"))?;
                let allowed = self
                    .postgres
                    .client()
                    .query_opt(
                        "SELECT 1 FROM team_members tm
                         JOIN teams t ON t.id = tm.team_id
                         JOIN organization_members om ON om.organization_id = t.organization_id
                         WHERE tm.team_id = $1 AND tm.user_id = $2
                           AND tm.role IN ('lead', 'member')
                           AND om.user_id = $2 AND om.deactivated_at IS NULL AND om.seat_type = 'developer'
                         LIMIT 1",
                        &[&team_id, &user_id],
                    )
                    .await
                    .context("failed to check team presence access")?;
                Ok(allowed.is_some())
            }
            PresenceRoomKind::Adhoc => {
                let allowed = self
                    .postgres
                    .client()
                    .query_opt(
                        "SELECT 1 FROM presence_room_grants
                         WHERE room_id = $1 AND user_id = $2 AND revoked_at IS NULL",
                        &[&room.id, &user_id],
                    )
                    .await
                    .context("failed to check ad-hoc presence access")?;
                Ok(allowed.is_some())
            }
        }
    }

    pub async fn can_manage(&self, room: &PresenceRoom, user_id: Uuid) -> Result<bool> {
        if !self.can_join(room,user_id).await? { return Ok(false); }
        if room.owner_user_id==Some(user_id) { return Ok(true); }
        if let Some(team)=room.team_id {
            return Ok(self.postgres.query_opt("SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2 AND role='lead'", &[&team,&user_id]).await?.is_some());
        }
        Ok(false)
    }

    pub async fn grant(&self, room_id: Uuid, user_id: Uuid) -> Result<()> {
        self.postgres
            .client()
            .execute(
                "INSERT INTO presence_room_grants (room_id, user_id)
                 VALUES ($1, $2)
                 ON CONFLICT (room_id, user_id) DO UPDATE SET revoked_at = NULL",
                &[&room_id, &user_id],
            )
            .await
            .context("failed to grant presence room access")?;
        Ok(())
    }

    pub async fn create_invite(
        &self,
        room_id: Uuid,
        created_by: Uuid,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<PresenceInvite> {
        let id = Uuid::now_v7();
        let row = self
            .postgres
            .client()
            .query_one(
                "INSERT INTO presence_room_invites (id, room_id, token_hash, created_by, expires_at)
                 SELECT $1, r.id, $3, $2, LEAST($4, r.expires_at)
                 FROM presence_rooms r
                 WHERE r.id = $5 AND r.kind = 'adhoc' AND r.owner_user_id = $2
                   AND r.ended_at IS NULL AND r.expires_at > now()
                 RETURNING id, room_id, expires_at, revoked_at, used_count, created_at",
                &[&id, &created_by, &token_hash, &expires_at, &room_id],
            )
            .await
            .context("failed to create presence invite")?;
        invite_from_row(&row)
    }

    pub async fn redeem_invite(
        &self,
        room_id: Uuid,
        token_hash: &str,
        user_id: Uuid,
    ) -> Result<bool> {
        // Keep validation, usage accounting and the access grant in one statement. Updating
        // the invite acquires a row lock, so a concurrent revoke either happens before this
        // statement (and the predicates reject the invite) or after the grant commits.
        let granted = self
            .postgres
            .client()
            .query_opt(
                "WITH valid_invite AS (
                     UPDATE presence_room_invites i
                     SET used_count = i.used_count + 1
                     FROM presence_rooms r
                     WHERE i.room_id = $1 AND i.token_hash = $2
                       AND i.revoked_at IS NULL AND i.expires_at > now()
                       AND r.id = i.room_id AND r.ended_at IS NULL
                       AND (r.expires_at IS NULL OR r.expires_at > now())
                     RETURNING i.room_id
                 )
                 INSERT INTO presence_room_grants (room_id, user_id)
                 SELECT room_id, $3 FROM valid_invite
                 ON CONFLICT (room_id, user_id) DO UPDATE SET revoked_at = NULL
                 RETURNING room_id",
                &[&room_id, &token_hash, &user_id],
            )
            .await
            .context("failed to redeem presence invite atomically")?;
        Ok(granted.is_some())
    }

    pub async fn list_invites(
        &self,
        room_id: Uuid,
        owner_user_id: Uuid,
    ) -> Result<Vec<PresenceInvite>> {
        let rows = self
            .postgres
            .client()
            .query(
                "SELECT i.id, i.room_id, i.expires_at, i.revoked_at, i.used_count, i.created_at
                 FROM presence_room_invites i JOIN presence_rooms r ON r.id = i.room_id
                 WHERE i.room_id = $1 AND r.owner_user_id = $2 ORDER BY i.created_at DESC",
                &[&room_id, &owner_user_id],
            )
            .await
            .context("failed to list presence invites")?;
        rows.into_iter().map(|row| invite_from_row(&row)).collect()
    }

    pub async fn revoke_invite(
        &self,
        room_id: Uuid,
        invite_id: Uuid,
        owner_user_id: Uuid,
    ) -> Result<bool> {
        let count = self
            .postgres
            .client()
            .execute(
                "UPDATE presence_room_invites i SET revoked_at = now()
                 FROM presence_rooms r
                 WHERE i.id = $1 AND i.room_id = $2 AND r.id = i.room_id AND r.owner_user_id = $3
                   AND i.revoked_at IS NULL",
                &[&invite_id, &room_id, &owner_user_id],
            )
            .await
            .context("failed to revoke presence invite")?;
        Ok(count == 1)
    }

    pub async fn end_room(&self, room_id: Uuid, owner_user_id: Uuid) -> Result<bool> {
        let count = self
            .postgres
            .client()
            .execute(
                "UPDATE presence_rooms SET ended_at = now(), updated_at = now()
                 WHERE id = $1 AND kind = 'adhoc' AND owner_user_id = $2 AND ended_at IS NULL",
                &[&room_id, &owner_user_id],
            )
            .await
            .context("failed to end presence room")?;
        if count == 1 {
            self.postgres
                .client()
                .execute(
                    "UPDATE presence_room_invites
                     SET revoked_at = COALESCE(revoked_at, now())
                     WHERE room_id = $1 AND revoked_at IS NULL",
                    &[&room_id],
                )
                .await
                .context("failed to revoke presence invites when ending room")?;
        }
        Ok(count == 1)
    }

    pub async fn usernames(&self, user_ids: &[Uuid]) -> Result<HashMap<Uuid, String>> {
        if user_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let rows = self
            .postgres
            .client()
            .query(
                "SELECT id, username FROM users WHERE id = ANY($1)",
                &[&user_ids],
            )
            .await
            .context("failed to resolve presence participant names")?;
        Ok(rows
            .into_iter()
            .map(|row| (row.get("id"), row.get("username")))
            .collect())
    }

    pub async fn organization_team_ids(
        &self,
        organization_id: Uuid,
        user_id: Uuid,
        requested_team_id: Option<Uuid>,
    ) -> Result<Option<Vec<Uuid>>> {
        let rows = self
            .postgres
            .client()
            .query(
                "SELECT DISTINCT t.id
                 FROM teams t
                 JOIN organization_members om ON om.organization_id = t.organization_id
                    AND om.user_id = $1 AND om.deactivated_at IS NULL
                    AND om.seat_type = 'developer'
                 JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
                    AND tm.role IN ('lead', 'member')
                 WHERE t.organization_id = $2
                   AND ($3::uuid IS NULL OR t.id = $3)",
                &[&user_id, &organization_id, &requested_team_id],
            )
            .await
            .context("failed to authorize organization presence summary")?;
        if rows.is_empty() {
            return Ok(None);
        }
        Ok(Some(rows.into_iter().map(|row| row.get("id")).collect()))
    }

    async fn ensure_zones(&self, room_id: Uuid) -> Result<()> {
        for (label, sort_order, x, y, width, height) in [
            ("Pairing Table A", 0, 25.0, 30.0, 22.0, 24.0),
            ("Pairing Table B", 1, 75.0, 30.0, 22.0, 24.0),
            ("Pairing Table C", 2, 50.0, 72.0, 22.0, 24.0),
        ] {
            self.postgres
                .client()
                .execute(
                    "INSERT INTO presence_room_zones
                        (id, room_id, label, sort_order, center_x, center_y, width, height)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (room_id, sort_order) DO NOTHING",
                    &[
                        &Uuid::now_v7(),
                        &room_id,
                        &label,
                        &sort_order,
                        &x,
                        &y,
                        &width,
                        &height,
                    ],
                )
                .await
                .context("failed to seed presence room zone")?;
        }
        Ok(())
    }
}

fn trim_name(name: &str, max: usize) -> Result<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.chars().count() > max {
        return Err(anyhow!("room name must contain 1-{max} characters"));
    }
    Ok(trimmed.to_string())
}

fn room_from_row(row: &tokio_postgres::Row) -> Result<PresenceRoom> {
    let kind = match row.get::<_, String>("kind").as_str() {
        "team" => PresenceRoomKind::Team,
        "adhoc" => PresenceRoomKind::Adhoc,
        value => return Err(anyhow!("unknown presence room kind: {value}")),
    };
    Ok(PresenceRoom {
        id: row.get("id"),
        kind,
        team_id: row.get("team_id"),
        owner_user_id: row.get("owner_user_id"),
        name: row.get("name"),
        expires_at: row.get("expires_at"),
        ended_at: row.get("ended_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn zone_from_row(row: tokio_postgres::Row) -> Result<PresenceZone> {
    Ok(PresenceZone {
        id: row.get("id"),
        room_id: row.get("room_id"),
        label: row.get("label"),
        sort_order: row.get("sort_order"),
        center_x: row.get("center_x"),
        center_y: row.get("center_y"),
        width: row.get("width"),
        height: row.get("height"),
    })
}

fn invite_from_row(row: &tokio_postgres::Row) -> Result<PresenceInvite> {
    Ok(PresenceInvite {
        id: row.get("id"),
        room_id: row.get("room_id"),
        expires_at: row.get("expires_at"),
        revoked_at: row.get("revoked_at"),
        used_count: row.get("used_count"),
        created_at: row.get("created_at"),
    })
}
