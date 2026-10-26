//! Tolerant readers for the loosely specified JSON that agent stores write.
//!
//! Each agent names the same fact differently (`filePath` / `file_path` / `path`), so
//! parsers ask for the first of several keys. Missing or mistyped values are `None`,
//! never a default that could pass for a measurement.

use serde_json::Value;

/// First non-empty string under one of `keys`.
pub(crate) fn string_at(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_string)
    })
}

/// First non-negative integer under one of `keys` that fits a `u32`.
pub(crate) fn count_at(value: &Value, keys: &[&str]) -> Option<u32> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_u64))
        .and_then(|count| u32::try_from(count).ok())
}

/// A JSON object stored either inline or as a JSON-encoded string.
pub(crate) fn embedded_object(value: Option<&Value>) -> Value {
    match value {
        Some(Value::String(text)) => serde_json::from_str(text).unwrap_or(Value::Null),
        Some(other) => other.clone(),
        None => Value::Null,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn readers_take_the_first_usable_key_and_reject_wrong_types() {
        let value = json!({"a": "", "b": " x ", "n": -1, "m": 7, "s": "{\"k\":1}"});
        assert_eq!(string_at(&value, &["a", "b"]).as_deref(), Some("x"));
        assert_eq!(count_at(&value, &["n", "m"]), Some(7));
        assert_eq!(embedded_object(value.get("s"))["k"], 1);
        assert_eq!(embedded_object(None), Value::Null);
    }
}
