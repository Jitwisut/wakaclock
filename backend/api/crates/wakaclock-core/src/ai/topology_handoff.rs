//! F7 remote/container/cloud collector handoff contract.
//!
//! A topology context identifies where a mutation was observed.  This module
//! defines the next boundary: how a collector registers an authenticated
//! handoff, how accepted metadata survives disconnect/teardown, and how two
//! collectors prove that they saw the same mutation.  It intentionally does not
//! open sockets or persist secrets.  The CLI/server layers own transport and can
//! persist [`HandoffLedger::snapshot`] through the existing durable queue.
//!
//! The deduplication rule is deliberately narrow.  An event id is enough when
//! both producers share it.  Otherwise a producer must provide an explicit
//! operation id plus a per-file mutation id.  Path, timestamp, line count,
//! process name, and commit author are never aliases for a file mutation.

use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use super::{
    event::is_safe_event_id,
    topology::{ExecutionSurface, TopologyContext, TopologyError},
};

/// Version of the collector-to-collector handoff contract.  This remains local
/// until F8 negotiates an additive broker/server wire version.
pub const TOPOLOGY_HANDOFF_SCHEMA_VERSION: u8 = 1;
const MAX_LABEL_BYTES: usize = 128;

/// Return the only transport allowed for a topology execution surface.  Keeping
/// this mapping in core means CLI, extension and future cloud adapters cannot
/// accidentally downgrade a remote collector to an unauthenticated loopback.
pub fn transport_for_topology(
    topology: &TopologyContext,
) -> Result<CollectorTransport, HandoffError> {
    topology.validate().map_err(HandoffError::Topology)?;
    Ok(match topology.execution {
        ExecutionSurface::Local => CollectorTransport::LoopbackBroker,
        ExecutionSurface::SshRemote
        | ExecutionSurface::Wsl
        | ExecutionSurface::DevContainer
        | ExecutionSurface::RemoteExtensionHost => CollectorTransport::AuthenticatedBridge,
        ExecutionSurface::CloudJob => CollectorTransport::CloudJobCallback,
        ExecutionSurface::Unknown => {
            return Err(HandoffError::UnknownExecutionSurface);
        }
    })
}

/// Derive a stable opaque collector identity from the topology scope.  No path,
/// hostname, repository name or credential is included in the returned label.
pub fn collector_id_for(topology: &TopologyContext) -> Result<String, HandoffError> {
    topology.validate().map_err(HandoffError::Topology)?;
    let material = format!(
        "{}|{}|{}",
        topology.device_id, topology.workspace_id, topology.worktree_id
    );
    Ok(format!(
        "collector:{}",
        Uuid::new_v5(&Uuid::NAMESPACE_URL, material.as_bytes())
    ))
}

/// Transport that carries metadata from the collector to the local broker or
/// authenticated API bridge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollectorTransport {
    /// The collector and broker share one runtime boundary (including WSL or a
    /// dev container when the broker is installed inside that runtime).
    LoopbackBroker,
    /// A remote extension/SSH/WSL/container collector uses an approved bridge;
    /// no public unauthenticated local broker endpoint is implied.
    AuthenticatedBridge,
    /// A cloud job sends tool-level metadata through an authenticated callback.
    CloudJobCallback,
}

/// Collector lifecycle.  Disconnection and draining retain accepted events so a
/// restart can replay them; only an explicit retirement after an empty queue drops
/// the registration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollectorLifecycle {
    Active,
    Disconnected,
    Draining,
    Retired,
}

/// Capabilities describe what the collector can actually observe.  They are
/// descriptive and never promote a generic editor change to an AI file edit.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectorCapabilities {
    #[serde(default)]
    pub file_mutations: bool,
    #[serde(default)]
    pub transcripts: bool,
    #[serde(default)]
    pub editor_observations: bool,
}

/// Registration metadata for one collector instance.  All ids are opaque
/// labels; credentials themselves never belong in this structure or its JSON.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectorRegistration {
    pub schema_version: u8,
    pub collector_id: String,
    #[serde(default)]
    pub bridge_id: Option<String>,
    pub boot_id: String,
    pub topology: TopologyContext,
    pub transport: CollectorTransport,
    pub capabilities: CollectorCapabilities,
}

impl CollectorRegistration {
    /// Build a registration using the transport boundary implied by the
    /// topology. `bridge_id` is an opaque reference to the authenticated bridge
    /// or callback key; the credential itself is owned by the transport layer.
    pub fn for_topology(
        topology: TopologyContext,
        bridge_id: Option<String>,
        boot_id: impl Into<String>,
        capabilities: CollectorCapabilities,
    ) -> Result<Self, HandoffError> {
        let collector_id = collector_id_for(&topology)?;
        let transport = transport_for_topology(&topology)?;
        Self::new(
            collector_id,
            bridge_id,
            boot_id,
            topology,
            transport,
            capabilities,
        )
    }

