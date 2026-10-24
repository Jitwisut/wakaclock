//! Private immutable review files, not authority. Never overwrite a plan.
use super::team_financial_guard::FinancialGuard;
use crate::services::team_financial_recovery::Plan;
use anyhow::{ensure, Result};
use std::{
    io::{Read, Write},
    path::Path,
};
const MAX_BYTES: u64 = 32768;
pub fn write(path: &Path, plan: &Plan) -> Result<()> {
    plan.validate()?;
    let private = FinancialGuard::new(path.into())?;
    let bytes = serde_json::to_vec(plan)?;
    ensure!(
        bytes.len() as u64 <= MAX_BYTES,
        "financial_recovery_plan_limit"
    );
    let mut file = FinancialGuard::options().create_new(true).open(path)?;
    FinancialGuard::verify_file(path, &file)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    private.sync_directory()?;
    Ok(())
}
pub fn read(path: &Path) -> Result<Plan> {
    let private = FinancialGuard::new(path.into())?;
    let mut file = FinancialGuard::options().open(path)?;
    FinancialGuard::verify_file(path, &file)?;
    ensure!(
        file.metadata()?.len() <= MAX_BYTES,
        "financial_recovery_plan_limit"
    );
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() as u64 <= MAX_BYTES,
        "financial_recovery_plan_limit"
    );
    let plan: Plan = serde_json::from_slice(&bytes)
        .map_err(|_| anyhow::anyhow!("financial_recovery_plan_invalid"))?;
    plan.validate()?;
    // Trust only the exact opened file, after ensuring complete durable bytes.
    file.sync_all()?;
    private.sync_directory()?;
    FinancialGuard::verify_file(path, &file)?;
    Ok(plan)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn private_plan_never_overwrites_and_rejects_damage_links_and_public_permissions() {
        let root = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("atoaxis-plan-{}", uuid::Uuid::now_v7()));
        std::fs::create_dir(&root).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        let path = root.join("plan.json");
        let p = crate::services::team_financial_recovery::tests::fixture();
        write(&path, &p).unwrap();
        assert_eq!(read(&path).unwrap(), p);
        assert!(write(&path, &p).is_err());
        #[cfg(unix)]
        {
            use std::os::unix::fs::{symlink, PermissionsExt};
            let link = root.join("link");
            symlink(&path, &link).unwrap();
            assert!(read(&link).is_err());
            std::fs::remove_file(link).unwrap();
            let hard = root.join("hard");
            std::fs::hard_link(&path, &hard).unwrap();
            assert!(read(&path).is_err());
            std::fs::remove_file(hard).unwrap();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
            assert!(read(&path).is_err());
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
        }
        std::fs::write(&path, b"{\"partial\":").unwrap();
        assert!(read(&path).is_err());
        assert!(write(&path, &p).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
