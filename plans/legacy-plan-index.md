# Legacy plan index

`plans/ROADMAP.md` is the only active roadmap for AI attribution, and
`plans/plan-kafka-rabbitmq-adoption.md` is the active plan for the message-broker
workstream. The other files below are historical architecture or evidence
records and must not be treated as current status:

| Record | Disposition |
|---|---|
| `plans/project-intelligence-roadmap-2026-11-08.md` | **Queued** for the next Project Intelligence workstream: all 13 Evolution/Replay/Flagship ideas. Planning only; does not replace the attribution roadmap or resume paused Receipt/Team work. |
| `plans/free-tier-plan-2026-11-10.md` | **Planned** Free tier + personal Pro plan (history window, feature gating, personal billing). Planning only; numbers are proposals awaiting owner decisions. |
| `plan.md` | Legacy/superseded; broad original product plan. §9.22 (Kafka/RabbitMQ) survives only as the design referenced by `plans/plan-kafka-rabbitmq-adoption.md`, which wins where they conflict. |
| `plans/plan-kafka-rabbitmq-adoption.md` | **Active** for the Kafka/RabbitMQ message-broker workstream (outside the AI-attribution scope of `ROADMAP.md`). |
| `planai.md`, `planai2.md` | Architecture/reference only. |
| `plan-phase8.md` | Production-inference objective superseded; retain only diagnostics/onboarding ideas. |
| `planplugin.md` and progress ledgers | Adapter/certification evidence records. |
| `plans/planplugin/*` | Per-adapter evidence/checklists, not roadmap authority. |

Some of these records live in the local backup/worktree rather than the clean
`origin/main` baseline. Do not merge those branches wholesale. If an older file
is restored, keep this disposition banner and link back to `ROADMAP.md`.