    pub fn new(
        collector_id: impl Into<String>,
        bridge_id: Option<String>,
        boot_id: impl Into<String>,
        topology: TopologyContext,
        transport: CollectorTransport,
        capabilities: CollectorCapabilities,
    ) -> Result<Self, HandoffError> {
        let registration = Self {
            schema_version: TOPOLOGY_HANDOFF_SCHEMA_VERSION,
            collector_id: collector_id.into(),
            bridge_id,
            boot_id: boot_id.into(),
            topology,
            transport,
            capabilities,
        };
        registration.validate()?;
        Ok(registration)
    }

    pub fn validate(&self) -> Result<(), HandoffError> {
        if self.schema_version != TOPOLOGY_HANDOFF_SCHEMA_VERSION {
            return Err(HandoffError::UnsupportedSchema(self.schema_version));
        }
        validate_label("collector_id", &self.collector_id)?;
        validate_label("boot_id", &self.boot_id)?;
        self.topology.validate().map_err(HandoffError::Topology)?;

        match self.transport {
            CollectorTransport::LoopbackBroker => {
                if matches!(self.topology.execution, ExecutionSurface::CloudJob) {
                    return Err(HandoffError::TransportMismatch {
                        transport: self.transport,
                        surface: self.topology.execution,
                    });
                }
            }
            CollectorTransport::AuthenticatedBridge => {
                let supported = matches!(
                    self.topology.execution,
                    ExecutionSurface::SshRemote
                        | ExecutionSurface::Wsl
                        | ExecutionSurface::DevContainer
                        | ExecutionSurface::RemoteExtensionHost
                );
                if !supported {
                    return Err(HandoffError::TransportMismatch {
                        transport: self.transport,
                        surface: self.topology.execution,
                    });
                }
                require_label("bridge_id", self.bridge_id.as_deref())?;
            }
            CollectorTransport::CloudJobCallback => {
                if !matches!(self.topology.execution, ExecutionSurface::CloudJob) {
                    return Err(HandoffError::TransportMismatch {
                        transport: self.transport,
                        surface: self.topology.execution,
                    });
                }
                require_label("bridge_id", self.bridge_id.as_deref())?;
            }
        }
        Ok(())
    }

    fn same_workspace_scope(&self, other: &Self) -> bool {
        self.topology.device_id == other.topology.device_id
            && self.topology.workspace_id == other.topology.workspace_id
            && self.topology.worktree_id == other.topology.worktree_id
    }
}

/// Exact producer identity for one file mutation.  `mutation_id` is a producer
/// supplied version/operation proof, not a hash guessed from a path or timestamp.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HandoffEventIdentity {
    pub event_id: String,
    #[serde(default)]
    pub operation_id: Option<String>,
    #[serde(default)]
    pub mutation_id: Option<String>,
    /// Stable mutation namespace. Producers should use an opaque repository or
    /// job scope so reused tool/file ids in another workspace cannot collide.
    #[serde(default)]
    pub scope_id: Option<String>,
}

impl HandoffEventIdentity {
    pub fn validate(&self) -> Result<(), HandoffError> {
        if !is_safe_event_id(&self.event_id) {
            return Err(HandoffError::InvalidLabel { field: "event_id" });
        }
        validate_optional_label("operation_id", self.operation_id.as_deref())?;
        validate_optional_label("mutation_id", self.mutation_id.as_deref())?;
        validate_optional_label("scope_id", self.scope_id.as_deref())?;
        Ok(())
    }

    fn dedup_key(&self) -> String {
        match (&self.operation_id, &self.mutation_id) {
            (Some(operation), Some(mutation)) => match self.scope_id.as_deref() {
                Some(scope) => format!("proof:{scope}:{operation}:{mutation}"),
                // Preserve the pre-scope snapshot key for older local ledgers.
                None => format!("proof:{operation}:{mutation}"),
            },
            _ => match self.scope_id.as_deref() {
                Some(scope) => format!("event:{scope}:{}", self.event_id),
                None => format!("event:{}", self.event_id),
            },
        }
    }
}

/// Metadata received from a collector.  The ledger orders receipts by local
/// acceptance, never by `occurred_at`, so clock skew cannot reorder or discard an
/// event.  Timestamps remain useful to the canonical timeline once delivered.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HandoffEvent {
    pub identity: HandoffEventIdentity,
    pub source_sequence: u64,
    pub occurred_at: DateTime<Utc>,
}

impl HandoffEvent {
    pub fn validate(&self) -> Result<(), HandoffError> {
        self.identity.validate()?;
        if self.source_sequence == 0 {
            return Err(HandoffError::InvalidSequence);
        }
        Ok(())
    }
}

