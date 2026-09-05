# VS Code capability spike — human-input proof, version identity, formatter/paste/IME

วันที่: 2026-09-05 · Task: [F0-04](../plans/ai-coverage-task-ledger.md) · สถานะ: capability inventory, ไม่ใช่ implementation

Scope per [ai-coverage-execution-plan.md](../plans/ai-coverage-execution-plan.md)
§7 (F0 item 5): "ทำ capability spike ของ editor input และ exact reconciliation;
ถ้า API ให้ได้เพียง weak evidence ให้ documented unknown เป็นผลถูกต้อง" — this
spike answers *what the VS Code extension API can and cannot prove*, against
the extension's current source (`extensions/vscode/src/`), not against a
theoretical ideal API.

## 1. What the extension actually observes today

The only editor-content signal available to `HeartbeatBufferManager` is
`vscode.workspace.onDidChangeTextDocument`, wired in
[`events.ts:39`](../extensions/vscode/src/events.ts). Its payload
(`TextDocumentChangeEvent`) carries: the changed ranges/text, the document, and
one optional field, `reason?: TextDocumentChangeReason`.

`TextDocumentChangeReason` (VS Code's own enum, unchanged since it was
introduced) has exactly two members: `Undo = 1`, `Redo = 2`. There is no third
value. `buffer.ts:35-40` mirrors this directly:

```ts
const TEXT_DOCUMENT_CHANGE_REASON_UNDO = 1;
const TEXT_DOCUMENT_CHANGE_REASON_REDO = 2;
```

**Consequence**: `reason` is `undefined` for every one of the following, and the
API gives no way to tell them apart from that field alone:
- a human physically typing a character,
- a human pasting text (Cmd+V),
- an IME committing a composed character (see §3),
- format-on-save or format-on-type rewriting the buffer,
- a linter's "quick fix" or a snippet expansion,
- another extension calling `TextEditor.edit()` or `WorkspaceEdit`,
- an AI agent (Claude Code, Copilot, Cursor Tab, etc.) writing to the file
  directly on disk, which VS Code then reflects as a document change if the
  file is open.

`onDidChangeTextDocument` is a *content* event, not an *input* event. VS Code
extensions have no keydown/keyup API for the editor surface (only for
command-palette-bound keybindings, which is a different surface entirely).

## 2. "Keystrokes" is a heuristic on content deltas, not a keyboard count

`summarizeTextChanges` (`utils.ts:36-64`) computes:

```ts
keystrokes += Math.max(change.text.length, change.rangeLength, 1);
```

This is evidence of *"one or more content-change events of at least this
size happened,"* not *"this many keys were pressed."* A single paste of 500
characters counts as `keystrokes: 500` by this formula unless clipboard
tracking is enabled and recognizes it as a paste (`buffer.ts:139`:
`state.keystrokes += paste ? 0 : summary.keystrokes` — paste is excluded
*only when* `ClipboardActivityTracker` positively identifies the change as a
paste via the custom `application/vnd.atoaxis.clipboard-token` MIME type
negotiated in `events.ts:70-96`). An IME-committed multi-character string, or
a single `WorkspaceEdit` from an extension, both look identical to this
counter as "one large keystroke burst." **Any consumer of this field must
treat it as an activity-volume signal, not proof of physical typing** — the
codebase does not currently make this claim anywhere else, and this spike
confirms it should stay that way.

## 3. IME (composed input): no dedicated API, cannot be distinguished

VS Code does not expose an IME composition-start/update/end event to
extensions (unlike a browser's `compositionstart`/`compositionupdate`/
`compositionend` DOM events). By the time `onDidChangeTextDocument` fires for
an IME-committed character, the editor has already resolved the composition
into plain text — the extension sees one ordinary content-change event with
`reason: undefined`, indistinguishable from a paste or a single fast keystroke.
There is no code in this extension attempting IME detection (`grep` for
`composition`/`IME` in `src/` returns nothing), and there is no VS Code API
this spike found that would let it added. **Verdict: must stay unknown/unproven
input method — do not build a "type-vs-IME" distinction on top of this event.**

## 4. Format-on-save / formatter rewrites: theoretically distinguishable, not currently done

