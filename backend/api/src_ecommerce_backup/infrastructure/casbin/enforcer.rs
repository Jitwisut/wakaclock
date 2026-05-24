use anyhow::Result;

use casbin::{CoreApi, DefaultModel, Enforcer, FileAdapter, MgmtApi, RbacApi};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::infrastructure::{config::CasbinConfig, logger::Logger};

/// Thread-safe Casbin Enforcer wrapper
pub struct CasbinEnforcer {
    enforcer: Arc<RwLock<Enforcer>>,
    logger: Logger,
}

impl CasbinEnforcer {
    /// Create a new Casbin enforcer with the given configuration
    pub async fn new(config: &CasbinConfig, logger: Logger) -> Result<Self> {
        logger.info("Initializing Casbin enforcer", None);

        // Load the model from file
        let model = DefaultModel::from_file(&config.model_path).await?;

        // Create a file adapter with the policy file path (clone the path to own it)
        let adapter = FileAdapter::new(config.policy_path.clone());

        // Create the enforcer
        let mut enforcer = Enforcer::new(model, adapter).await?;

        // Load policy from file
        enforcer.load_policy().await?;

        logger.info(
            &format!(
                "Casbin enforcer initialized with model: {} and policy: {}",
                config.model_path, config.policy_path
            ),
            None,
        );

        Ok(Self {
            enforcer: Arc::new(RwLock::new(enforcer)),
            logger,
        })
    }

    /// Check if a subject has permission to perform an action on an object
    pub async fn enforce(&self, subject: &str, object: &str, action: &str) -> Result<bool> {
        let params = vec![subject.to_string(), object.to_string(), action.to_string()];
        let enforcer = self.enforcer.read().await;
        let result = enforcer.enforce(params)?;

        if !result {
            self.logger.debug(
                &format!(
                    "Permission denied: subject={}, object={}, action={}",
                    subject, object, action
                ),
                None,
            );
        }

        Ok(result)
    }

    /// Add a policy rule
    pub async fn add_policy(&self, subject: &str, object: &str, action: &str) -> Result<bool> {
        let mut enforcer = self.enforcer.write().await;
        let result = enforcer
            .add_policy(vec![
                subject.to_string(),
                object.to_string(),
                action.to_string(),
            ])
            .await?;

        if result {
            self.logger.info(
                &format!(
                    "Policy added: subject={}, object={}, action={}",
                    subject, object, action
                ),
                None,
            );
        }

        Ok(result)
    }

    /// Remove a policy rule
    pub async fn remove_policy(&self, subject: &str, object: &str, action: &str) -> Result<bool> {
        let mut enforcer = self.enforcer.write().await;
        let result = enforcer
            .remove_policy(vec![
                subject.to_string(),
                object.to_string(),
                action.to_string(),
            ])
            .await?;

        if result {
            self.logger.info(
                &format!(
                    "Policy removed: subject={}, object={}, action={}",
                    subject, object, action
                ),
                None,
            );
        }

        Ok(result)
    }

    /// Add a role for a user
    pub async fn add_role_for_user(&self, user: &str, role: &str) -> Result<bool> {
        let mut enforcer = self.enforcer.write().await;
        let result = enforcer.add_role_for_user(user, role, None).await?;

        if result {
            self.logger
                .info(&format!("Role '{}' added for user '{}'", role, user), None);
        }

        Ok(result)
    }

    /// Remove a role from a user
    pub async fn delete_role_for_user(&self, user: &str, role: &str) -> Result<bool> {
        let mut enforcer = self.enforcer.write().await;
        let result = enforcer.delete_role_for_user(user, role, None).await?;

        if result {
            self.logger.info(
                &format!("Role '{}' removed from user '{}'", role, user),
                None,
            );
        }

        Ok(result)
    }

    /// Get all roles for a user
    pub async fn get_roles_for_user(&self, user: &str) -> Vec<String> {
        let enforcer = self.enforcer.read().await;
        enforcer.get_roles_for_user(user, None)
    }