/// One accepted event awaiting transport acknowledgement.  This is metadata
/// only; the actual broker payload remains in the existing durable heartbeat
/// queue and is not duplicated here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PendingHandoff {
    pub receipt_id: u64,
    pub collector_id: String,
    pub identity: HandoffEventIdentity,
    pub source_sequence: u64,
    pub occurred_at: DateTime<Utc>,
    pub dedup_key: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandoffIngestOutcome {
    Accepted { receipt_id: u64 },
    Duplicate { receipt_id: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CollectorState {
    registration: CollectorRegistration,
    lifecycle: CollectorLifecycle,
    /// Source ordering is per boot. Reconnect resets it when a runtime restarts;
    /// duplicate identities are checked before this cursor.
    #[serde(default)]
    last_source_sequence: u64,
}

/// In-memory view of a durable handoff journal.  Callers persist the serialized
/// snapshot beside the broker queue; restoring it keeps accepted-but-unacked
/// receipts and dedup aliases across process/container restart.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HandoffLedger {
    collectors: BTreeMap<String, CollectorState>,
    seen: BTreeMap<String, u64>,
    #[serde(default)]
    acknowledged_at: BTreeMap<String, DateTime<Utc>>,
    pending: BTreeMap<u64, PendingHandoff>,
    next_receipt_id: u64,
}

impl HandoffLedger {
    pub fn register(&mut self, registration: CollectorRegistration) -> Result<(), HandoffError> {
        registration.validate()?;
        if let Some(existing) = self.collectors.get(&registration.collector_id) {
            if existing.registration == registration {
                return Ok(());
            }
            return Err(HandoffError::CollectorConflict {
                collector_id: registration.collector_id,
            });
        }
        self.collectors.insert(
            registration.collector_id.clone(),
            CollectorState {
                registration,
                lifecycle: CollectorLifecycle::Active,
                last_source_sequence: 0,
            },
        );
        Ok(())
    }

    /// Reconnect a collector after a process/VM/container restart.  The boot and
    /// session ids may change, but device/workspace/worktree scope must remain
    /// explicit so a new clone cannot inherit an old queue.
    pub fn reconnect(&mut self, registration: CollectorRegistration) -> Result<(), HandoffError> {
        registration.validate()?;
        let Some(existing) = self.collectors.get_mut(&registration.collector_id) else {
            return Err(HandoffError::UnknownCollector(registration.collector_id));
        };
        if !existing.registration.same_workspace_scope(&registration) {
            return Err(HandoffError::ScopeChanged {
                collector_id: registration.collector_id,
            });
        }
        if existing.registration.transport != registration.transport
            || existing.registration.bridge_id != registration.bridge_id
        {
            return Err(HandoffError::RegistrationChanged {
                collector_id: registration.collector_id,
            });
        }
        if existing.lifecycle == CollectorLifecycle::Retired {
            return Err(HandoffError::CollectorRetired {
                collector_id: registration.collector_id,
            });
        }
        // Source ordering is scoped to one producer boot/session. The CLI calls
        // `register_or_reconnect` for each event so a batch can share the same
        // durable ledger; resetting on every identical registration would make
        // the rollback guard ineffective. A changed boot or session is the
        // actual reconnect boundary and may start its sequence at one again.
        let producer_restarted = existing.registration.boot_id != registration.boot_id
            || existing.registration.topology.session_id != registration.topology.session_id;
        if producer_restarted {
            existing.last_source_sequence = 0;
        }
        existing.registration = registration;
        existing.lifecycle = CollectorLifecycle::Active;
        Ok(())
    }

    /// Register a first connection or reconnect an existing collector after a
    /// restart. Reconnect is deliberately scope-checked and cannot revive a
    /// retired identity.
    pub fn register_or_reconnect(
        &mut self,
        registration: CollectorRegistration,
    ) -> Result<(), HandoffError> {
        if self.collectors.contains_key(&registration.collector_id) {
            self.reconnect(registration)
        } else {
            self.register(registration)
        }
    }

    pub fn disconnect(&mut self, collector_id: &str) -> Result<(), HandoffError> {
        let state = self
            .collectors
            .get_mut(collector_id)
            .ok_or_else(|| HandoffError::UnknownCollector(collector_id.to_string()))?;
        if state.lifecycle != CollectorLifecycle::Retired {
            state.lifecycle = CollectorLifecycle::Disconnected;
        }
        Ok(())
    }

    /// Mark the collector as draining without removing accepted events.  A caller
    /// should flush/ack pending receipts before invoking `retire`.
    pub fn begin_teardown(&mut self, collector_id: &str) -> Result<(), HandoffError> {
        let state = self
            .collectors
            .get_mut(collector_id)
            .ok_or_else(|| HandoffError::UnknownCollector(collector_id.to_string()))?;
        if state.lifecycle != CollectorLifecycle::Retired {
            state.lifecycle = CollectorLifecycle::Draining;
        }
        Ok(())
    }

    pub fn retire(&mut self, collector_id: &str) -> Result<(), HandoffError> {
        if self
            .pending
            .values()
            .any(|pending| pending.collector_id == collector_id)
        {
            return Err(HandoffError::PendingEvents {
                collector_id: collector_id.to_string(),
            });
        }
        let state = self
            .collectors
            .get_mut(collector_id)
            .ok_or_else(|| HandoffError::UnknownCollector(collector_id.to_string()))?;
        state.lifecycle = CollectorLifecycle::Retired;
        Ok(())
    }

    pub fn ingest(
        &mut self,
        collector_id: &str,
        event: HandoffEvent,
    ) -> Result<HandoffIngestOutcome, HandoffError> {
        event.validate()?;
        let state = self
            .collectors
            .get(collector_id)
            .ok_or_else(|| HandoffError::UnknownCollector(collector_id.to_string()))?;
        if state.lifecycle != CollectorLifecycle::Active {
            return Err(HandoffError::CollectorUnavailable {
                collector_id: collector_id.to_string(),
                lifecycle: state.lifecycle,
            });
        }
        let key = event.identity.dedup_key();
        if let Some(receipt_id) = self.seen.get(&key).copied() {
            return Ok(HandoffIngestOutcome::Duplicate { receipt_id });
        }

        if event.source_sequence <= state.last_source_sequence {
            return Err(HandoffError::SequenceRollback {
                collector_id: collector_id.to_string(),
                sequence: event.source_sequence,
            });
        }

        self.next_receipt_id = self.next_receipt_id.saturating_add(1).max(1);
        let receipt_id = self.next_receipt_id;
        let pending = PendingHandoff {
            receipt_id,
            collector_id: collector_id.to_string(),
            identity: event.identity,
            source_sequence: event.source_sequence,
            occurred_at: event.occurred_at,
            dedup_key: key.clone(),
        };
        self.seen.insert(key, receipt_id);
        self.pending.insert(receipt_id, pending);
        if let Some(state) = self.collectors.get_mut(collector_id) {
            state.last_source_sequence = event.source_sequence;
        }
        Ok(HandoffIngestOutcome::Accepted { receipt_id })
    }

    pub fn acknowledge(&mut self, receipt_id: u64) -> Result<bool, HandoffError> {
        let Some(pending) = self.pending.remove(&receipt_id) else {
            return Ok(false);
        };
        self.acknowledged_at.insert(pending.dedup_key, Utc::now());
        Ok(true)
    }

    /// Remove only acknowledged dedup aliases older than the caller's retention
    /// cutoff. Pending receipts are never removed by this operation.
    pub fn prune_acknowledged_before(&mut self, cutoff: DateTime<Utc>) -> usize {
        let stale: Vec<String> = self
            .acknowledged_at
            .iter()
            .filter(|(_, acknowledged_at)| **acknowledged_at < cutoff)
            .filter(|(key, _)| {
                !self
                    .pending
                    .values()
                    .any(|pending| &pending.dedup_key == *key)
            })
            .map(|(key, _)| key.clone())
            .collect();
        let mut removed = 0;
        for key in stale {
            self.acknowledged_at.remove(&key);
            if self.seen.remove(&key).is_some() {
                removed += 1;
            }
        }
        removed
    }

    pub fn pending(&self) -> impl Iterator<Item = &PendingHandoff> {
        self.pending.values()
    }

    pub fn pending_for(&self, collector_id: &str) -> Vec<&PendingHandoff> {
        self.pending
            .values()
            .filter(|pending| pending.collector_id == collector_id)
            .collect()
    }

    pub fn pending_len(&self) -> usize {
        self.pending.len()
    }

    /// Whether a receipt still needs transport acknowledgement. A duplicate
    /// identity with a pending receipt must be retried; an acknowledged identity
    /// can safely be suppressed before producing another broker payload.
    pub fn is_pending(&self, receipt_id: u64) -> bool {
        self.pending.contains_key(&receipt_id)
    }

    pub fn lifecycle(&self, collector_id: &str) -> Option<CollectorLifecycle> {
        self.collectors
            .get(collector_id)
            .map(|state| state.lifecycle)
    }

    /// Return the next source sequence for a registered collector. CLI
    /// producers use this when no explicit sequence was supplied, allowing a
    /// stable boot id to span multiple short-lived `ai emit` processes without
    /// falsely triggering the rollback guard.
    pub fn next_source_sequence(&self, collector_id: &str) -> Result<u64, HandoffError> {
        let state = self
            .collectors
            .get(collector_id)
            .ok_or_else(|| HandoffError::UnknownCollector(collector_id.to_string()))?;
        Ok(state.last_source_sequence.saturating_add(1).max(1))
    }

    /// Serialize only bounded metadata.  The caller can atomically write these
    /// bytes beside the existing queue before acknowledging the remote bridge.
    pub fn snapshot(&self) -> Result<Vec<u8>, HandoffError> {
        serde_json::to_vec(self).map_err(|error| HandoffError::Serialization(error.to_string()))
    }

    pub fn restore(bytes: &[u8]) -> Result<Self, HandoffError> {
        let ledger: Self = serde_json::from_slice(bytes)
            .map_err(|error| HandoffError::Serialization(error.to_string()))?;
        ledger.validate_snapshot()?;
        Ok(ledger)
    }

    fn validate_snapshot(&self) -> Result<(), HandoffError> {
        let mut receipt_ids = BTreeSet::new();
        let mut dedup_keys = BTreeSet::new();
        for (collector_id, state) in &self.collectors {
            if collector_id != &state.registration.collector_id {
                return Err(HandoffError::Serialization(
                    "collector id does not match registration".to_string(),
                ));
            }
            state.registration.validate()?;
        }
        for (receipt_id, pending) in &self.pending {
            if !self.collectors.contains_key(&pending.collector_id) {
                return Err(HandoffError::UnknownCollector(pending.collector_id.clone()));
            }
            pending.identity.validate()?;
            if *receipt_id != pending.receipt_id
                || !receipt_ids.insert(*receipt_id)
                || !dedup_keys.insert(pending.dedup_key.clone())
                || pending.dedup_key != pending.identity.dedup_key()
                || self.seen.get(&pending.dedup_key) != Some(receipt_id)
            {
                return Err(HandoffError::Serialization(
                    "handoff snapshot contains inconsistent pending identity".to_string(),
                ));
            }
        }
        for key in self.acknowledged_at.keys() {
            if !self.seen.contains_key(key)
                || self
                    .pending
                    .values()
                    .any(|pending| &pending.dedup_key == key)
            {
                return Err(HandoffError::Serialization(
                    "handoff snapshot contains an inconsistent acknowledged identity".to_string(),
                ));
            }
        }
        if self.next_receipt_id < self.pending.keys().copied().max().unwrap_or(0) {
            return Err(HandoffError::Serialization(
                "handoff snapshot receipt counter is behind pending events".to_string(),
            ));
        }
        Ok(())
    }
}

/// Cloud evidence requires a job/tool/file identity from the collector.  There
/// is intentionally no commit-author field: VCS metadata alone cannot certify a
/// file mutation as AI-written.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CloudJobEvidence {
    pub schema_version: u8,
    pub topology: TopologyContext,
    /// Opaque reference to the authenticated callback credential. The secret is
    /// held by the HTTP client/bridge and never serialized in this evidence.
    pub auth_key_id: String,
    pub job_id: String,
    pub tool_event_id: String,
    pub mutation_id: String,
    pub event_id: String,
}

