# Copilot fixtures

`agent_edit_session.jsonl` is **synthetic**. Its envelope (`type`, `id`, `parentId`,
`timestamp`, `data`) and the `session.start`, `user.message`, `assistant.message`
(`toolRequests`), `assistant.turn_start`/`turn_end` event types match a real local VS Code
Copilot transcript inspected key-by-key on 2026-10-26. The tool-execution and usage events
(`tool.execution_complete`, `assistant.usage`, `session.model_change`) and their fields are
assumed from public Copilot CLI event names; no real local sample contained them yet.
Replace with a sanitized real capture during the combined live test step.
