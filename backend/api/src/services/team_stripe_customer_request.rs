//! One immutable customer-create HTTP contract; no credential or mutable org name.
use super::{
    team_financial_guard::fingerprint,
    team_financial_source::{AcceptedRequest, OperationKind, Scope},
};
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub(crate) struct Request {
    scope: Scope,
    operation: Uuid,
    actor: Uuid,
}
impl Request {
    pub const PATH: &'static str = "/v1/customers";
    pub fn new(scope: Scope, operation: Uuid, actor: Uuid) -> Result<Self> {
        scope.key()?;
        ensure!(
            !operation.is_nil() && !actor.is_nil(),
            "customer_request_identity_invalid"
        );
        Ok(Self {
            scope,
            operation,
            actor,
        })
    }
    pub fn key(&self) -> String {
        format!("atoaxis-customer-v1-{}", self.operation)
    }
    pub fn form(&self) -> [(String, String); 1] {
        [(
            "metadata[atoaxis_operation]".into(),
            self.operation.to_string(),
        )]
    }
    pub fn accepted(&self, at: DateTime<Utc>) -> Result<AcceptedRequest> {
        let idempotency_hash = fingerprint(&self.key())?;
        Ok(AcceptedRequest {
            operation: self.operation,
            kind: OperationKind::CreateCustomer,
            actor: self.actor,
            // The original authorization revision is one. Recovery is lookup-only,
            // and cannot authorize a new create under a later actor/revision.
            request_hash: fingerprint(&(
                "stripe_customer_request_v1",
                &self.scope,
                self.actor,
                1_i64,
                "POST",
                Self::PATH,
                self.form(),
                &idempotency_hash,
            ))?,
            idempotency_hash,
            accepted_at: at,
        })
    }
}

/// Normalized evidence definition shared by retention and resolution. No raw
/// response/body is retained or interpreted as current SQL authorization.
pub(crate) fn result_hash(
    scope: &Scope,
    operation: Uuid,
    identity: &Option<super::team_financial_source::ProviderIdentity>,
    verified: bool,
) -> Result<String> {
    fingerprint(&(
        "stripe_customer_result_v1",
        scope,
        operation,
        identity,
        verified,
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn customer_http_contract_binds_scope_actor_operation_and_original_key() {
        let scope = Scope {
            organization: Uuid::now_v7(),
            account: "acct_fixture".into(),
            live: false,
        };
        let op = Uuid::now_v7();
        let actor = Uuid::now_v7();
        let request = Request::new(scope.clone(), op, actor).unwrap();
        let at = Utc::now();
        let accepted = request.accepted(at).unwrap();
        assert_eq!(request.key(), format!("atoaxis-customer-v1-{op}"));
        assert_eq!(
            request.form(),
            [("metadata[atoaxis_operation]".into(), op.to_string())]
        );
        assert_eq!(request.accepted(at).unwrap(), accepted);
        assert_eq!(
            request
                .accepted(at + chrono::Duration::seconds(2))
                .unwrap()
                .request_hash,
            accepted.request_hash
        );
        for mode in 0..5 {
            let mut changed = scope.clone();
            match mode {
                0 => changed.organization = Uuid::now_v7(),
                1 => changed.account = "acct_other".into(),
                2 => changed.live = true,
                _ => {}
            }
            let other = Request::new(
                changed,
                if mode == 3 { Uuid::now_v7() } else { op },
                if mode == 4 { Uuid::now_v7() } else { actor },
            )
            .unwrap()
            .accepted(at)
            .unwrap();
            assert_ne!(other.request_hash, accepted.request_hash);
        }
        assert!(Request::new(scope, Uuid::nil(), actor).is_err());
    }
}