impl CloudJobEvidence {
    fn scope_id(&self) -> String {
        let repository = self
            .topology
            .repository_id
            .as_deref()
            .unwrap_or("repo:unknown");
        format!(
            "cloud:{}",
            Uuid::new_v5(
                &Uuid::NAMESPACE_URL,
                format!("{}|{}", self.job_id, repository).as_bytes()
            )
        )
    }

    pub fn validate(&self) -> Result<(), HandoffError> {
        if self.schema_version != TOPOLOGY_HANDOFF_SCHEMA_VERSION {
            return Err(HandoffError::UnsupportedSchema(self.schema_version));
        }
        self.topology.validate().map_err(HandoffError::Topology)?;
        if !matches!(self.topology.execution, ExecutionSurface::CloudJob) {
            return Err(HandoffError::CloudEvidenceRequiresCloudTopology);
        }
        for (field, value) in [
            ("auth_key_id", self.auth_key_id.as_str()),
            ("job_id", self.job_id.as_str()),
            ("tool_event_id", self.tool_event_id.as_str()),
            ("mutation_id", self.mutation_id.as_str()),
        ] {
            validate_label(field, value)?;
        }
        HandoffEventIdentity {
            event_id: self.event_id.clone(),
            operation_id: Some(self.tool_event_id.clone()),
            mutation_id: Some(self.mutation_id.clone()),
            scope_id: Some(self.scope_id()),
        }
        .validate()
    }

