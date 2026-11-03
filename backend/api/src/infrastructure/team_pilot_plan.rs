//! Immutable private pilot plans. Reuses the existing private-file checks, not
//! the enrollment journal's event format or any provider recovery protocol.
use super::team_financial_guard::FinancialGuard;
use crate::services::team_pilot::Plan;
use anyhow::{ensure, Result};
use std::{
    io::{Read, Write},
    path::Path,
};
const LIMIT: u64 = 32_768;

pub fn write(path: &Path, plan: &Plan) -> Result<()> {
    plan.validate()?;
    let private = FinancialGuard::new(path.into())?;
    let bytes = serde_json::to_vec(plan)?;
    ensure!(bytes.len() as u64 <= LIMIT, "team_pilot_plan_limit");
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
    ensure!(file.metadata()?.len() <= LIMIT, "team_pilot_plan_limit");
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(LIMIT + 1)
        .read_to_end(&mut bytes)?;
    ensure!(bytes.len() as u64 <= LIMIT, "team_pilot_plan_limit");
    let plan: Plan =
        serde_json::from_slice(&bytes).map_err(|_| anyhow::anyhow!("team_pilot_plan_invalid"))?;
    plan.validate()?;
    file.sync_all()?;
    private.sync_directory()?;
    FinancialGuard::verify_file(path, &file)?;
    Ok(plan)
}
