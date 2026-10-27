# Genesis proactive messages

English | [中文](social.zh.md)

## Configuration and status

Open Settings → Proactive messages. Save the enable switch, optional target conversation ID, check interval, minimum send interval, rolling twenty-four-hour limit, quiet interval, important-memory threshold, pending capacity and opportunity lifetime. Durations in this editor are seconds; persisted settings and `socialInitiative` configuration use milliseconds. Saved settings override deployment defaults and survive restart. Stale writes retain the draft until explicit reload.

The source-workspace Life overlay loads the worker paused. Enable it in the page to start opportunities. Other profiles must explicitly compose `socialInitiative` alongside memory and deliberation; absence is shown as unavailable while saved history remains readable. Existing explicit `socialInitiative: {}` deployments retain enabled-by-default behavior. Setting a target ID does not create or open that conversation. Without a target, the worker selects the latest idle character conversation with real user activity. Once consideration starts, that opportunity retains its chosen conversation.

The page shows sampled runtime state, next scheduled check, last opportunity, actual live channels, counts, the most recent confirmed message and bounded opportunity history. Refresh reads the backend again; failed reads retain the preceding sample. Previews and omitted records are marked. Pending or queued work never implies delivery. Model and transport diagnostics appear with their affected records; raw auxiliary responses remain in the Session audit log. Pausing stops new opportunities and queued-notice admission; an assistant turn already admitted may finish.

## Decision and delivery

While dsh runs, a timer or a completed goal, important memory, or new autonomous goal offers one opportunity. The steady-state timer starts its next delay after a check completes; saving policy reschedules it. Consideration and reconciliation are serialized. The durable event cursor prevents repeatedly scanning prior triggers, and enabling or pausing starts event consideration from the current position rather than replaying events accumulated while paused. Other setting changes retain unprocessed events. The existing writer considers bounded emotion, motivations, memories and relationships; it can choose silence. No separate social drive or fixed message is introduced.

An accepted choice checks cooldown, rolling limit, user quiet time, opportunity expiry and channel availability. Limits are checked again when the notice enters a turn, with real user input taking priority. Missing or busy channels leave the opportunity pending; expired opportunities are skipped. Durations use wall-clock time independently of the emotion offline-time switch. Pending records, decision attribution and successful or uncertain delivery times preserve limits across restart.

The worker reserves dispatch durably before enqueueing a source-tagged `genesis-initiative` notice. The notice is internal model context, not operator-authored input. The ordinary Harness loop generates the outgoing `assistant/message` in Genesis's voice. The proactive turn cannot use task tools and grants no additional permission. Only the actual committed assistant receipt supplies the message sequence, content and send time. The receipt projection replays from the Session log.

## Recovery and limits

An interrupted prefix or a completed turn without an assistant receipt is uncertain, with the safe turn failure code when available. A dispatch reservation whose original conversation is unavailable after restart also becomes uncertain instead of blocking every future opportunity. Uncertain records are not automatically resent and count against delivery limits. If the original Session later becomes available with a valid complete receipt, reconciliation can confirm that same delivery without generating another message. Inspect the original conversation before deciding how to proceed.

Storage or backup uncertainty stops dependent life operations. The finite pending queue and global life-state budgets remain enforced; records are not silently dropped. See [upgrade compatibility](../upgrade-guide/v0.2.1-rc.2/genesis-proactive-controls/guide.md) before downgrading a store containing the added settings and cursor.

Delivery uses a running, idle Harness character conversation and a configured model route. It does not run while the process is stopped. Isolated Loader tests exercise timer and event opportunities, silence, limits, assistant roles, failed delivery, receipts and restart deduplication; scripted models do not establish production-provider quality. The settings page uses the authenticated generated Remote service and shared on-demand resource, without opening another listener.
