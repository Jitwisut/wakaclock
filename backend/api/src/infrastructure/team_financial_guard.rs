//! Independent append-only enrollment proof, outside database backups. Short file
//! locks never encompass PostgreSQL calls. No routine startup creates this file.
use crate::services::{
    team_analytics_entitlement::State,
    team_financial_guard::{fingerprint, Event, Head, Pending, Snapshot},
};
use anyhow::{ensure, Context, Result};
use chrono::Utc;
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::{
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;
const MAX_BYTES: u64 = 64 * 1024 * 1024;
const MAX_RECORD: usize = 1024 * 1024;
#[cfg(test)]
type AfterIngressPrepare =
    std::sync::Arc<parking_lot::Mutex<Option<Box<dyn FnOnce() -> Result<()> + Send>>>>;

fn environment_setting(name: &str) -> Result<Option<String>> {
    match std::env::var(name) {
        Ok(value) => Ok(Some(value)),
        Err(std::env::VarError::NotPresent) => Ok(None),
        Err(std::env::VarError::NotUnicode(_)) => {
            anyhow::bail!("financial_guard_configuration_encoding_invalid")
        }
    }
}

fn required_flag(value: Option<&str>) -> Result<bool> {
    match value {
        None | Some("0" | "false") => Ok(false),
        Some("1" | "true") => Ok(true),
        _ => anyhow::bail!("financial_guard_required_flag_invalid"),
    }
}

/// Configuration prerequisite for commercial enrollment. This is not evidence
/// that payment sources were recovered or that a particular organization may read.
/// There is deliberately no production conversion from an arbitrary journal.
#[derive(Clone)]
pub struct CommercialDeployment {
    guard: FinancialGuard,
}
impl CommercialDeployment {
    pub fn from_environment() -> Result<Option<Self>> {
        Self::from_settings(
            environment_setting("ATOAXIS_TEAM_FINANCIAL_GUARD_PATH")?.as_deref(),
            environment_setting("ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE")?.as_deref(),
            environment_setting("ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED")?.as_deref(),
        )
    }
    fn from_settings(
        path: Option<&str>,
        namespace: Option<&str>,
        required: Option<&str>,
    ) -> Result<Option<Self>> {
        let guard = FinancialGuard::from_settings(path, namespace, required)?;
        if !required_flag(required)? {
            return Ok(None);
        }
        Ok(Some(Self {
            guard: guard.context("financial_guard_configuration_required")?,
        }))
    }
    pub fn required_from_environment() -> Result<Self> {
        Self::from_environment()?.context("financial_guard_commercial_deployment_required")
    }
    pub(crate) fn guard(&self) -> &FinancialGuard {
        &self.guard
    }
    pub(crate) fn observation(&self) -> FinancialObservation {
        FinancialObservation {
            guard: Some(self.guard.clone()),
            deployment: Some(self.clone()),
        }
    }
    #[cfg(test)]
    pub(crate) fn for_test(guard: FinancialGuard) -> Result<Self> {
        guard.namespace()?;
        guard.read()?;
        Ok(Self { guard })
    }
}

/// Provider observations must retain configured roster authority even when
/// commercial activation is disabled. Missing DB state never proves legacy.
#[derive(Clone)]
pub(crate) struct FinancialObservation {
    guard: Option<FinancialGuard>,
    deployment: Option<CommercialDeployment>,
}
impl FinancialObservation {
    pub(crate) fn from_environment() -> Result<Self> {
        let guard = FinancialGuard::from_environment()?;
        let deployment = CommercialDeployment::from_environment()?;
        if let Some(deployment) = &deployment {
            ensure!(
                guard
                    .as_ref()
                    .is_some_and(|g| g.same_authority(deployment.guard())),
                "financial_guard_configuration_changed"
            );
        }
        Ok(Self { guard, deployment })
    }
    pub(crate) fn guard(&self) -> Option<&FinancialGuard> {
        self.guard.as_ref()
    }
    pub(crate) fn require_enrolled(&self) -> Result<()> {
        ensure!(
            self.deployment.is_some(),
            "financial_guard_commercial_deployment_required"
        );
        Ok(())
    }
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Body {
    version: u8,
    sequence: u64,
    previous: String,
    event: Event,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    body: Body,
    checksum: String,
}
#[derive(Clone)]
pub struct FinancialGuard {
    path: PathBuf,
    expected_namespace: Option<Uuid>,
    #[cfg(test)]
    sync_failures: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    #[cfg(test)]
    prepare_delay_ms: std::sync::Arc<std::sync::atomic::AtomicU64>,
    #[cfg(test)]
    after_ingress_prepare: AfterIngressPrepare,
}
pub struct Read {
    pub snapshot: Snapshot,
    pub sequence: u64,
    pub chain: String,
}
/// Journal disposition only. Neither variant proves that SQL committed or that
/// the current heads are still ready; retained exact retries may be historical.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransactionStatus {
    Prepared,
    Confirmed,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransactionRecord {
    pub status: TransactionStatus,
    pub appended: bool,
}
impl Read {
    /// Distinct from enrollment tokens; no whole-file sequence fence across orgs.
    pub fn source_token(
        &self,
        scope: &crate::services::team_financial_source::Scope,
    ) -> Result<String> {
        self.snapshot.transactions.require_account_free(
            &crate::services::team_financial_ingress::Scope {
                account: scope.account.clone(),
                live: scope.live,
            },
        )?;
        self.snapshot
            .transactions
            .require_organization_free(scope.organization)?;
        let entry = self
            .snapshot
            .sources
            .scopes
            .get(&scope.key()?)
            .context("financial_source_uninitialized")?;
        fingerprint(&(
            self.snapshot.namespace,
            entry,
            self.snapshot.transactions.history_for_source(scope),
        ))
    }
    /// A caller checks this token before/after its DB observation. Other
    /// organizations' appends do not invalidate an unchanged organization proof.
    pub fn organization_token(&self, org: Uuid) -> Result<String> {
        let entry = self
            .snapshot
            .organizations
            .get(&org)
            .context("financial_guard_unknown_organization")?;
        fingerprint(&(
            self.snapshot.namespace,
            org,
            entry,
            self.snapshot.transactions.history_for_org(org),
        ))
    }
}
impl FinancialGuard {
    /// One fsynced record contains the complete intent or confirmation. The SQL
    /// coordinator, not this file-only primitive, must establish commit/readback.
    pub fn record_transaction(
        &self,
        event: crate::services::team_financial_transaction::Event,
    ) -> Result<TransactionRecord> {
        #[cfg(test)]
        if matches!(
            &event,
            crate::services::team_financial_transaction::Event::Confirm { .. }
        ) && self
            .sync_failures
            .fetch_and(!32, std::sync::atomic::Ordering::SeqCst)
            & 32
            != 0
        {
            anyhow::bail!("fixture_financial_transaction_confirmation_lost");
        }
        self.namespace()?;
        let _lock = self.lock(false)?;
        let state = self.load()?;
        let id = match &event {
            crate::services::team_financial_transaction::Event::Prepare { proposal } => proposal.id,
            crate::services::team_financial_transaction::Event::Confirm { transaction, .. } => {
                *transaction
            }
        };
        let event = Event::FinancialTransaction {
            event: Box::new(event),
        };
        let mut next = state.snapshot.clone();
        next.apply(&event)?;
        let changed = next.transactions != state.snapshot.transactions;
        let entry = next
            .transactions
            .groups
            .get(&id)
            .context("financial_transaction_unknown")?;
        let result = TransactionRecord {
            status: if entry.committed {
                TransactionStatus::Confirmed
            } else {
                TransactionStatus::Prepared
            },
            appended: changed,
        };
        if changed {
            self.append(&state, event)?;
        }
        Ok(result)
    }
    #[cfg(test)]
    pub(crate) fn fail_transaction_confirmation_once(&self) {
        self.sync_failures
            .fetch_or(32, std::sync::atomic::Ordering::SeqCst);
    }
    /// Independent account receipt, including unbound/ignored notifications.
    /// No SQL/provider calls under the file lock. No automatic account seed.
    pub fn record_ingress(
        &self,
        event: crate::services::team_financial_ingress::Event,
    ) -> Result<()> {
        #[cfg(test)]
        let was_prepare = matches!(
            &event,
            crate::services::team_financial_ingress::Event::Prepare { .. }
        );
        #[cfg(test)]
        if matches!(
            &event,
            crate::services::team_financial_ingress::Event::Confirm { .. }
                | crate::services::team_financial_ingress::Event::ConfirmBootstrap { .. }
        ) && self
            .sync_failures
            .fetch_and(!16, std::sync::atomic::Ordering::SeqCst)
            & 16
            != 0
        {
            anyhow::bail!("fixture_ingress_confirmation_lost");
        }
        self.namespace()?;
        let _lock = self.lock(false)?;
        let state = self.load()?;
        let event = Event::FinancialIngress {
            event: Box::new(event),
        };
        let mut next = state.snapshot.clone();
        next.apply(&event)?;
        if next.ingress == state.snapshot.ingress {
            return Ok(());
        }
        self.append(&state, event)?;
        #[cfg(test)]
        {
            drop(_lock);
            if was_prepare {
                let hook = self.after_ingress_prepare.lock().take();
                if let Some(hook) = hook {
                    hook()?;
                }
            }
        }
        Ok(())
    }
    #[cfg(test)]
    pub(crate) fn fail_ingress_confirmation_once(&self) {
        self.sync_failures
            .fetch_or(16, std::sync::atomic::Ordering::SeqCst);
    }
    #[cfg(test)]
    pub(crate) fn after_ingress_prepare_once(
        &self,
        hook: impl FnOnce() -> Result<()> + Send + 'static,
    ) {
        *self.after_ingress_prepare.lock() = Some(Box::new(hook));
    }
    /// Shared append/fsync/lock protocol. No SQL/provider calls, no source seeding
    /// from database contents, and no product authorization from an outcome ACK.
    pub fn record_source(
        &self,
        event: crate::services::team_financial_source::Event,
    ) -> Result<()> {
        self.namespace()?;
        let _lock = self.lock(false)?;
        let state = self.load()?;
        let event = Event::FinancialSource {
            event: Box::new(event),
        };
        let mut proposed = state.snapshot.clone();
        proposed.apply(&event)?;
        if proposed.sources == state.snapshot.sources {
            return Ok(());
        }
        self.append(&state, event)
    }
    /// Retain normalized provider evidence under the same file lock as its first
    /// observed time. Concurrent retries reuse that time instead of conflicting.
    pub(crate) fn retain_customer_outcome(
        &self,
        scope: crate::services::team_financial_source::Scope,
        request: &crate::services::team_financial_source::AcceptedRequest,
        customer: Option<&str>,
        verified: bool,
        source_claim: bool,
    ) -> Result<Option<Uuid>> {
        use crate::services::team_financial_source as source;
        let namespace = self.namespace()?;
        // Retain this already received result across brief writer contention.
        // No SQL transaction or provider request is held while waiting; a real
        // storage/long-lock failure still returns error without claiming an ACK.
        let started = std::time::Instant::now();
        let _lock = loop {
            match self.lock(false) {
                Ok(lock) => break lock,
                Err(e)
                    if e.to_string() == "financial_guard_busy"
                        && started.elapsed() < std::time::Duration::from_secs(2) =>
                {
                    std::thread::sleep(std::time::Duration::from_millis(2))
                }
                Err(e) => return Err(e),
            }
        };
        let state = self.load()?;
        // Legacy lookup completion must not manufacture a new source baseline.
        // Test current footprint under this same file lock, so a migration that
        // raced the HTTP call still retains the late result as source evidence.
        if !source_claim
            && !state
                .snapshot
                .sources
                .scopes
                .values()
                .any(|s| s.scope.account == scope.account && s.scope.live == scope.live)
        {
            return Ok(None);
        }
        let identity = customer.map(|customer| source::ProviderIdentity::Customer {
            customer: customer.into(),
        });
        let evidence_hash = crate::services::team_stripe_customer_request::result_hash(
            &scope,
            request.operation,
            &identity,
            verified,
        )?;
        let id = Uuid::new_v5(
            &namespace,
            fingerprint(&(
                &scope,
                request.operation,
                &request.request_hash,
                &evidence_hash,
            ))?
            .as_bytes(),
        );
        let prior = state
            .snapshot
            .sources
            .scopes
            .get(&scope.key()?)
            .and_then(|s| s.outcomes.get(&id));
        let outcome = source::Outcome {
            id,
            operation: request.operation,
            request_hash: request.request_hash.clone(),
            evidence_hash,
            observed_at: prior.map_or_else(Utc::now, |o| o.observed_at),
            identity,
        };
        let event = Event::FinancialSource {
            event: Box::new(if verified {
                source::Event::Outcome { scope, outcome }
            } else {
                source::Event::RejectedOutcome { scope, outcome }
            }),
        };
        let mut proposed = state.snapshot.clone();
        proposed.apply(&event)?;
        if proposed.sources != state.snapshot.sources {
            self.append(&state, event)?;
        }
        Ok(Some(id))
    }
    pub fn from_environment() -> Result<Option<Self>> {
        Self::from_settings(
            environment_setting("ATOAXIS_TEAM_FINANCIAL_GUARD_PATH")?.as_deref(),
            environment_setting("ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE")?.as_deref(),
            environment_setting("ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED")?.as_deref(),
        )
    }
    fn from_settings(
        path: Option<&str>,
        namespace: Option<&str>,
        required: Option<&str>,
    ) -> Result<Option<Self>> {
        let required = required_flag(required)?;
        match (path, namespace) {
            (None, None) => {
                ensure!(!required, "financial_guard_configuration_required");
                Ok(None)
            }
            (Some(path), Some(namespace)) => {
                let namespace = namespace
                    .parse::<Uuid>()
                    .map_err(|_| anyhow::anyhow!("financial_guard_namespace_invalid"))?;
                let guard = Self::new(PathBuf::from(path))?.pin_namespace(namespace)?;
                guard.read()?;
                Ok(Some(guard))
            }
            _ => anyhow::bail!("financial_guard_configuration_incomplete"),
        }
    }
    pub(crate) fn same_authority(&self, other: &Self) -> bool {
        self.path == other.path && self.expected_namespace == other.expected_namespace
    }
    pub fn new(path: PathBuf) -> Result<Self> {
        ensure!(
            path.is_absolute() && path.file_name().is_some(),
            "financial_guard_absolute_path_required"
        );
        let parent = path.parent().context("financial_guard_parent_required")?;
        ensure!(
            parent.is_dir(),
            "financial_guard_private_directory_required"
        );
        for p in path.ancestors().skip(1) {
            ensure!(
                !std::fs::symlink_metadata(p)?.file_type().is_symlink(),
                "financial_guard_symlink_parent"
            );
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            ensure!(
                std::fs::metadata(parent)?.permissions().mode() & 0o077 == 0,
                "financial_guard_private_directory_required"
            );
        }
        Ok(Self {
            path,
            expected_namespace: None,
            #[cfg(test)]
            sync_failures: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            #[cfg(test)]
            prepare_delay_ms: std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0)),
            #[cfg(test)]
            after_ingress_prepare: Default::default(),
        })
    }
    pub fn pin_namespace(mut self, namespace: Uuid) -> Result<Self> {
        ensure!(!namespace.is_nil(), "financial_guard_namespace_invalid");
        self.expected_namespace = Some(namespace);
        Ok(self)
    }
    pub fn namespace(&self) -> Result<Uuid> {
        self.expected_namespace
            .context("financial_guard_namespace_pin_required")
    }
    #[cfg(test)]
    pub(crate) fn environment(&self) -> TestEnvironment {
        let settings = [
            (
                "ATOAXIS_TEAM_FINANCIAL_GUARD_PATH",
                self.path.to_str().unwrap().to_owned(),
            ),
            (
                "ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE",
                self.namespace().unwrap().to_string(),
            ),
            ("ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED", "true".to_owned()),
        ];
        let previous = settings
            .iter()
            .map(|(key, _)| (*key, std::env::var_os(key)))
            .collect();
        for (key, value) in settings {
            std::env::set_var(key, value);
        }
        TestEnvironment { previous }
    }
    #[cfg(test)]
    pub(crate) fn fail_commit_confirmation_once(&self) {
        self.sync_failures
            .fetch_or(8, std::sync::atomic::Ordering::SeqCst);
    }
    #[cfg(test)]
    pub(crate) fn delay_prepare_once_ms(&self, millis: u64) {
        self.prepare_delay_ms
            .store(millis, std::sync::atomic::Ordering::SeqCst);
    }
    #[cfg(test)]
    pub(crate) fn take_prepare_delay_ms(&self) -> u64 {
        self.prepare_delay_ms
            .swap(0, std::sync::atomic::Ordering::SeqCst)
    }
    fn sync_file(&self, file: &File, _after_write: bool) -> Result<()> {
        #[cfg(test)]
        {
            use std::sync::atomic::Ordering;
            let mask = self.sync_failures.load(Ordering::SeqCst);
            if (_after_write && mask & 1 != 0) || (!_after_write && mask & 2 != 0) {
                if _after_write {
                    self.sync_failures.fetch_and(!1, Ordering::SeqCst);
                }
                anyhow::bail!("financial_guard_sync_failed");
            }
        }
        file.sync_all()?;
        Ok(())
    }
    pub(super) fn options() -> OpenOptions {
        let mut o = OpenOptions::new();
        o.read(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            o.mode(0o600);
        }
        o
    }
    pub(super) fn verify_file(path: &Path, file: &File) -> Result<()> {
        let disk = std::fs::symlink_metadata(path)?;
        let opened = file.metadata()?;
        ensure!(
            disk.is_file() && !disk.file_type().is_symlink(),
            "financial_guard_regular_file_required"
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::{MetadataExt, PermissionsExt};
            ensure!(
                disk.dev() == opened.dev()
                    && disk.ino() == opened.ino()
                    && opened.nlink() == 1
                    && opened.permissions().mode() & 0o077 == 0,
                "financial_guard_file_ownership_unconfirmed"
            );
        }
        Ok(())
    }
    fn lock_path(&self) -> PathBuf {
        let mut name = self.path.as_os_str().to_os_string();
        name.push(".lock");
        PathBuf::from(name)
    }
    fn lock(&self, initialize: bool) -> Result<File> {
        let path = self.lock_path();
        let file = if initialize {
            Self::options().create_new(true).open(&path)?
        } else {
            Self::options().open(&path)?
        };
        Self::verify_file(&path, &file)?;
        file.try_lock_exclusive().context("financial_guard_busy")?;
        Ok(file)
    }
    pub(super) fn sync_directory(&self) -> Result<()> {
        // The server currently runs on Unix. Windows must validate directory
        // durability before certifying this operational storage contract.
        #[cfg(unix)]
        {
            File::open(self.path.parent().unwrap())?.sync_all()?;
        }
        #[cfg(not(unix))]
        {
            anyhow::bail!("financial_guard_directory_durability_unavailable");
        }
        Ok(())
    }
    fn load(&self) -> Result<Read> {
        let file = Self::options().open(&self.path)?;
        Self::verify_file(&self.path, &file)?;
        ensure!(
            file.metadata()?.len() <= MAX_BYTES,
            "financial_guard_size_limit"
        );
        let mut input = BufReader::new(file);
        let mut line = Vec::new();
        let mut state = Read {
            snapshot: Snapshot::default(),
            sequence: 0,
            chain: String::new(),
        };
        loop {
            line.clear();
            // take() bounds allocation even for malformed input without newline.
            let size = std::io::Read::take(&mut input, MAX_RECORD as u64 + 1)
                .read_until(b'\n', &mut line)?;
            if size == 0 {
                break;
            }
            ensure!(
                size <= MAX_RECORD && line.last() == Some(&b'\n'),
                "financial_guard_torn_or_oversized_record"
            );
            let record: Record = serde_json::from_slice(&line)
                .map_err(|_| anyhow::anyhow!("financial_guard_record_invalid"))?;
            ensure!(
                record.body.version == 1
                    && record.body.sequence == state.sequence + 1
                    && record.body.previous == state.chain
                    && record.checksum == fingerprint(&record.body)?,
                "financial_guard_chain_invalid"
            );
            state.snapshot.apply(&record.body.event)?;
            state.sequence = record.body.sequence;
            state.chain = record.checksum;
        }
        ensure!(state.snapshot.namespace.is_some(), "financial_guard_empty");
        ensure!(
            self.expected_namespace
                .is_none_or(|n| state.snapshot.namespace == Some(n)),
            "financial_guard_namespace_mismatch"
        );
        // A complete record may remain after a failed prior fsync. Reestablish
        // durability under the lock before reads or exact retries trust that tail.
        self.sync_file(input.get_ref(), false)?;
        self.sync_directory()?;
        Ok(state)
    }
    fn append(&self, state: &Read, event: Event) -> Result<()> {
        // Validate before mutation. A partial write/fsync failure is retained and
        // makes subsequent checks fail closed; this tool never truncates it.
        let mut proposed = state.snapshot.clone();
        proposed.apply(&event)?;
        let body = Body {
            version: 1,
            sequence: state
                .sequence
                .checked_add(1)
                .context("financial_guard_sequence_overflow")?,
            previous: state.chain.clone(),
            event,
        };
        let checksum = fingerprint(&body)?;
        let record = Record { body, checksum };
        let mut bytes = serde_json::to_vec(&record)?;
        bytes.push(b'\n');
        ensure!(bytes.len() <= MAX_RECORD, "financial_guard_record_limit");
        let mut file = OpenOptions::new().append(true).open(&self.path)?;
        Self::verify_file(&self.path, &file)?;
        ensure!(
            file.metadata()?.len() + bytes.len() as u64 <= MAX_BYTES,
            "financial_guard_size_limit"
        );
        file.write_all(&bytes)?;
        self.sync_file(&file, true)?;
        #[cfg(test)]
        if matches!(record.body.event, Event::Prepare { .. }) {
            let delay = self
                .prepare_delay_ms
                .swap(0, std::sync::atomic::Ordering::SeqCst);
            std::thread::sleep(std::time::Duration::from_millis(delay));
        }
        Ok(())
    }
    /// Explicit operator initialization using a reviewed roster. This never scans
    /// a potentially restored database and labels unknown organizations legacy.
    pub fn initialize(&self, namespace: Uuid, legacy_organizations: Vec<Uuid>) -> Result<()> {
        ensure!(!self.path.exists(), "financial_guard_already_exists");
        let _lock = self.lock(true)?;
        let event = Event::Initialize {
            namespace,
            created_at: Utc::now(),
            legacy_organizations,
        };
        let mut snapshot = Snapshot::default();
        snapshot.apply(&event)?;
        let body = Body {
            version: 1,
            sequence: 1,
            previous: String::new(),
            event,
        };
        let record = Record {
            checksum: fingerprint(&body)?,
            body,
        };
        let mut bytes = serde_json::to_vec(&record)?;
        bytes.push(b'\n');
        ensure!(bytes.len() <= MAX_RECORD, "financial_guard_record_limit");
        let mut file = Self::options().create_new(true).open(&self.path)?;
        file.write_all(&bytes)?;
        self.sync_file(&file, true)?;
        self.sync_directory()?;
        Ok(())
    }
    pub fn read(&self) -> Result<Read> {
        let _lock = self.lock(false)?;
        self.load()
    }
    pub fn register_legacy(&self, organization: Uuid) -> Result<()> {
        ensure!(
            self.expected_namespace.is_some(),
            "financial_guard_namespace_pin_required"
        );
        let _lock = self.lock(false)?;
        let state = self.load()?;
        self.append(&state, Event::RegisterLegacy { organization })
    }
    /// Caller holds organization billing/entitlement locks and invokes this only
    /// at its final commit boundary. No DB request may execute under this file lock.
    pub fn prepare(&self, organization: Uuid, expected: Head, transition: Pending) -> Result<()> {
        ensure!(
            self.expected_namespace.is_some(),
            "financial_guard_namespace_pin_required"
        );
        let _lock = self.lock(false)?;
        let state = self.load()?;
        state.snapshot.transactions.fence(&Event::Prepare {
            organization,
            expected: expected.clone(),
            transition: transition.clone(),
        })?;
        if let Some(entry) = state.snapshot.organizations.get(&organization) {
            if entry.head == expected && entry.pending.as_ref() == Some(&transition) {
                return Ok(());
            }
        }
        self.append(
            &state,
            Event::Prepare {
                organization,
                expected,
                transition,
            },
        )
    }
    /// A successful DB commit/readback of this exact proposal is necessary. An
    /// external-ahead proposal alone cannot recreate payment or grant access.
    pub fn confirm_committed(
        &self,
        organization: Uuid,
        transition_id: Uuid,
        observed: &State,
    ) -> Result<()> {
        ensure!(
            self.expected_namespace.is_some(),
            "financial_guard_namespace_pin_required"
        );
        let _lock = self.lock(false)?;
        let state = self.load()?;
        state.snapshot.transactions.fence(&Event::Commit {
            organization,
            transition_id,
        })?;
        let entry = state
            .snapshot
            .organizations
            .get(&organization)
            .context("financial_guard_unknown_organization")?;
        if entry.pending.is_none()
            && entry.committed_transition_id == Some(transition_id)
            && entry.head
                == (Head::Enrolled {
                    state: observed.clone().into(),
                })
        {
            return Ok(());
        }
        let pending = entry
            .pending
            .as_ref()
            .context("financial_guard_no_pending_transition")?;
        ensure!(
            pending.transition_id == transition_id && pending.state.as_ref() == observed,
            "financial_guard_commit_readback_mismatch"
        );
        #[cfg(test)]
        {
            use std::sync::atomic::Ordering;
            if self.sync_failures.fetch_and(!8, Ordering::SeqCst) & 8 != 0 {
                anyhow::bail!("financial_guard_commit_confirmation_interrupted");
            }
        }
        self.append(
            &state,
            Event::Commit {
                organization,
                transition_id,
            },
        )
    }
    /// Emergency file-only closure. It blocks subsequent verified reads, but an
    /// already in-flight SQL admission may still commit. Normal administrative
    /// closure must use the repository coordinator and its billing lock.
    pub fn quarantine(&self, organization: Uuid) -> Result<()> {
        ensure!(
            self.expected_namespace.is_some(),
            "financial_guard_namespace_pin_required"
        );
        let _lock = self.lock(false)?;
        let state = self.load()?;
        if state
            .snapshot
            .organizations
            .get(&organization)
            .is_some_and(|entry| entry.head == Head::Quarantined)
        {
            return Ok(());
        }
        self.append(&state, Event::Quarantine { organization })
    }
}

