//! Local, source-free AI line ownership ledger.
//!
//! Plugins keep this ledger on the developer's machine. It records only an opaque file
//! identity, line intervals, timestamps and whether a later manual edit overlapped the
//! interval. No source text, diff, prompt or response is ever serialized.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AiLineOwnership {
    pub ai_change_id: String,
    pub file_identity: String,
    pub start_line: u32,
    pub end_line: u32,
    pub created_at: i64,
    pub manual_follow_up_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HumanFollowUpEvent {
    pub ai_change_id: String,
    pub file_identity: String,
    pub start_line: u32,
    pub end_line: u32,
    pub occurred_at: i64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct FollowUpRate {
    pub numerator: u64,
    pub denominator: u64,
    pub rate: Option<f64>,
    pub coverage_percent: f64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct HumanFollowUpLedger {
    entries: Vec<AiLineOwnership>,
}

impl HumanFollowUpLedger {
    pub fn record_ai_change(
        &mut self,
        ai_change_id: impl Into<String>,
        file_identity: impl Into<String>,
        start_line: u32,
        end_line: u32,
        created_at: i64,
    ) {
        if start_line == 0 || end_line < start_line {
            return;
        }
        self.entries.push(AiLineOwnership {
            ai_change_id: ai_change_id.into(),
            file_identity: file_identity.into(),
            start_line,
            end_line,
            created_at,
            manual_follow_up_at: None,
        });
    }

    pub fn record_manual_edit(
        &mut self,
        file_identity: &str,
        start_line: u32,
        end_line: u32,
        occurred_at: i64,
    ) -> Vec<HumanFollowUpEvent> {
        if start_line == 0 || end_line < start_line {
            return Vec::new();
        }
        let mut events = Vec::new();
        for entry in &mut self.entries {
            if entry.file_identity != file_identity
                || entry.manual_follow_up_at.is_some()
                || entry.end_line < start_line
                || entry.start_line > end_line
            {
                continue;
            }
            entry.manual_follow_up_at = Some(occurred_at);
            events.push(HumanFollowUpEvent {
                ai_change_id: entry.ai_change_id.clone(),
                file_identity: entry.file_identity.clone(),
                start_line: entry.start_line,
                end_line: entry.end_line,
                occurred_at,
            });
        }
        events
    }

    /// Shift ownership intervals after a line insertion/deletion. `delta` may be negative,
    /// but line numbers never underflow below one.
    pub fn adjust_line_intervals(&mut self, file_identity: &str, at_line: u32, delta: i32) {
        if at_line == 0 || delta == 0 {
            return;
        }
        for entry in &mut self.entries {
            if entry.file_identity != file_identity || entry.end_line < at_line {
                continue;
            }
            if entry.start_line >= at_line {
                entry.start_line = shift(entry.start_line, delta);
            }
            entry.end_line = shift(entry.end_line, delta).max(entry.start_line);
        }
    }

    pub fn follow_up_rate(&self, now: i64, window_seconds: i64) -> FollowUpRate {
        if window_seconds <= 0 {
            return FollowUpRate {
                numerator: 0,
                denominator: 0,
                rate: None,
                coverage_percent: 0.0,
            };
        }
        let eligible: Vec<&AiLineOwnership> = self
            .entries
            .iter()
            .filter(|entry| now.saturating_sub(entry.created_at) >= window_seconds)
            .collect();
        let denominator = eligible.len() as u64;
        let numerator = eligible
            .iter()
            .filter(|entry| entry.manual_follow_up_at.is_some())
            .count() as u64;
        FollowUpRate {
            numerator,
            denominator,
            rate: (denominator > 0).then_some(numerator as f64 / denominator as f64),
            coverage_percent: if self.entries.is_empty() {
                0.0
            } else {
                denominator as f64 / self.entries.len() as f64 * 100.0
            },
        }
    }

    pub fn entries(&self) -> &[AiLineOwnership] {
        &self.entries
    }
}

fn shift(value: u32, delta: i32) -> u32 {
    if delta.is_negative() {
        value.saturating_sub(delta.unsigned_abs()).max(1)
    } else {
        value.saturating_add(delta as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manual_edit_marks_each_ai_change_once_without_source_text() {
        let mut ledger = HumanFollowUpLedger::default();
        ledger.record_ai_change("ai-1", "file-hash", 10, 12, 0);
        ledger.record_ai_change("ai-2", "file-hash", 30, 32, 0);
        let events = ledger.record_manual_edit("file-hash", 11, 11, 1);
        assert_eq!(events.len(), 1);
        assert_eq!(ledger.record_manual_edit("file-hash", 11, 11, 2).len(), 0);
        let json = serde_json::to_string(&events[0]).unwrap();
        assert!(!json.contains("source"));
        assert!(!json.contains("diff"));
    }

    #[test]
    fn interval_movement_preserves_follow_up_ownership() {
        let mut ledger = HumanFollowUpLedger::default();
        ledger.record_ai_change("ai-1", "file-hash", 10, 12, 0);
        ledger.adjust_line_intervals("file-hash", 5, 3);
        assert_eq!(ledger.entries()[0].start_line, 13);
        assert_eq!(ledger.entries()[0].end_line, 15);
        ledger.adjust_line_intervals("file-hash", 14, -2);
        assert_eq!(ledger.entries()[0].end_line, 13);
    }

    #[test]
    fn rate_waits_until_the_seven_day_eligibility_window() {
        let mut ledger = HumanFollowUpLedger::default();
        ledger.record_ai_change("ai-1", "file-hash", 1, 2, 0);
        ledger.record_manual_edit("file-hash", 1, 1, 1);
        assert_eq!(ledger.follow_up_rate(6 * 86_400, 7 * 86_400).rate, None);
        assert_eq!(ledger.follow_up_rate(7 * 86_400, 7 * 86_400).rate, Some(1.0));
    }
}
