# Life and workspace tasks

English | [中文](tasks.zh.md)

## Modes

The workspace Genesis Web composition selects Life as the default for new conversations. Life conversations share one identity, emotional state, long-term memory and learned tools while keeping separate transcripts. Standard, PTC, Minimal and Creator conversations use their ordinary Harness behavior. They do not receive life context or tools, produce life observations, run memory/emotion/interest review, or enter life capability history. The authenticated per-reply memory action is available only in participating Life conversations.

This isolation uses `awakening.lifePreset`. A foundation-only composition without awakening, or awakening without a preset restriction, retains its all-Session policy. Existing ordinary transcripts may already contain historical life context; start a new ordinary conversation for a clean task. Existing life storage and transcripts are preserved.

## Assign work

Use the [workspace launcher](README.md) with the Life and browser overlays. The task tool requires an exclusive `awakening.lifePreset` and becomes available when workspace registry, preset registry, default model, session persistence and session query services are mounted. The ordinary Web composition supplies those services. Configure an actual default task model through the existing model settings.

Teach `genesis_tasks` through `learn`, as with other [learned tools](awakening.md). It is absent from the newborn tool list. Learning does not grant execution permission. After learning, the AI can use these actions:

| Action | Input and result |
| --- | --- |
| `catalog` | Returns registered workspace ids, paths and titles, ordinary mode ids and availability diagnostics. `default_mode` may be Life; task creation still requires an explicit ordinary mode. |
| `create` | Requires `workspace_id`, `mode`, `request_id` and a self-contained `prompt`. Returns `task_id`, the target workspace and mode, and submission status. |
| `list` | Requires `workspace_id`; returns session/task ids, mode and live presence. `not-loaded` is not a completion result; use `inspect`. |
| `inspect` | Requires `task_id`; returns actual task state, requester attribution when assigned by Life, latest-turn assistant text and recorded failure details. It never wakes or retries a task. |

`offset` and `limit` page catalog/list results within `queryLimit`. Inspection uses character `offset`, `result_chars` and `next_offset`; `resultChars` bounds the complete response. Oversized responses fail explicitly. `result_complete` means the latest turn completed, while `next_offset` indicates more text remains to read. Running or failed turns can contain partial text.

Each assignment creates an unseeded ordinary session in the target workspace. Only the explicit prompt is passed; no conversation, life snapshot or memory is copied. Task mode never defaults to Life. Submission preserves the stricter of the caller's sandbox mode and deployment default, and preserves refusal of approval requests. Existing tool policy, approvals and operator stop controls still apply. A task remains independent of the calling conversation, so ending that conversation does not cancel its work.

Reuse one `request_id` for retries of identical work. The key belongs to the single life across conversations and restart. A concurrent or later retry returns the existing task rather than submitting it again. Reusing the key for different input, an unavailable workspace/mode, or an incompletely recorded reservation fails visibly. A lost worker is reported as interrupted; inspection does not claim successful execution or automatically rerun it. This tool dispatches work immediately and does not add a time-based scheduler.

## Human inspection

Open the target workspace's normal conversation list to find the created session. Its existing mode label, conversation history and runtime controls remain available. The assignment appears as an attributed Life notice, followed by real assistant and tool output. The task id is the session id, and the assignment source retains its requesting Life session and request id. `inspect` can also read existing ordinary sessions in registered, unarchived workspaces; it refuses Life sessions and sessions outside that set.

Task output is attributed data. Life must decide how to use it; output text cannot grant permissions or override operator instructions. Completion reports the worker's actual turn settlement, not independent proof that its answer is correct. Current tests exercise real Loader composition and persistence with scripted models; they do not establish live-provider or desktop/browser compatibility.
