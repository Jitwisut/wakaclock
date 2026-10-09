//! Staging import: JSON arrives on stdin, only an authenticated envelope is written.
use anyhow::{ensure, Context, Result};
use std::{
    fs::OpenOptions,
    io::{Read, Write},
};
use wakaclock_server::infrastructure::{github::GithubAppSecrets, secret_box::SecretBox};

fn main() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let app_id = args
        .next()
        .context("usage: team-github-vault APP_ID DESTINATION < private-secret-bundle.json")?;
    let path = args.next().context("destination required")?;
    ensure!(
        args.next().is_none() && app_id.parse::<i64>().is_ok_and(|n| n > 0),
        "invalid vault arguments"
    );
    let mut bytes = Vec::new();
    std::io::stdin().take(65537).read_to_end(&mut bytes)?;
    ensure!(bytes.len() <= 65536, "credential bundle too large");
    let secrets: GithubAppSecrets =
        serde_json::from_slice(&bytes).context("credential bundle schema rejected")?;
    ensure!(
        !secrets.client_secret.is_empty() && !secrets.webhook_secret.is_empty(),
        "required credential missing"
    );
    jsonwebtoken::EncodingKey::from_rsa_pem(secrets.private_key.as_bytes())
        .context("private key rejected")?;
    let vault = SecretBox::from_env_value(
        &std::env::var("ATOAXIS_KMS_KEY_ID").context("vault key unavailable")?,
    )?;
    let ciphertext = vault.seal(
        format!("github-app:{app_id}").as_bytes(),
        &serde_json::to_vec(&secrets)?,
    )?;
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .context("new credential destination unavailable; never overwrite the previous envelope")?;
    file.write_all(&ciphertext)?;
    file.sync_all()?;
    println!("Encrypted GitHub credential envelope saved; no credential was emitted.");
    Ok(())
}
