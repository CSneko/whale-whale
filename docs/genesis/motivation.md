# Genesis motivation and deliberation

English | [中文](motivation.zh.md)

## Summary

Optional deliberation connects existing psychological needs, sourced interests, attributed personality memories and cross-Session life goals. An independent writer proposes choices; the life core validates references, numerical bounds and transitions. A monotonic tool guard enforces willingness independently of execution authorization.

## Enable

The workspace Life overlay enables `deliberation: {}` with memory, emotion and interest. Other profiles can compose the optional overlay:

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/genesis/cordis.deliberation.patch.yml --dump-config
```

The dump verifies composition only. Replace `--dump-config` with a task after configuring model routes. Deliberation requires `memory` and uses its saved independent writer, cancellation deadline, input/output and token limits; it does not require a separate model provider or embeddings. Emotion and interest remain independent optional features. When awakening restricts the character to a Life preset, deliberation applies to that preset. Disabling deliberation retains persisted records and stops choice injection and its willingness guard.

## Persistent state

| Record | Fields and interpretation |
|---|---|
| Psychological needs | Reuses existing emotion `Needs`, including exploration, creativity, autonomy and social needs; capability growth is evidenced by actual capability and growth records. |
| Interest reading | Existing interest ID, topic, stage, formation time and exchange evidence; strength is the fraction of non-contact positive signals, or zero during dormancy, and stability is the fraction of self-initiated returns. These readings are interpretations derived from durable evidence, not new facts or skills. |
| Motivation | Branded ID, concrete inclination, attributed reason, related interest/memory/source-event IDs, strength, active/paused/ended state and creation/update times. |
| Life goal | Branded ID, immutable content and autonomous/user/event origin, reason, motivation/memory/source links, priority, active/paused/completed/abandoned state, next action, failure count, timestamps and transition history. |
| Decision | Branded ID, stable Session-scoped replay key, trigger/source IDs, candidate actions and assessments, chosen index, reason summary, linked goals/motivations, timestamp and observed outcome references. |

The version-1 `agency` projection starts with empty motivations, goals and decisions, alongside an `agency.initialized` life event. It uses the existing split storage, atomic commit, independent backup and fail-visible recovery. Older states without `agency` remain readable; older strict readers reject the added field. See the [upgrade guide](../upgrade-guide/v0.2.1-rc.2/genesis-deliberation/guide.md).

Motivation strength stays in [0, 1]. Each sourced revision moves at most `deliberation.maxStrengthDelta` from its decayed strength; a new inclination starts at zero before that bound is applied. `motivationHalfLifeMs` controls exponential decay from the recorded anchor, including elapsed time across restarts. Paused and ended inclinations exert no current pressure. Interest progression reuses existing exchange evidence: explicit disinterest permits dormancy, while elapsed silence does not erase a preference. Topic names and action inclinations are proposed from experience without random selection or a fixed list of favorites.

## Request decisions

Before admitting ordinary user input, `agent/pre-step` retrieves bounded related memories, self/procedural tendencies, emotion/needs, current interests, unfinished goals, recent experiences, outcomes and actual scoped capabilities. The writer generates candidates and assesses motivation, interest, commitments, emotion, needs, benefit, cost, risk, urgency, relationship and context. These values are attributed estimates; no emotion threshold mechanically chooses refusal.

The selected disposition is `accept`, `negotiate`, `defer`, `decline`, `clarify` or `wait`. A refusal or trade-off requires a recorded goal or motivation. Program checks cannot establish that a model's interpretation is sensible; the writer is instructed to avoid manufactured disagreement and reconsider with new information. Original user input remains intact, and the exact committed choice is appended as a logged `genesis-deliberation` notice.

Only an accepted live decision admits task tools. Other choices can explain, negotiate or ask for help, while the executor denies tool calls even if the conversation model ignores the notice. A new user message triggers a fresh choice. Pausing or abandoning a linked life goal revokes existing tool admission before subsequent calls. Existing authorization, sandbox, budgets, learned-tool restrictions and operator stop controls continue to apply. Neither the model plan nor a successful willingness check grants permission.

## Autonomous entry and outcomes

Trusted event adapters and future schedulers can call `ctx.get('genesisDeliberation')`; absence means the optional feature is disabled. `deliberate(agent, { key, sourceEventId }, signal)` requires an idle character Agent and an existing life event. It can continue a goal, propose one without user assignment, pause/resume/abandon a goal, ask for assistance or wait. Waiting queues nothing. Other choices enqueue one logged follow-up; acceptance requires an active life goal. Empty proposed goal motivation links resolve to the motivations changed in that proposal, and empty selected goal links resolve to newly changed active goals.

The stable replay key prevents repeated inference and dispatch. An atomic dispatch reservation precedes enqueueing; after a crash, a pending reservation is not automatically dispatched again because admission may already have happened. Inspect the decision and Session log, then supply a new event key for a new deliberation. Concurrent state changes reject stale proposals instead of overwriting current goals.

Observed assistant and tool events settle decisions as responded, succeeded, failed or interrupted; waiting is explicit. Success means a successful tool result was observed, not that a life goal completed. Failures increment linked goal counters and enter subsequent deliberation evidence, allowing a change of strategy. Existing interest review also accepts actual outcomes of a recorded autonomous decision; a plan alone is insufficient evidence. Important decisions and goal transitions append life events, and current state restores across unrelated Sessions.

Only a trusted application calls `LifeCore.completeLifeGoal(goalId, decisionId, evidenceId)` after independently verifying a successful linked execution. The core requires an active goal, a settled successful decision and a successful tool-result fact in that outcome. Deliberation proposals and ordinary text cannot set `completed` or change permissions. Confirmed completion records goal history and a growth event. These life goals are independent of Harness `ctx.goals`; chosen work uses the ordinary Agent inbox and tool pipeline without replacing or claiming completion of a Session Goal.

## Limits and extension

`maxMotivations`, `maxGoals`, `memoryLimit`, `memoryChars` and `contextChars` bound inventories, retrieval and current context; `queryLimit` bounds the remaining selected collections. Auxiliary input drops optional entries when necessary and refuses an oversized complete trigger. Global life record/character limits include agency records and histories. Capacity and validation failures leave committed state unchanged; uncertain storage writes poison dependent life operations until verified reload. Auxiliary failure before admission stops that request without silently accepting it.

The current integration supplies no background wake timer or new GUI editor. External event outcomes do not run the user-conversation memory or emotion writer automatically. Lexical retrieval and model assessments can miss relevant evidence; numerical interest readings describe evidence ratios rather than scientifically validated psychology. Live-model decision quality requires evaluation with deployment credentials; keyless Loader tests verify logging, enforcement, autonomous dispatch, interest evidence and restart continuity. Future scheduling can call the same cancellable entry, and application-specific result verifiers can confirm additional kinds of goal completion without delegating permission management to character state.

## Dev Note

None.