#[cfg(test)]
pub(crate) struct TestLedger {
    pub guard: FinancialGuard,
    root: PathBuf,
}

#[cfg(test)]
#[path = "team_financial_transaction_tests.rs"]
mod transaction_tests;
#[cfg(test)]
impl TestLedger {
    pub(crate) fn path(&self) -> &Path {
        &self.guard.path
    }
    pub fn deployment(&self) -> CommercialDeployment {
        CommercialDeployment::for_test(self.guard.clone()).unwrap()
    }
    pub fn new(organizations: &[Uuid]) -> Self {
        let root = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("atoaxis-runtime-financial-{}", Uuid::now_v7()));
        std::fs::create_dir(&root).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        let namespace = Uuid::now_v7();
        let guard = FinancialGuard::new(root.join("ledger.jsonl")).unwrap();
        guard.initialize(namespace, organizations.to_vec()).unwrap();
        let guard = guard.pin_namespace(namespace).unwrap();
        Self { guard, root }
    }
    /// Explicit synthetic enrollment; never used by runtime or live evidence.
    pub fn enrolled(org: Uuid, state: &crate::services::team_analytics_entitlement::State) -> Self {
        let fixture = Self::new(&[org]);
        let id = Uuid::now_v7();
        fixture
            .guard
            .prepare(
                org,
                Head::Legacy,
                Pending {
                    transition_id: id,
                    state: Box::new(state.clone()),
                },
            )
            .unwrap();
        fixture.guard.confirm_committed(org, id, state).unwrap();
        fixture
    }
    pub fn environment(&self) -> TestEnvironment {
        self.guard.environment()
    }
}
#[cfg(test)]
impl Drop for TestLedger {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.root).unwrap();
    }
}

