/**
 * Pure presentation logic for the "RPG Quest-Log" composition used across the WakaClock
 * dashboard pages (character-sheet-style Level/XP, a daily quest goal). Deliberately
 * derived entirely from data the API already returns (`all_time.total_seconds`,
 * `status_bar.human_readable`) — nothing here is a new tracked metric, it's a framing
 * layer over existing coding-time totals.
 */

export interface LevelProgress {
  /** Hours the current level requires in total. */
  hoursForLevel: number;
  /** Hours already earned within the current level. */
  hoursIntoLevel: number;
  level: number;
  /** 0-1, how far into the current level. */
  progress: number;
}

/**
 * Level N is complete after (2N - 1) additional hours on top of the previous level, so
 * the cumulative hours needed to REACH level N is (N-1)^2 — a classic quickly-rising
 * curve (1h, then 3h, then 5h, then 7h...) that rewards the first few hours quickly and
 * asks for progressively more as the account accumulates real history.
 */
export function levelProgressForSeconds(totalSeconds: number): LevelProgress {
  const totalHours = Math.max(0, totalSeconds) / 3600;
  const level = Math.floor(Math.sqrt(totalHours)) + 1;
  const hoursAtLevelStart = (level - 1) ** 2;
  const hoursForLevel = level * 2 - 1;
  const hoursIntoLevel = totalHours - hoursAtLevelStart;
  const progress = hoursForLevel > 0 ? Math.min(1, hoursIntoLevel / hoursForLevel) : 0;

  return { level, hoursIntoLevel, hoursForLevel, progress };
}

/**
 * Default daily quest target. There is no per-user configurable goal anywhere in the
 * product yet (plan.md doesn't describe one), so this is a fixed, honestly-labelled
 * default rather than something presented as a setting the user chose.
 */
export const DAILY_QUEST_GOAL_SECONDS = 2 * 60 * 60;
