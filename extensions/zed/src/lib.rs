use sha2::{Digest, Sha256};
use std::path::Path;
use zed_extension_api as zed;

const GITHUB_REPOSITORY: &str = "Jitwisut/wakaclock";
const LANGUAGE_SERVER_BINARY: &str = "wakaclock-ls";

struct AtoAxisExtension {
    cached_binary_path: Option<String>,
}

impl AtoAxisExtension {
    fn platform_slug() -> zed::Result<&'static str> {
        use zed::{Architecture, Os};

        match zed::current_platform() {
            (Os::Mac, Architecture::Aarch64) => Ok("darwin-arm64"),
            (Os::Mac, Architecture::X8664) => Ok("darwin-x64"),
            (Os::Linux, Architecture::Aarch64) => Ok("linux-arm64"),
            (Os::Linux, Architecture::X8664) => Ok("linux-x64"),
            (Os::Windows, Architecture::Aarch64) => Ok("windows-arm64"),
            (Os::Windows, Architecture::X8664) => Ok("windows-x64"),
            (_, Architecture::X86) => Err("AtoAxis does not publish a 32-bit language server".into()),
        }
    }

    fn release_asset_name(platform: &str) -> String {
        let suffix = if platform.starts_with("windows-") {
            ".exe"
        } else {
            ""
        };
        format!("{LANGUAGE_SERVER_BINARY}-{platform}{suffix}")
    }

    fn verify_sha256(binary_path: &str, checksum_path: &str) -> zed::Result<()> {
        let expected = std::fs::read_to_string(checksum_path)
            .map_err(|error| format!("failed to read AtoAxis checksum: {error}"))?
            .split_whitespace()
            .next()
            .ok_or_else(|| "AtoAxis checksum file was empty".to_string())?
            .to_ascii_lowercase();

        if expected.len() != 64 || !expected.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("AtoAxis checksum file did not contain a SHA-256 digest".into());
        }

        let bytes = std::fs::read(binary_path)
            .map_err(|error| format!("failed to read downloaded AtoAxis language server: {error}"))?;
        let actual = format!("{:x}", Sha256::digest(bytes));
        if actual != expected {
            let _ = std::fs::remove_file(binary_path);
            return Err("downloaded AtoAxis language server failed SHA-256 verification".into());
        }
        Ok(())
    }

    fn download_language_server(&mut self) -> zed::Result<String> {
        let platform = Self::platform_slug()?;
        let release = zed::latest_github_release(
            GITHUB_REPOSITORY,
            zed::GithubReleaseOptions {
                require_assets: true,
                pre_release: false,
            },
        )?;
        let asset_name = Self::release_asset_name(platform);
        let checksum_name = format!("{asset_name}.sha256");
        let asset = release
            .assets
            .iter()
            .find(|asset| asset.name == asset_name)
            .ok_or_else(|| format!("AtoAxis release {} has no asset {asset_name}", release.version))?;
        let checksum_asset = release
            .assets
            .iter()
            .find(|asset| asset.name == checksum_name)
            .ok_or_else(|| {
                format!(
                    "AtoAxis release {} has no checksum asset {checksum_name}",
                    release.version
                )
            })?;

        let safe_version: String = release
            .version
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                    character
                } else {
                    '_'
                }
            })
            .collect();
        let local_binary = if platform.starts_with("windows-") {
            format!("{LANGUAGE_SERVER_BINARY}-{safe_version}-{platform}.exe")
        } else {
            format!("{LANGUAGE_SERVER_BINARY}-{safe_version}-{platform}")
        };
        let local_checksum = format!("{local_binary}.sha256");

        zed::download_file(
            &asset.download_url,
            &local_binary,
            zed::DownloadedFileType::Uncompressed,
        )?;
        zed::download_file(
            &checksum_asset.download_url,
            &local_checksum,
            zed::DownloadedFileType::Uncompressed,
        )?;
        Self::verify_sha256(&local_binary, &local_checksum)?;

        if !platform.starts_with("windows-") {
            zed::make_file_executable(&local_binary)?;
        }
        self.cached_binary_path = Some(local_binary.clone());
        Ok(local_binary)
    }

    fn language_server_path(&mut self, worktree: &zed::Worktree) -> zed::Result<String> {
        if let Some(path) = worktree.which(LANGUAGE_SERVER_BINARY) {
            return Ok(path);
        }
        if let Some(path) = self.cached_binary_path.as_deref() {
            if Path::new(path).is_file() {
                return Ok(path.to_string());
            }
        }
        self.download_language_server()
    }
}

impl zed::Extension for AtoAxisExtension {
    fn new() -> Self {
        Self {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        Ok(zed::Command {
            command: self.language_server_path(worktree)?,
            args: Vec::new(),
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(AtoAxisExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_asset_names_match_release_workflow_contract() {
        assert_eq!(
            AtoAxisExtension::release_asset_name("darwin-arm64"),
            "wakaclock-ls-darwin-arm64"
        );
        assert_eq!(
            AtoAxisExtension::release_asset_name("windows-x64"),
            "wakaclock-ls-windows-x64.exe"
        );
    }

    #[test]
    fn checksum_verification_accepts_matching_sha256() {
        let base = std::env::temp_dir().join(format!(
            "atoaxis-zed-checksum-{}",
            std::process::id()
        ));
        let binary = base.with_extension("bin");
        let checksum = base.with_extension("sha256");
        std::fs::write(&binary, b"atoaxis-zed-test").unwrap();
        let digest = format!("{:x}", Sha256::digest(b"atoaxis-zed-test"));
        std::fs::write(&checksum, format!("{digest}  wakaclock-ls\n")).unwrap();

        assert!(AtoAxisExtension::verify_sha256(
            binary.to_str().unwrap(),
            checksum.to_str().unwrap()
        )
        .is_ok());

        let _ = std::fs::remove_file(binary);
        let _ = std::fs::remove_file(checksum);
    }

    #[test]
    fn checksum_verification_rejects_mismatch_and_removes_binary() {
        let base = std::env::temp_dir().join(format!(
            "atoaxis-zed-checksum-bad-{}",
            std::process::id()
        ));
        let binary = base.with_extension("bin");
        let checksum = base.with_extension("sha256");
        std::fs::write(&binary, b"tampered").unwrap();
        std::fs::write(&checksum, format!("{}  wakaclock-ls\n", "0".repeat(64))).unwrap();

        assert!(AtoAxisExtension::verify_sha256(
            binary.to_str().unwrap(),
            checksum.to_str().unwrap()
        )
        .is_err());
        assert!(!binary.exists());

        let _ = std::fs::remove_file(checksum);
    }
}