    /// Get all users with a specific role
    pub async fn get_users_for_role(&self, role: &str) -> Vec<String> {
        let enforcer = self.enforcer.read().await;
        enforcer.get_users_for_role(role, None)
    }

    /// Check if a user has a role
    pub async fn has_role_for_user(&self, user: &str, role: &str) -> Result<bool> {
        let enforcer = self.enforcer.read().await;
        let roles = enforcer.get_roles_for_user(user, None);
        Ok(roles.contains(&role.to_string()))
    }

    /// Get all permissions for a user
    pub async fn get_permissions_for_user(&self, user: &str) -> Vec<Vec<String>> {
        let enforcer = self.enforcer.read().await;
        enforcer.get_permissions_for_user(user, None)
    }

    /// Add permission for a role
    pub async fn add_permission_for_role(
        &self,
        role: &str,
        object: &str,
        action: &str,
    ) -> Result<bool> {
        self.add_policy(role, object, action).await
    }

    /// Save policy to file
    pub async fn save_policy(&self) -> Result<()> {
        let mut enforcer = self.enforcer.write().await;
        enforcer.save_policy().await?;
        self.logger.info("Policy saved to file", None);
        Ok(())
    }

    /// Reload policy from file
    pub async fn reload_policy(&self) -> Result<()> {
        let mut enforcer = self.enforcer.write().await;
        enforcer.load_policy().await?;
        self.logger.info("Policy reloaded from file", None);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    async fn create_test_enforcer() -> Result<CasbinEnforcer> {
        // Create temporary model file
        let mut model_file = NamedTempFile::new()?;
        writeln!(model_file, "[request_definition]")?;
        writeln!(model_file, "r = sub, obj, act")?;
        writeln!(model_file)?;
        writeln!(model_file, "[policy_definition]")?;
        writeln!(model_file, "p = sub, obj, act")?;
        writeln!(model_file)?;
        writeln!(model_file, "[role_definition]")?;
        writeln!(model_file, "g = _, _")?;
        writeln!(model_file)?;
        writeln!(model_file, "[policy_effect]")?;
        writeln!(model_file, "e = some(where (p.eft == allow))")?;
        writeln!(model_file)?;
        writeln!(model_file, "[matchers]")?;
        writeln!(
            model_file,
            "m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act"
        )?;
        model_file.flush()?;

        // Create temporary policy file
        let policy_file = NamedTempFile::new()?;

        let config = CasbinConfig {
            model_path: model_file.path().to_str().unwrap().to_string(),
            policy_path: policy_file.path().to_str().unwrap().to_string(),
            enable_log: false,
        };

        let logger = Logger::new()?;
        CasbinEnforcer::new(&config, logger).await
    }

    #[tokio::test]
    async fn test_enforce_permission() -> Result<()> {
        let enforcer = create_test_enforcer().await?;

        // Add a policy
        enforcer.add_policy("alice", "data1", "read").await?;

        // Check permission
        assert!(enforcer.enforce("alice", "data1", "read").await?);
        assert!(!enforcer.enforce("alice", "data1", "write").await?);
        assert!(!enforcer.enforce("bob", "data1", "read").await?);

        Ok(())
    }

    #[tokio::test]
    async fn test_role_management() -> Result<()> {
        let enforcer = create_test_enforcer().await?;

        // Add role and permission
        enforcer.add_role_for_user("alice", "admin").await?;
        enforcer
            .add_permission_for_role("admin", "data1", "read")
            .await?;
        enforcer
            .add_permission_for_role("admin", "data1", "write")
            .await?;

        // Check role
        assert!(enforcer.has_role_for_user("alice", "admin").await?);

        // Check permissions through role
        assert!(enforcer.enforce("alice", "data1", "read").await?);
        assert!(enforcer.enforce("alice", "data1", "write").await?);

        // Get roles
        let roles = enforcer.get_roles_for_user("alice").await;
        assert_eq!(roles, vec!["admin"]);

        Ok(())
    }
}