Unlike IME, a formatter-driven rewrite *is* structurally distinguishable in
principle: `vscode.workspace.onWillSaveTextDocument` fires before
format-on-save applies, and a formatter's edit arrives as a single
`onDidChangeTextDocument` event immediately adjacent to a save, often
replacing large spans (whole-document range) in one change. Today's code does
not correlate save timing with the content-change event to flag "this specific
change looks like a formatter pass" — `changeReason` only ever distinguishes
undo/redo, never a formatter. This is a **real gap the extension could close**
(a save-adjacency heuristic), but it would only ever be a heuristic — a human
manually invoking "Format Document" produces an identical shape to
format-on-save, and a small formatter change (e.g. trailing-whitespace strip)
can be indistinguishable in size from a real edit. **Recommendation for F1**:
if pursued, treat a matched formatter-shape change as `unattributed`
activity-with-no-line-claim rather than promoting it to either Human or AI —
consistent with D06's "absence of proof is not proof of the other side."

## 5. Version identity: extension version is known; host application identity is not

`extension.ts:41` reads `context.extension.packageJSON.version` (the AtoAxis
VS Code extension's own version, e.g. `0.1.0` — see
[ai-coverage-baseline-2026-09-05.md](ai-coverage-baseline-2026-09-05.md) §3)
and sends it as part of the user agent (`wakaclock-vscode/${extensionVersion}`,
`extension.ts:47`). **This spike found no use anywhere in `src/` of
`vscode.version` (the actual VS Code build, e.g. `"1.94.2"`) or
`vscode.env.appName`/`vscode.env.appHost`/`vscode.env.uiKind`** (confirmed by
`grep`, zero matches).

This matters specifically for the human-input question: VS Code's extension
API is also the API surface for every VS Code *fork* — Cursor, Windsurf, Trae,
and others — each of which ships its own built-in AI features (inline
completions, agent/"Tab" edit modes) that write to the buffer through the
exact same `TextDocument` machinery this extension observes, with `reason:
undefined`, exactly like human typing. `vscode.env.appName` is how an
extension can tell it is running inside "Cursor" rather than "Visual Studio
Code" today, without needing that fork's own proprietary AI-detection API
(which likely doesn't exist for third-party extensions anyway). Not knowing
the host application means an untagged text change inside a fork with its own
AI features cannot even be *flagged as elevated risk* of being AI-authored —
it is silently treated the same as vanilla-VS-Code human typing.

**Recommendation for F1/F2**: capture `vscode.env.appName` (and `vscode.version`
for ordinary version-skew diagnostics, e.g. `F2` health reporting) alongside
the existing `extensionVersion` in the heartbeat/diagnostics payload. This does
not solve fork-native-AI attribution — that would need each fork's own
adapter, out of scope here and not listed in the F5 agent backlog today — but
it turns a currently-invisible risk into a documented one, and lets F6
dashboards show "editor: Cursor" rather than a generic "vscode" label that
implies more certainty than exists.

## 6. Summary: what can be asserted, what must stay unknown

| Signal | Can the current API prove it? | Current code claims it? | Should it? |
| --- | --- | --- | --- |
| Undo/redo replay | Yes — `TextDocumentChangeReason` | Yes (`buffer.ts` undo/redo constants) | Yes, this one is sound |
| "A content change of about N characters happened" | Yes — `change.text`/`rangeLength` | Yes (`keystrokes`, `charsAdded`) | Yes, as an activity-volume metric only |
| "A human pressed N keys" | **No** — no keyboard event API | No (see §2) | Must not — keep as a volume heuristic, not a typing guarantee |
| Paste vs typed | Only when the custom clipboard MIME token round-trips (`clipboardTracking.ts`) | Yes, conditionally | Yes, but falls back silently to "keystroke" if the token is absent (e.g. paste from outside VS Code without the extension's own copy having tagged it) — that fallback is itself an unproven guess, already accepted as a known limitation, not addressed by this spike |
| IME composition vs direct typing | **No** — no composition API exposed to extensions | No | Correctly not claimed anywhere; must stay unknown |
| Formatter/extension-driven rewrite vs human edit | Partially, via a save-adjacency heuristic — **not implemented** | No | If implemented later, only as a heuristic that falls back to unattributed, never to Human or AI |
| Host application identity (VS Code vs Cursor/Windsurf/etc.) | Yes — `vscode.env.appName` | **No** — not read anywhere | Should be captured (F1/F2), not yet done |
| Extension version | Yes | Yes (`extension.ts:41`) | Already correct |
| VS Code build version | Yes — `vscode.version` | **No** — not read anywhere | Should be captured for F2 diagnostics |

## 7. Non-goals of this spike

- Does not implement any of the "should" recommendations above — those belong
  to F1 (attribution correctness) or F2 (diagnostics), not F0.
- Does not evaluate JetBrains/Neovim/Zed capability surfaces — that is F7-05,
  a separate task.
- Does not propose a specific "formatter heuristic" algorithm — only records
  that one is theoretically possible and what it must degrade to when wrong.
