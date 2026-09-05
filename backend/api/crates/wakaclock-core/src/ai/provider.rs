//! Canonical provider identity for the universal AI producer contract.
//!
//! A coding client (Codex, Claude Code, Kilo, …) and the model provider it
//! routes a request to are separate dimensions.  This module is the one place
//! where provider aliases and documented API hosts are mapped.  In particular,
//! a model display name or an arbitrary OpenAI-compatible gateway is never
//! enough to infer `deepseek`.

/// Stable provider identifiers emitted on broker events.
pub const KNOWN_PROVIDER_IDS: &[&str] = &[
    "anthropic",
    "deepseek",
    "github",
    "google",
    "moonshot",
    "openai",
];

/// Return the canonical id for an explicitly named, known provider alias.
/// Unknown values return `None` so the producer can preserve them as bounded
/// opaque metadata instead of guessing from a model name.
pub fn canonical_provider_alias(raw: &str) -> Option<&'static str> {
    let lowered = raw.trim().to_ascii_lowercase();
    let compact: String = lowered
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect();
    match compact.as_str() {
        "openai" | "openaiapi" | "apiopenaicom" => Some("openai"),
        "anthropic" | "anthropicapi" | "apianthropiccom" => Some("anthropic"),
        "moonshot" | "moonshotai" | "kimi" | "kimiapi" | "apimoonshotcn" => Some("moonshot"),
        "deepseek" | "deepseekapi" | "apideepseekcom" => Some("deepseek"),
        "google" | "googleai" | "gemini" => Some("google"),
        "github" | "githubcopilot" => Some("github"),
        _ => None,
    }
}

/// Map a documented API host or URL to a provider.  Only first-party hosts
/// are accepted; a custom proxy such as `llm.example.test` remains unknown.
pub fn provider_for_endpoint(raw: &str) -> Option<&'static str> {
    let mut value = raw.trim().to_ascii_lowercase();
    if let Some((_, remainder)) = value.split_once("://") {
        value = remainder.to_string();
    }
    value = value.split('/').next().unwrap_or_default().to_string();
    value = value.split('@').next_back().unwrap_or_default().to_string();
    if let Some((host, _port)) = value.rsplit_once(':') {
        // Keep an IPv6-ish value unknown; a normal hostname with a port is
        // safe to reduce to its host component.
        if !host.contains(']') {
            value = host.to_string();
        }
    }
    match value.as_str() {
        "api.openai.com" => Some("openai"),
        "api.anthropic.com" => Some("anthropic"),
        "api.deepseek.com" => Some("deepseek"),
        "api.moonshot.cn" => Some("moonshot"),
        "generativelanguage.googleapis.com" | "ai.google.dev" => Some("google"),
        "api.github.com" => Some("github"),
        _ => None,
    }
}

/// Return the accepted aliases for a canonical provider id.  This reverse map
/// is used by adapters when presenting a provider switch and is intentionally
/// exhaustive for the known ids.
pub fn provider_aliases(canonical: &str) -> Option<&'static [&'static str]> {
    match canonical.trim().to_ascii_lowercase().as_str() {
        "openai" => Some(&["openai", "openai-api", "api.openai.com"]),
        "anthropic" => Some(&["anthropic", "anthropic-api", "api.anthropic.com"]),
        "moonshot" => Some(&["moonshot", "moonshot-ai", "kimi", "api.moonshot.cn"]),
        "deepseek" => Some(&["deepseek", "deepseek-api", "api.deepseek.com"]),
        "google" => Some(&[
            "google",
            "google-ai",
            "gemini",
            "generativelanguage.googleapis.com",
        ]),
        "github" => Some(&["github", "github-copilot", "api.github.com"]),
        _ => None,
    }
}

/// Whether an id is one of the providers with a documented first-party alias.
pub fn is_known_provider_id(raw: &str) -> bool {
    canonical_provider_alias(raw).is_some_and(|id| KNOWN_PROVIDER_IDS.contains(&id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deepseek_aliases_are_exhaustive_and_case_insensitive() {
        for alias in [
            "deepseek",
            "DeepSeek API",
            "deepseek_api",
            "api.deepseek.com",
        ] {
            assert_eq!(canonical_provider_alias(alias), Some("deepseek"));
        }
        assert_eq!(provider_aliases("DEEPSEEK").unwrap().len(), 3);
    }

    #[test]
    fn first_party_hosts_map_but_custom_gateways_do_not() {
        assert_eq!(
            provider_for_endpoint("https://api.deepseek.com/v1"),
            Some("deepseek")
        );
        assert_eq!(
            provider_for_endpoint("api.deepseek.com:443"),
            Some("deepseek")
        );
        assert_eq!(provider_for_endpoint("https://llm.example.test/v1"), None);
        assert_eq!(
            canonical_provider_alias("DeepSeek-compatible gateway"),
            None
        );
    }

    #[test]
    fn every_known_provider_has_a_reverse_mapping() {
        for provider in KNOWN_PROVIDER_IDS {
            let aliases = provider_aliases(provider).expect("reverse mapping missing");
            assert!(!aliases.is_empty());
            assert_eq!(canonical_provider_alias(aliases[0]), Some(*provider));
        }
    }

    #[test]
    fn model_names_are_not_provider_evidence() {
        assert_eq!(canonical_provider_alias("deepseek-chat"), None);
        assert!(!is_known_provider_id("deepseek-chat"));
    }
}
