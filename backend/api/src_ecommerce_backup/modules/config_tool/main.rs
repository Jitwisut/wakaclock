//! Configuration Tool Module
//! โมดูลเครื่องมือสำหรับจัดการ configuration files
//!
//! ใช้สำหรับ:
//! - สร้าง sample configuration files
//! - ตรวจสอบ platform credentials configuration
//! - จัดการ configuration templates

use clap::{Parser, Subcommand};
use ecommerce_connect::{
    config::{create_sample_config, PlatformCredentialsConfig},
    infrastructure::logger,
};
use std::path::PathBuf;

/// Platform credentials configuration tool
/// เครื่องมือสำหรับจัดการ platform credentials configuration
#[derive(Parser)]
#[command(name = "config-tool")]
#[command(about = "Manage platform credentials configuration", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate a sample platform credentials configuration file
    Generate {
        /// Output file path
        #[arg(short, long, default_value = "platform_credentials.json")]
        output: PathBuf,

        /// Overwrite existing file
        #[arg(short = 'f', long)]
        force: bool,
    },

    /// Validate a platform credentials configuration file
    Validate {
        /// Configuration file path
        #[arg(short, long, default_value = "config/platform_credentials.json")]
        config: PathBuf,
    },

    /// List enabled platforms from configuration
    List {
        /// Configuration file path
        #[arg(short, long, default_value = "config/platform_credentials.json")]
        config: PathBuf,
    },

    /// Show configuration for a specific platform
    Show {
        /// Platform name
        platform: String,

        /// Configuration file path
        #[arg(short, long, default_value = "config/platform_credentials.json")]
        config: PathBuf,

        /// Environment to show (e.g., development, production)
        #[arg(short, long)]
        env: Option<String>,
    },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    logger::init_tracing()?;

    let cli = Cli::parse();

    match cli.command {
        Commands::Generate { output, force } => {
            // Check if file exists
            if output.exists() && !force {
                eprintln!(
                    "Error: File {} already exists. Use -f to overwrite.",
                    output.display()
                );
                std::process::exit(1);
            }

            // Create sample config
            let config = create_sample_config();

            // Save to file
            config.save_to_file(&output)?;

            println!("✅ Generated sample configuration at {}", output.display());
            println!("\n⚠️  Remember to:");
            println!("  1. Replace placeholder values (YOUR_*) with actual credentials");
            println!("  2. Update URLs and settings for your environment");
            println!("  3. Set appropriate environment variables or use credential manager");
            println!("  4. Keep this file secure and never commit with real credentials");
        }

        Commands::Validate { config } => {
            // Load and validate config
            match PlatformCredentialsConfig::from_file(&config) {
                Ok(config) => {
                    println!("✅ Configuration is valid!");
                    println!("\nSummary:");
                    println!("  Version: {}", config.version);
                    println!("  Total platforms: {}", config.platforms.len());
                    println!(
                        "  Enabled platforms: {}",
                        config.get_enabled_platforms().len()
                    );

                    // List enabled platforms
                    if !config.get_enabled_platforms().is_empty() {
                        println!("\nEnabled platforms:");
                        for platform in config.get_enabled_platforms() {
                            if let Some(entry) = config.get_platform(&platform) {
                                println!("  - {} ({})", entry.display_name, entry.auth_type);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("❌ Configuration validation failed: {}", e);
                    std::process::exit(1);
                }
            }
        }

        Commands::List { config } => {
            // Load config
            let config = PlatformCredentialsConfig::from_file(&config)?;

            println!("Platform Credentials Configuration");
            println!("==================================");
            println!("Version: {}", config.version);
            println!();

            // Group platforms by status
            let mut enabled = Vec::new();
            let mut disabled = Vec::new();

            for (name, entry) in &config.platforms {
                if entry.enabled {
                    enabled.push((name, entry));
                } else {
                    disabled.push((name, entry));
                }
            }

            // Sort by name
            enabled.sort_by_key(|(name, _)| name.as_str());
            disabled.sort_by_key(|(name, _)| name.as_str());

            // Print enabled platforms
            if !enabled.is_empty() {
                println!("Enabled Platforms ({}):", enabled.len());
                println!("----------------------");
                for (name, entry) in enabled {
                    println!("  📱 {} ({})", entry.display_name, name);
                    println!("     Auth: {}", entry.auth_type);
                    if !entry.credentials.api_base_url.is_empty() {
                        println!("     API: {}", entry.credentials.api_base_url);
                    }
                    if let Some(config) = &entry.config {
                        if let Some(features) = &config.features {
                            let enabled_features: Vec<_> = features
                                .iter()
                                .filter(|(_, v)| **v)
                                .map(|(k, _)| k.as_str())
                                .collect();
                            if !enabled_features.is_empty() {
                                println!("     Features: {}", enabled_features.join(", "));
                            }
                        }
                    }
                    println!();
                }
            }

            // Print disabled platforms
            if !disabled.is_empty() {
                println!("Disabled Platforms ({}):", disabled.len());
                println!("----------------------");
                for (name, entry) in disabled {
                    println!("  ⏸️  {} ({})", entry.display_name, name);
                }
            }
        }

        Commands::Show {
            platform,
            config,
            env,
        } => {
            // Load config
            let config = PlatformCredentialsConfig::from_file(&config)?;

            // Get platform config
            if let Some(entry) = config.get_platform(&platform) {
                println!("Platform: {} ({})", entry.display_name, platform);
                println!("=====================================");
                println!(
                    "Status: {}",
                    if entry.enabled {
                        "✅ Enabled"
                    } else {
                        "⏸️  Disabled"
                    }
                );
                println!("Auth Type: {}", entry.auth_type);
                println!();

                // Get credentials for environment
                let creds = if let Some(env) = env {
                    config
                        .get_platform_for_env(&platform, &env)
                        .unwrap_or_else(|| entry.credentials.clone())
                } else {
                    entry.credentials.clone()
                };

                // Apply defaults
                let creds = config.apply_defaults(creds);

                println!("Credentials:");
                println!("------------");
                println!("  App Key: {}", mask_credential(&creds.app_key));
                println!("  App Secret: {}", mask_credential(&creds.app_secret));
                if let Some(redirect) = &creds.redirect_uri {
                    println!("  Redirect URI: {}", redirect);
                }
                println!("  API Base URL: {}", creds.api_base_url);
                println!("  Rate Limit: {} req/s", creds.rate_limit_rps);

                // Platform-specific fields
                if let Some(store_id) = &creds.store_id {
                    println!("  Store ID: {}", store_id);
                }
                if let Some(base_url) = &creds.base_url {
                    println!("  Base URL: {}", base_url);
                }
                if let Some(org_id) = &creds.tenant_id {
                    println!("  Organization ID: {}", org_id);
                }

                // Configuration
                if let Some(config) = &entry.config {
                    println!("\nConfiguration:");
                    println!("--------------");

                    if let Some(api_version) = &config.api_version {
                        println!("  API Version: {}", api_version);
                    }

                    if let Some(regions) = &config.regions {
                        println!("  Regions:");
                        for (region, url) in regions {
                            println!("    - {}: {}", region, url);
                        }
                    }

                    if let Some(features) = &config.features {
                        println!("  Features:");
                        for (feature, enabled) in features {
                            println!("    - {}: {}", feature, if *enabled { "✅" } else { "❌" });
                        }
                    }

                    if let Some(rate_limits) = &config.rate_limits {
                        println!("  Rate Limits:");
                        println!("    - Requests/sec: {}", rate_limits.requests_per_second);
                        println!("    - Burst size: {}", rate_limits.burst_size);
                        println!("    - Retry after: {}s", rate_limits.retry_after_seconds);
                    }
                }

                // Environments
                if let Some(envs) = &entry.environments {
                    println!("\nEnvironments:");
                    println!("-------------");
                    for env_name in envs.keys() {
                        println!("  - {}", env_name);
                    }
                }
            } else {
                eprintln!("❌ Platform '{}' not found in configuration", platform);
                std::process::exit(1);
            }
        }
    }

    Ok(())
}

/// Mask sensitive credential values for display
fn mask_credential(value: &str) -> String {
    if value.is_empty() {
        "(empty)".to_string()
    } else if value.starts_with("${") && value.ends_with("}") {
        // Environment variable placeholder
        value.to_string()
    } else if value.len() <= 8 {
        // Short value, mask completely
        "*".repeat(value.len())
    } else {
        // Show first 4 and last 4 characters
        format!("{}...{}", &value[..4], &value[value.len() - 4..])
    }
}
