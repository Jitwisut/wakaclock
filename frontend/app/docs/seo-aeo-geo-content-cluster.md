# AtoAxis SEO/AEO/GEO content cluster

This is the eight-week editorial backlog for the first post-launch content cycle. Each article
should be published in English at the root and as a natural Thai adaptation under `/th`, with a
self-canonical URL, `hreflang`, one visible answer paragraph, and a clear Early Access CTA.

| Week | English topic | Thai adaptation | Search / answer intent | Primary evidence or source |
| --- | --- | --- | --- | --- |
| 1 | How a WakaTime-compatible API works | WakaTime-compatible API ทำงานอย่างไร | Understand the protocol and the `api_url` change | AtoAxis heartbeat handlers and WakaTime API docs |
| 2 | How to migrate data from WakaTime | วิธีนำเข้าข้อมูลจาก WakaTime | Decide whether existing history can move | AtoAxis import implementation and official WakaTime export docs |
| 3 | How coding time is calculated from heartbeats | วิธีคำนวณ coding time จาก heartbeat | Verify session and idle-time methodology | AtoAxis heartbeat/session service and a worked example |
| 4 | AI coding analytics vs productivity metrics | AI coding analytics ต่างจาก productivity metrics อย่างไร | Separate observable activity from quality claims | AtoAxis AI fields; explain what is not measured |
| 5 | Tracking Claude Code, Codex CLI and Gemini CLI | ติดตาม Claude Code, Codex CLI และ Gemini CLI | Configure supported agent hooks safely | Repository hooks and each tool’s official documentation |
| 6 | Privacy of developer activity tracking | Privacy ของ developer activity tracking | Decide whether file-path metadata is acceptable | AtoAxis heartbeat schema, Privacy page and deletion process |
| 7 | Why a complete coding history is useful | Complete coding history มีประโยชน์อย่างไร | Compare long-term reflection with recent-window reports | AtoAxis retention design and dated competitor sources |
| 8 | Team coding presence and prototype limits | Team coding presence และข้อจำกัดของ prototype | Set expectations for the in-development Teams concept | Teams page, visible limitations and Early Access status |

## Publication rules

- Start every article with a 40–80 word direct answer, followed by how it works, use cases,
  limitations and visible FAQs. The FAQ JSON-LD must be generated from the same visible entries.
- Link to the relevant product, docs, privacy and Early Access pages. Do not invent ratings,
  customer counts, availability, pricing checkout or team-production claims.
- For competitor comparisons, link to primary sources, show `Reviewed: YYYY-MM-DD`, and set the
  next review for one month later. Update the comparison only after checking the source again.
- Keep EN and TH as separate pages. Translate intent and examples naturally; do not mechanically
  replace English words with Thai tokens.
- Add the article URL to `llms.txt` only after the page is live, crawlable and included in the
  canonical route inventory.