#[cfg(test)]
pub(crate) struct TestEnvironment {
    previous: Vec<(&'static str, Option<std::ffi::OsString>)>,
}
#[cfg(test)]
impl Drop for TestEnvironment {
    fn drop(&mut self) {
        for (key, value) in &self.previous {
            if let Some(value) = value {
                std::env::set_var(key, value);
            } else {
                std::env::remove_var(key);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture {
        root: PathBuf,
        guard: FinancialGuard,
        org: Uuid,
    }
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir()
                .canonicalize()
                .unwrap()
                .join(format!("atoaxis-financial-guard-{}", Uuid::now_v7()));
            std::fs::create_dir(&root).unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
            }
            let guard = FinancialGuard::new(root.join("enrollment.jsonl")).unwrap();
            let org = Uuid::now_v7();
            let namespace = Uuid::now_v7();
            guard.initialize(namespace, vec![org]).unwrap();
            let guard = guard.pin_namespace(namespace).unwrap();
            Self { root, guard, org }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.root).unwrap();
        }
    }
    #[test]
    fn legacy_ingress_confirm_checksum_survives_new_optional_review_field() {
        use crate::services::team_financial_ingress as ingress;
        #[derive(Serialize)]
        #[serde(tag = "action", rename_all = "snake_case")]
        enum OldIngress {
            Confirm {
                scope: ingress::Scope,
                transition: Uuid,
                head: ingress::Head,
            },
        }
        #[derive(Serialize)]
        #[serde(tag = "kind", rename_all = "snake_case")]
        enum OldOuter {
            FinancialIngress { event: OldIngress },
        }
        #[derive(Serialize)]
        struct OldBody {
            version: u8,
            sequence: u64,
            previous: String,
            event: OldOuter,
        }
        #[derive(Serialize)]
        struct OldRecord {
            body: OldBody,
            checksum: String,
        }
        let f = Fixture::new();
        let (scope, _, receipt) = ingress::tests::fixture();
        f.guard
            .record_ingress(ingress::Event::Seed {
                scope: scope.clone(),
                receipts: vec![],
                review: Uuid::now_v7(),
                review_hash: "a".repeat(64),
            })
            .unwrap();
        let p = f
            .guard
            .read()
            .unwrap()
            .snapshot
            .ingress
            .entry(&scope)
            .unwrap()
            .propose(receipt.clone())
            .unwrap();
        f.guard
            .record_ingress(ingress::Event::Prepare {
                scope: scope.clone(),
                proposal: p.clone(),
            })
            .unwrap();
        let prior = f.guard.read().unwrap();
        let body = OldBody {
            version: 1,
            sequence: prior.sequence + 1,
            previous: prior.chain,
            event: OldOuter::FinancialIngress {
                event: OldIngress::Confirm {
                    scope: scope.clone(),
                    transition: receipt.transition,
                    head: p.next,
                },
            },
        };
        let checksum = fingerprint(&body).unwrap();
        let mut bytes = serde_json::to_vec(&OldRecord { body, checksum }).unwrap();
        bytes.push(b'\n');
        assert!(!String::from_utf8_lossy(&bytes).contains("review"));
        let mut file = OpenOptions::new().append(true).open(&f.guard.path).unwrap();
        file.write_all(&bytes).unwrap();
        file.sync_all().unwrap();
        let restored = f.guard.read().unwrap();
        assert_eq!(
            restored.snapshot.ingress.entry(&scope).unwrap().receipts["evt_ingress"],
            receipt
        );
    }
    fn source_seed(
        f: &Fixture,
    ) -> (
        crate::services::team_financial_source::Scope,
        crate::services::team_financial_source::Root,
        crate::services::team_financial_source::Event,
    ) {
        use crate::services::team_financial_source::*;
        let scope = Scope {
            organization: f.org,
            account: "acct_source_fixture".into(),
            live: false,
        };
        let root = Root::empty(&scope).unwrap();
        let seed = Event::Seed {
            scope: scope.clone(),
            head: root.clone(),
            review: Review {
                id: Uuid::now_v7(),
                kind: ReviewKind::ReviewedEmpty,
                evidence_hash: "a".repeat(64),
                reviewed_at: Utc::now(),
            },
            accepted: vec![],
        };
        (scope, root, seed)
    }
    #[test]
    fn source_journal_replay_exact_retry_and_closure_preserve_external_outcomes() {
        use crate::services::team_financial_source::*;
        let f = Fixture::new();
        let enrollment = f.guard.read().unwrap().organization_token(f.org).unwrap();
        let (scope, root, seed) = source_seed(&f);
        f.guard.record_source(seed).unwrap();
        let before = f.guard.read().unwrap().source_token(&scope).unwrap();
        let request = AcceptedRequest {
            operation: Uuid::now_v7(),
            kind: OperationKind::CreateCustomer,
            actor: Uuid::now_v7(),
            request_hash: "b".repeat(64),
            idempotency_hash: "c".repeat(64),
            accepted_at: Utc::now(),
        };
        let next = Root {
            schema: 1,
            revision: 2,
            records: 1,
            hash: "d".repeat(64),
        };
        let transition = Transition {
            id: Uuid::now_v7(),
            next: next.clone(),
            change_hash: "e".repeat(64),
            accepted: vec![request.clone()],
            resolved_outcomes: Default::default(),
        };
        let prepare = Event::Prepare {
            scope: scope.clone(),
            expected: root.clone(),
            transition: transition.clone(),
        };
        f.guard.record_source(prepare.clone()).unwrap();
        let sequence = f.guard.read().unwrap().sequence;
        f.guard.record_source(prepare).unwrap();
        assert_eq!(f.guard.read().unwrap().sequence, sequence);
        let restarted = FinancialGuard::new(f.guard.path.clone())
            .unwrap()
            .pin_namespace(f.guard.namespace().unwrap())
            .unwrap();
        assert!(restarted
            .read()
            .unwrap()
            .snapshot
            .sources
            .verify(&scope, &root)
            .is_err());
        let commit = Event::Commit {
            scope: scope.clone(),
            transition: transition.id,
        };
        restarted.record_source(commit.clone()).unwrap();
        let sequence = restarted.read().unwrap().sequence;
        restarted.record_source(commit).unwrap();
        assert_eq!(restarted.read().unwrap().sequence, sequence);
        let dispatch = Dispatch {
            operation: request.operation,
            request_hash: request.request_hash.clone(),
            idempotency_hash: request.idempotency_hash.clone(),
            first_attempt_at: Utc::now(),
        };
        restarted
            .record_source(Event::Dispatch {
                scope: scope.clone(),
                dispatch: dispatch.clone(),
            })
            .unwrap();
        let outcome = Outcome {
            id: Uuid::now_v7(),
            operation: request.operation,
            request_hash: request.request_hash.clone(),
            evidence_hash: "f".repeat(64),
            observed_at: Utc::now(),
            identity: Some(ProviderIdentity::Customer {
                customer: "cus_retained".into(),
            }),
        };
        restarted
            .record_source(Event::Outcome {
                scope: scope.clone(),
                outcome: outcome.clone(),
            })
            .unwrap();
        let state = restarted.read().unwrap();
        assert_ne!(state.source_token(&scope).unwrap(), before);
        assert_eq!(
            state.organization_token(f.org).unwrap(),
            enrollment,
            "source changes have a distinct fence"
        );
        assert!(state.snapshot.sources.verify(&scope, &next).is_err());
        assert_eq!(
            state.snapshot.sources.scopes[&scope.key().unwrap()].dispatches[&request.operation],
            dispatch
        );
        assert_eq!(
            state.snapshot.sources.scopes[&scope.key().unwrap()].outcomes[&outcome.id],
            outcome
        );
        restarted.quarantine(f.org).unwrap();
        assert!(restarted
            .record_source(Event::Dispatch {
                scope: scope.clone(),
                dispatch
            })
            .is_err());
        let mut late = outcome.clone();
        late.id = Uuid::now_v7();
        restarted
            .record_source(Event::Outcome {
                scope: scope.clone(),
                outcome: late,
            })
            .unwrap();
        let entry = &restarted.read().unwrap().snapshot.sources.scopes[&scope.key().unwrap()];
        assert!(entry.frozen.contains(&FreezeReason::OrganizationClosed));
        assert_eq!(entry.outcomes.len(), 2);
    }
    #[test]
    fn source_prepare_fsync_failure_unknown_scope_and_namespace_fail_closed() {
        use crate::services::team_financial_source::*;
        use std::sync::atomic::Ordering;
        let f = Fixture::new();
        assert!(
            f.guard.read().unwrap().snapshot.sources.scopes.is_empty(),
            "old journal has no inferred financial baseline"
        );
        let (scope, root, seed) = source_seed(&f);
        f.guard.record_source(seed).unwrap();
        let transition = Transition {
            id: Uuid::now_v7(),
            next: Root {
                schema: 1,
                revision: 2,
                records: 0,
                hash: "b".repeat(64),
            },
            change_hash: "c".repeat(64),
            accepted: vec![],
            resolved_outcomes: Default::default(),
        };
        let event = Event::Prepare {
            scope: scope.clone(),
            expected: root.clone(),
            transition: transition.clone(),
        };
        f.guard.sync_failures.store(1, Ordering::SeqCst);
        assert!(f.guard.record_source(event.clone()).is_err());
        assert!(f
            .guard
            .read()
            .unwrap()
            .snapshot
            .sources
            .verify(&scope, &root)
            .is_err());
        f.guard.record_source(event).unwrap();
        f.guard
            .record_source(Event::Commit {
                scope: scope.clone(),
                transition: transition.id,
            })
            .unwrap();
        f.guard
            .read()
            .unwrap()
            .snapshot
            .sources
            .verify(&scope, &transition.next)
            .unwrap();
        let bytes = std::fs::read(&f.guard.path).unwrap();
        let wrong = f.guard.clone().pin_namespace(Uuid::now_v7()).unwrap();
        assert!(wrong
            .record_source(Event::Freeze {
                scope: scope.clone(),
                reason: FreezeReason::OperatorRequested
            })
            .is_err());
        assert_eq!(std::fs::read(&f.guard.path).unwrap(), bytes);
        let unknown = Scope {
            organization: Uuid::now_v7(),
            account: scope.account.clone(),
            live: true,
        };
        let observation = Outcome {
            id: Uuid::now_v7(),
            operation: Uuid::now_v7(),
            request_hash: "d".repeat(64),
            evidence_hash: "e".repeat(64),
            observed_at: Utc::now(),
            identity: None,
        };
        f.guard
            .record_source(Event::Outcome {
                scope: unknown.clone(),
                outcome: observation,
            })
            .unwrap();
        let read = f.guard.read().unwrap();
        assert!(!read
            .snapshot
            .organizations
            .contains_key(&unknown.organization));
        assert!(read.snapshot.sources.scopes[&unknown.key().unwrap()]
            .frozen
            .contains(&FreezeReason::OrganizationUnconfirmed));
        assert!(read
            .snapshot
            .sources
            .verify(&unknown, &Root::empty(&unknown).unwrap())
            .is_err());
    }
    #[test]
    fn append_response_loss_exact_retry_and_restore_mismatch() {
        let f = Fixture::new();
        let state = State::trial(10, Utc::now()).unwrap();
        let transition = Pending {
            transition_id: Uuid::now_v7(),
            state: state.clone().into(),
        };
        f.guard
            .prepare(f.org, Head::Legacy, transition.clone())
            .unwrap();
        let pending = f.guard.read().unwrap();
        let sequence = pending.sequence;
        assert!(pending.snapshot.verify(f.org, None).is_err());
        assert!(pending.snapshot.verify(f.org, Some(&state)).is_err());
        f.guard
            .prepare(f.org, Head::Legacy, transition.clone())
            .unwrap();
        assert_eq!(f.guard.read().unwrap().sequence, sequence);
        assert!(f
            .guard
            .confirm_committed(f.org, Uuid::now_v7(), &state)
            .is_err());
        f.guard
            .confirm_committed(f.org, transition.transition_id, &state)
            .unwrap();
        f.guard
            .confirm_committed(f.org, transition.transition_id, &state)
            .unwrap();
        assert!(f
            .guard
            .confirm_committed(f.org, Uuid::now_v7(), &state)
            .is_err());
        let committed = f.guard.read().unwrap();
        assert!(committed.snapshot.verify(f.org, Some(&state)).is_ok());
        assert!(committed.snapshot.verify(f.org, None).is_err());
        assert!(f.guard.initialize(Uuid::now_v7(), vec![]).is_err());
    }
    #[test]
    fn torn_checksum_reordered_and_missing_files_never_repaired() {
        let f = Fixture::new();
        let original = std::fs::read(&f.guard.path).unwrap();
        for bytes in [
            original[..original.len() - 1].to_vec(),
            [original.clone(), b"broken\n".to_vec()].concat(),
            [original.clone(), original.clone()].concat(),
        ] {
            std::fs::write(&f.guard.path, &bytes).unwrap();
            assert!(f.guard.read().is_err());
            assert_eq!(std::fs::read(&f.guard.path).unwrap(), bytes);
        }
        std::fs::write(&f.guard.path, &original).unwrap();
        let mut value: serde_json::Value = serde_json::from_slice(&original).unwrap();
        value["checksum"] = serde_json::json!("0".repeat(64));
        let mut bytes = serde_json::to_vec(&value).unwrap();
        bytes.push(b'\n');
        std::fs::write(&f.guard.path, &bytes).unwrap();
        assert!(f.guard.read().is_err());
        std::fs::remove_file(&f.guard.path).unwrap();
        assert!(f.guard.read().is_err());
        assert!(!f.guard.path.exists());
    }
    #[test]
    fn file_lock_unknown_scope_and_other_organization_token() {
        let f = Fixture::new();
        let before = f.guard.read().unwrap().organization_token(f.org).unwrap();
        assert!(f
            .guard
            .read()
            .unwrap()
            .organization_token(Uuid::now_v7())
            .is_err());
        let held = f.guard.lock(false).unwrap();
        assert!(f.guard.read().is_err());
        drop(held);
        f.guard.register_legacy(Uuid::now_v7()).unwrap();
        assert_eq!(
            before,
            f.guard.read().unwrap().organization_token(f.org).unwrap()
        );
        f.guard.quarantine(f.org).unwrap();
        assert!(f
            .guard
            .read()
            .unwrap()
            .snapshot
            .verify(f.org, None)
            .is_err());
    }
    #[cfg(unix)]
    #[test]
    fn symlink_and_permissive_directory_rejected() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let f = Fixture::new();
        let alias = f.root.join("alias");
        symlink(&f.guard.path, &alias).unwrap();
        let alias_guard = FinancialGuard::new(alias).unwrap();
        assert!(alias_guard.initialize(Uuid::now_v7(), vec![]).is_err());
        assert!(alias_guard.read().is_err());
        std::fs::set_permissions(&f.root, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(FinancialGuard::new(f.guard.path.clone()).is_err());
    }
    #[test]
    fn concurrent_organizations_keep_both_proposals_and_one_same_org_winner() {
        let f = Fixture::new();
        let other = Uuid::now_v7();
        f.guard.register_legacy(other).unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let mut workers = Vec::new();
        for org in [f.org, other] {
            let guard = f.guard.clone();
            let b = barrier.clone();
            let proposed = Pending {
                transition_id: Uuid::now_v7(),
                state: State::trial(10, Utc::now()).unwrap().into(),
            };
            workers.push(std::thread::spawn(move || {
                b.wait();
                for _ in 0..100 {
                    if guard.prepare(org, Head::Legacy, proposed.clone()).is_ok() {
                        return;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(1));
                }
                panic!("independent concurrent proposal must eventually persist");
            }));
        }
        for w in workers {
            w.join().unwrap();
        }
        let saved = f.guard.read().unwrap();
        assert!(saved
            .snapshot
            .organizations
            .values()
            .all(|e| e.pending.is_some()));
        assert_eq!(saved.sequence, 4);
        let fresh = Uuid::now_v7();
        f.guard.register_legacy(fresh).unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let mut workers = Vec::new();
        for _ in 0..2 {
            let guard = f.guard.clone();
            let b = barrier.clone();
            workers.push(std::thread::spawn(move || {
                b.wait();
                guard
                    .prepare(
                        fresh,
                        Head::Legacy,
                        Pending {
                            transition_id: Uuid::now_v7(),
                            state: State::trial(10, Utc::now()).unwrap().into(),
                        },
                    )
                    .is_ok()
            }));
        }
        let winners = workers
            .into_iter()
            .map(|w| usize::from(w.join().unwrap()))
            .sum::<usize>();
        assert_eq!(winners, 1);
    }
    #[test]
    fn complete_tail_after_failed_fsync_requires_successful_durability_retry() {
        use std::sync::atomic::Ordering;
        let f = Fixture::new();
        let state = State::trial(10, Utc::now()).unwrap();
        let p = Pending {
            transition_id: Uuid::now_v7(),
            state: state.clone().into(),
        };
        f.guard.sync_failures.store(1, Ordering::SeqCst);
        assert!(f.guard.prepare(f.org, Head::Legacy, p.clone()).is_err());
        f.guard.sync_failures.store(2, Ordering::SeqCst);
        assert!(f.guard.read().is_err());
        assert!(f.guard.prepare(f.org, Head::Legacy, p.clone()).is_err());
        f.guard.sync_failures.store(0, Ordering::SeqCst);
        f.guard.prepare(f.org, Head::Legacy, p.clone()).unwrap();
        f.guard.sync_failures.store(1, Ordering::SeqCst);
        assert!(f
            .guard
            .confirm_committed(f.org, p.transition_id, &state)
            .is_err());
        f.guard.sync_failures.store(2, Ordering::SeqCst);
        assert!(f.guard.read().is_err());
        assert!(f
            .guard
            .confirm_committed(f.org, p.transition_id, &state)
            .is_err());
        f.guard.sync_failures.store(0, Ordering::SeqCst);
        f.guard
            .confirm_committed(f.org, p.transition_id, &state)
            .unwrap();
        assert_eq!(f.guard.read().unwrap().sequence, 3);
        assert!(f
            .guard
            .clone()
            .pin_namespace(Uuid::now_v7())
            .unwrap()
            .read()
            .is_err());
    }
    #[test]
    fn configuration_required_is_independent_of_database_contents() {
        assert!(FinancialGuard::from_settings(None, None, None)
            .unwrap()
            .is_none());
        assert!(FinancialGuard::from_settings(None, None, Some("true")).is_err());
        assert!(FinancialGuard::from_settings(None, None, Some("yes")).is_err());
        assert!(FinancialGuard::from_settings(Some("/private/missing"), None, None).is_err());
        let f = Fixture::new();
        let namespace = f.guard.namespace().unwrap().to_string();
        let path = f.guard.path.to_str().unwrap();
        assert!(
            FinancialGuard::from_settings(Some(path), Some(&namespace), Some("true"))
                .unwrap()
                .is_some()
        );
        assert!(
            FinancialGuard::from_settings(Some(path), Some(&Uuid::now_v7().to_string()), None)
                .is_err()
        );
    }
    #[test]
    fn commercial_capability_requires_explicit_deployment_and_valid_independent_ledger() {
        for flag in [None, Some("0"), Some("false")] {
            assert!(CommercialDeployment::from_settings(None, None, flag)
                .unwrap()
                .is_none());
        }
        for flag in [Some("true"), Some("1"), Some("yes"), Some("")] {
            assert!(CommercialDeployment::from_settings(None, None, flag).is_err());
        }
        let fixture = Fixture::new();
        let namespace = fixture.guard.namespace().unwrap().to_string();
        let path = fixture.guard.path.to_str().unwrap();
        for flag in [None, Some("0"), Some("false")] {
            assert!(
                CommercialDeployment::from_settings(Some(path), Some(&namespace), flag)
                    .unwrap()
                    .is_none()
            );
        }
        for flag in ["true", "1"] {
            let cap = CommercialDeployment::from_settings(Some(path), Some(&namespace), Some(flag))
                .unwrap()
                .unwrap();
            assert!(cap.guard().same_authority(&fixture.guard));
        }
        assert!(CommercialDeployment::from_settings(Some(path), None, Some("false")).is_err());
        assert!(CommercialDeployment::from_settings(
            Some(path),
            Some(&Uuid::now_v7().to_string()),
            Some("true")
        )
        .is_err());
        let missing = fixture
            .guard
            .path
            .parent()
            .unwrap()
            .join("not-initialized.jsonl");
        assert!(CommercialDeployment::from_settings(
            missing.to_str(),
            Some(&namespace),
            Some("true")
        )
        .is_err());
        assert!(
            !missing.exists(),
            "deployment verification never initializes evidence"
        );
    }
}