    pub fn event_identity(&self) -> Result<HandoffEventIdentity, HandoffError> {
        self.validate()?;
        Ok(HandoffEventIdentity {
            event_id: self.event_id.clone(),
            operation_id: Some(self.tool_event_id.clone()),
            mutation_id: Some(self.mutation_id.clone()),
            scope_id: Some(self.scope_id()),
        })
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum HandoffError {
    #[error("unsupported topology handoff schema version {0}")]
    UnsupportedSchema(u8),
    #[error("handoff {field} is empty or contains unsupported characters")]
    InvalidLabel { field: &'static str },
    #[error("handoff {field} is too long")]
    FieldTooLong { field: &'static str },
    #[error("handoff bridge_id is required for this transport")]
    MissingBridge,
    #[error("collector transport {transport:?} cannot serve execution surface {surface:?}")]
    TransportMismatch {
        transport: CollectorTransport,
        surface: ExecutionSurface,
    },
    #[error("topology execution surface is unknown and has no approved transport")]
    UnknownExecutionSurface,
    #[error("topology validation failed: {0}")]
    Topology(TopologyError),
    #[error("collector {0} is not registered")]
    UnknownCollector(String),
    #[error("collector {collector_id} already has a different registration")]
    CollectorConflict { collector_id: String },
    #[error("collector {collector_id} reconnected with a different device/workspace/worktree")]
    ScopeChanged { collector_id: String },
    #[error("collector {collector_id} reconnected with a different bridge or transport")]
    RegistrationChanged { collector_id: String },
    #[error("collector {collector_id} is retired and must use a new identity")]
    CollectorRetired { collector_id: String },
    #[error("collector {collector_id} is {lifecycle:?} and cannot accept events")]
    CollectorUnavailable {
        collector_id: String,
        lifecycle: CollectorLifecycle,
    },
    #[error("collector {collector_id} still has unacknowledged events")]
    PendingEvents { collector_id: String },
    #[error("handoff event source_sequence must be greater than zero")]
    InvalidSequence,
    #[error("collector {collector_id} source sequence rolled back at {sequence}")]
    SequenceRollback { collector_id: String, sequence: u64 },
    #[error("cloud evidence requires a cloud-job topology")]
    CloudEvidenceRequiresCloudTopology,
    #[error("invalid handoff snapshot: {0}")]
    Serialization(String),
}

fn require_label(field: &'static str, value: Option<&str>) -> Result<(), HandoffError> {
    value
        .ok_or(HandoffError::MissingBridge)
        .and_then(|value| validate_label(field, value))
}

fn validate_optional_label(field: &'static str, value: Option<&str>) -> Result<(), HandoffError> {
    value
        .map(|value| validate_label(field, value))
        .unwrap_or(Ok(()))
}

fn validate_label(field: &'static str, value: &str) -> Result<(), HandoffError> {
    if value.is_empty()
        || value.len() > MAX_LABEL_BYTES
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
    {
        return if value.len() > MAX_LABEL_BYTES {
            Err(HandoffError::FieldTooLong { field })
        } else {
            Err(HandoffError::InvalidLabel { field })
        };
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::topology::{EditorSurface, TopologyIdentityInput};

    fn topology(surface: ExecutionSurface, session: &str) -> TopologyContext {
        TopologyIdentityInput {
            execution: surface,
            editor: EditorSurface::Vscode,
            device_seed: "install-a".to_string(),
            workspace_key: "workspace-a".to_string(),
            worktree_key: "worktree-a".to_string(),
            session_id: session.to_string(),
            runtime_instance_key: (!matches!(surface, ExecutionSurface::Local))
                .then(|| "runtime-a".to_string()),
            repository_id: Some("remote:git.example/team/app.git".to_string()),
        }
        .build()
        .unwrap()
    }

    fn remote_registration(id: &str, session: &str) -> CollectorRegistration {
        CollectorRegistration::new(
            id,
            Some("bridge-a".to_string()),
            "boot-a",
            topology(ExecutionSurface::SshRemote, session),
            CollectorTransport::AuthenticatedBridge,
            CollectorCapabilities {
                file_mutations: true,
                transcripts: true,
                editor_observations: true,
            },
        )
        .unwrap()
    }

    fn event(event_id: &str, operation_id: &str, mutation_id: &str) -> HandoffEvent {
        HandoffEvent {
            identity: HandoffEventIdentity {
                event_id: event_id.to_string(),
                operation_id: Some(operation_id.to_string()),
                mutation_id: Some(mutation_id.to_string()),
                scope_id: None,
            },
            source_sequence: 1,
            // Deliberately far from now: ordering must not depend on a shared clock.
            occurred_at: DateTime::from_timestamp(1, 0).unwrap(),
        }
    }

    #[test]
    fn remote_and_cloud_transports_require_the_right_authenticated_boundary() {
        assert!(CollectorRegistration::new(
            "local",
            None,
            "boot",
            topology(ExecutionSurface::SshRemote, "session"),
            CollectorTransport::AuthenticatedBridge,
            CollectorCapabilities::default(),
        )
        .is_err());

        let cloud = topology(ExecutionSurface::CloudJob, "job-session");
        assert!(CollectorRegistration::new(
            "cloud",
            Some("job-bridge".to_string()),
            "boot",
            cloud,
            CollectorTransport::CloudJobCallback,
            CollectorCapabilities {
                file_mutations: true,
                ..Default::default()
            },
        )
        .is_ok());
    }

    #[test]
    fn explicit_operation_and_mutation_proof_deduplicates_local_and_remote() {
        let mut ledger = HandoffLedger::default();
        ledger
            .register(remote_registration("remote", "session-a"))
            .unwrap();
        let mut local = remote_registration("local", "session-a");
        local.transport = CollectorTransport::LoopbackBroker;
        local.bridge_id = None;
        local.topology.execution = ExecutionSurface::Local;
        // Rebuild the local topology because the execution surface is part of the
        // workspace identity and must not be edited after construction.
        local.topology = topology(ExecutionSurface::Local, "session-a");
        ledger.register(local).unwrap();

        let first = ledger.ingest("remote", event("remote-event", "tool-1", "file-v3"));
        assert_eq!(first, Ok(HandoffIngestOutcome::Accepted { receipt_id: 1 }));
        let duplicate = ledger.ingest("local", event("local-event", "tool-1", "file-v3"));
        assert_eq!(
            duplicate,
            Ok(HandoffIngestOutcome::Duplicate { receipt_id: 1 })
        );
        let distinct = ledger.ingest("local", event("local-event-2", "tool-1", "file-v4"));
        assert_eq!(
            distinct,
            Ok(HandoffIngestOutcome::Accepted { receipt_id: 2 })
        );
    }

    #[test]
    fn scoped_proofs_do_not_collide_across_workspaces() {
        let mut ledger = HandoffLedger::default();
        ledger
            .register(remote_registration("remote-a", "session-a"))
            .unwrap();
        ledger
            .register(remote_registration("remote-b", "session-b"))
            .unwrap();
        let mut first = event("event-a", "tool-1", "file-v1");
        first.identity.scope_id = Some("repository:a".to_string());
        let mut second = event("event-b", "tool-1", "file-v1");
        second.identity.scope_id = Some("repository:b".to_string());
        assert!(matches!(
            ledger.ingest("remote-a", first),
            Ok(HandoffIngestOutcome::Accepted { .. })
        ));
        assert!(matches!(
            ledger.ingest("remote-b", second),
            Ok(HandoffIngestOutcome::Accepted { .. })
        ));
    }

    #[test]
    fn source_sequence_rollbacks_are_rejected_and_retired_collectors_do_not_reconnect() {
        let mut ledger = HandoffLedger::default();
        ledger
            .register(remote_registration("remote", "session-a"))
            .unwrap();
        assert!(ledger
            .ingest("remote", event("event-1", "tool-1", "file-v1"))
            .is_ok());
        assert!(matches!(
            ledger.ingest("remote", event("event-2", "tool-2", "file-v2")),
            Err(HandoffError::SequenceRollback { sequence: 1, .. })
        ));
        ledger.acknowledge(1).unwrap();
        ledger.retire("remote").unwrap();
        assert!(matches!(
            ledger.reconnect(remote_registration("remote", "session-b")),
            Err(HandoffError::CollectorRetired { .. })
        ));
    }

    #[test]
    fn identical_registration_keeps_source_order_but_new_boot_resets_it() {
        let mut ledger = HandoffLedger::default();
        ledger
            .register(remote_registration("remote", "session-a"))
            .unwrap();

        let mut first = event("event-1", "tool-1", "file-v1");
        first.source_sequence = 1;
        assert!(matches!(
            ledger.ingest("remote", first),
            Ok(HandoffIngestOutcome::Accepted { receipt_id: 1 })
        ));

        // Re-registering the same boot/session is how the CLI prepares each
        // event in a batch. It must not erase the sequence cursor.
        ledger
            .register_or_reconnect(remote_registration("remote", "session-a"))
            .unwrap();
        let mut second = event("event-2", "tool-2", "file-v2");
        second.source_sequence = 2;
        assert!(matches!(
            ledger.ingest("remote", second),
            Ok(HandoffIngestOutcome::Accepted { receipt_id: 2 })
        ));
        assert_eq!(ledger.next_source_sequence("remote"), Ok(3));

        let mut rollback = event("event-3", "tool-3", "file-v3");
        rollback.source_sequence = 1;
        assert!(matches!(
            ledger.ingest("remote", rollback),
            Err(HandoffError::SequenceRollback { sequence: 1, .. })
        ));

        // A new boot/session is a legitimate reconnect and starts a fresh
        // producer sequence while retaining the existing dedup ledger.
        ledger
            .register_or_reconnect(remote_registration("remote", "session-b"))
            .unwrap();
        let mut after_restart = event("event-4", "tool-4", "file-v4");
        after_restart.source_sequence = 1;
        assert!(matches!(
            ledger.ingest("remote", after_restart),
            Ok(HandoffIngestOutcome::Accepted { receipt_id: 3 })
        ));
        assert_eq!(ledger.next_source_sequence("remote"), Ok(2));
    }

    #[test]
    fn retention_prunes_acknowledged_aliases_but_keeps_pending_receipts() {
        let mut ledger = HandoffLedger::default();
        ledger
            .register(remote_registration("remote", "session-a"))
            .unwrap();
        ledger
            .ingest("remote", event("event-1", "tool-1", "file-v1"))
            .unwrap();
        ledger.acknowledge(1).unwrap();
        let mut pending = event("event-2", "tool-2", "file-v2");
        pending.source_sequence = 2;
        ledger.ingest("remote", pending).unwrap();
        assert_eq!(ledger.pending_len(), 1);
        let removed = ledger.prune_acknowledged_before(Utc::now() + chrono::Duration::seconds(1));
        assert_eq!(removed, 1);
        assert_eq!(ledger.pending_len(), 1);
        let mut replay = event("event-1", "tool-1", "file-v1");
        replay.source_sequence = 3;
        assert!(ledger.ingest("remote", replay).is_ok());
    }

    #[test]
    fn topology_helpers_keep_collector_id_opaque_and_choose_authenticated_transport() {
        let remote = topology(ExecutionSurface::SshRemote, "session-a");
        assert!(collector_id_for(&remote).unwrap().starts_with("collector:"));
        assert_eq!(
            transport_for_topology(&remote).unwrap(),
            CollectorTransport::AuthenticatedBridge
        );
        let cloud = topology(ExecutionSurface::CloudJob, "job-session");
        assert_eq!(
            transport_for_topology(&cloud).unwrap(),
            CollectorTransport::CloudJobCallback
        );
    }

    #[test]
    fn reconnect_and_teardown_preserve_pending_events_across_snapshot_restore() {
        let mut ledger = HandoffLedger::default();
        ledger
            .register(remote_registration("remote", "session-a"))
            .unwrap();
        let accepted = ledger.ingest("remote", event("event-1", "tool-1", "file-v1"));
        assert_eq!(
            accepted,
            Ok(HandoffIngestOutcome::Accepted { receipt_id: 1 })
        );
        ledger.disconnect("remote").unwrap();
        assert_eq!(ledger.pending_len(), 1);
        let mut restarted = remote_registration("remote", "session-b");
        restarted.boot_id = "boot-b".to_string();
        ledger.reconnect(restarted).unwrap();
        ledger.begin_teardown("remote").unwrap();
        assert_eq!(ledger.pending_len(), 1);

        let snapshot = ledger.snapshot().unwrap();
        let mut restored = HandoffLedger::restore(&snapshot).unwrap();
        assert_eq!(restored.pending_len(), 1);
        assert_eq!(restored.acknowledge(1), Ok(true));
        assert_eq!(restored.retire("remote"), Ok(()));
        assert_eq!(restored.pending_len(), 0);
    }

    #[test]
    fn disconnected_or_draining_collectors_cannot_accept_new_events() {
        let mut ledger = HandoffLedger::default();
        ledger
            .register(remote_registration("remote", "session-a"))
            .unwrap();
        ledger.disconnect("remote").unwrap();
        assert!(matches!(
            ledger.ingest("remote", event("event-1", "tool-1", "file-v1")),
            Err(HandoffError::CollectorUnavailable {
                lifecycle: CollectorLifecycle::Disconnected,
                ..
            })
        ));
        ledger
            .reconnect(remote_registration("remote", "session-b"))
            .unwrap();
        ledger.begin_teardown("remote").unwrap();
        assert!(matches!(
            ledger.ingest("remote", event("event-2", "tool-2", "file-v2")),
            Err(HandoffError::CollectorUnavailable {
                lifecycle: CollectorLifecycle::Draining,
                ..
            })
        ));
    }

    #[test]
    fn cloud_evidence_requires_tool_and_file_proof_and_rejects_commit_author() {
        let evidence = CloudJobEvidence {
            schema_version: TOPOLOGY_HANDOFF_SCHEMA_VERSION,
            topology: topology(ExecutionSurface::CloudJob, "job-session"),
            auth_key_id: "callback-key-1".to_string(),
            job_id: "job-1".to_string(),
            tool_event_id: "tool-1".to_string(),
            mutation_id: "file-v1".to_string(),
            event_id: "cloud-event-1".to_string(),
        };
        evidence.validate().unwrap();
        let identity = evidence.event_identity().unwrap();
        assert_eq!(identity.operation_id.as_deref(), Some("tool-1"));
        assert_eq!(identity.mutation_id.as_deref(), Some("file-v1"));
        let mut other_job = evidence.clone();
        other_job.job_id = "job-2".to_string();
        assert_ne!(
            identity.scope_id,
            other_job.event_identity().unwrap().scope_id,
            "tool and mutation ids are scoped to the cloud job"
        );

        let serialized = serde_json::to_value(&evidence).unwrap();
        assert!(serialized.get("commit_author").is_none());
        let mut forged = serialized.as_object().unwrap().clone();
        forged.insert(
            "commit_author".to_string(),
            serde_json::Value::String("bot@example.test".to_string()),
        );
        assert!(
            serde_json::from_value::<CloudJobEvidence>(serde_json::Value::Object(forged)).is_err()
        );
    }

    #[test]
    fn event_identity_rejects_path_and_unbounded_labels() {
        let mut identity = HandoffEventIdentity {
            event_id: "event-1".to_string(),
            operation_id: Some("/Users/dev/project".to_string()),
            mutation_id: None,
            scope_id: None,
        };
        assert_eq!(
            identity.validate(),
            Err(HandoffError::InvalidLabel {
                field: "operation_id"
            })
        );
        identity.operation_id = Some("x".repeat(MAX_LABEL_BYTES + 1));
        assert_eq!(
            identity.validate(),
            Err(HandoffError::FieldTooLong {
                field: "operation_id"
            })
        );
    }
}
