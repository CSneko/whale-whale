# Genesis emotion

English | [中文](emotion.zh.md)

## Summary

Genesis preserves nine immediate emotions, two slow mood dimensions and independent psychological needs across conversations and restarts. Event appraisals use attributed memories, the current goal when available and recent dialogue. These are engineered character states, not evidence of subjective consciousness.

## Enable

The workspace life overlay enables `emotion: {}`. Emotion uses the independent decision and writer routes configured for memory, without requiring embeddings for appraisal. Other compositions enable it explicitly; disabling the plugin retains stored state. See [memory](memory.md) for model configuration.

The supported headless composition can be inspected without starting a life or calling a model:

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/genesis/cordis.emotion.patch.yml --dump-config
```

## Mood and immediate emotion

`mood.valence` ranges from -1 to 1 and `mood.arousal` from 0 to 1. They recover toward the two-field `baseline` using independent `moodHalfLifeMs` values, both twelve hours by default. Important events or repeated independent appraisals can adjust mood; one ordinary exchange cannot.

`current` contains `happiness`, `sadness`, `anger`, `fear`, `tenderness`, `gratitude`, `longing`, `frustration` and `disappointment`. Each ranges independently from 0 to 1; opposite feelings can coexist. Excitement and calmness follow mood and specific feelings rather than separate intensity fields. Curiosity belongs to exploration motivation.

Immediate feelings decay toward zero using `shortHalfLifeMs`. Default half-lives are five minutes for happiness, anger and frustration; three for fear; fifteen for sadness, tenderness and disappointment; twenty for gratitude; thirty for longing. These adjustable simulation parameters are not psychological measurements. Mood recovery must be at least as slow as every immediate half-life.

Recovery uses elapsed time multiplied by `sensitivity` (0–2, default 1). Zero freezes automatic numerical changes, including relationships and needs, while appraisal calls and explicit operator adjustments remain available. Backwards clocks preserve the anchor. Recovery creates no offline experiences or background wakeups.

## Psychological needs

`needs` stores social desire and satisfaction, relationship quality, recent interaction, solitude preference, exploration, autonomy, creativity and loneliness as independent 0–1 estimates. `initialNeeds` supplies deployment priors; they are not established personality facts. Sourced `needsDelta` proposals update inclinations and fulfillment within `maxNeedsDelta` (default 0.08).

Loneliness is never a writer delta. Its target is `socialDesire × (1 − solitudePreference) × (0.5 × (1 − socialSatisfaction) + 0.3 × (1 − relationshipQuality) + 0.2 × (1 − recentInteraction))`. Loneliness approaches that target with `needsHalfLifeMs`; contact evidence decays with `interactionHalfLifeMs`, both six hours by default. Exact integration makes repeated sampling equivalent to one complete interval. Other need estimates do not decay merely because the process was stopped.

Longing may name a person or object through an optional `targets` entry on an appraisal. It is independent of loneliness: a character may miss someone while feeling socially fulfilled. Social estimates remain uncertain, attributed interpretations; silence and shutdown do not establish rejection.

## Event appraisal and behavior

After a reply, a life-wide FIFO evaluates the new exchange once. The bounded Session projection contains real user input and uninterrupted assistant text. Earlier completed exchanges provide context. `appraisalMemoryLimit` (default 4) and `appraisalMemoryChars` (default 1600 per group) bound lexical related-memory retrieval and self-memory selection. The optional Harness goal service supplies the current goal; no goal is invented when absent. Auxiliary requests and responses are logged before their results affect state.

A positive decision invokes the writer with state, memories, goal, dialogue and limits. The writer returns signed `delta`, `moodDelta`, `needsDelta`, optional `relationshipDelta` and `targets`, structured `appraisal`, attributed `reason` and exact `sourceSeqs`. At least one citation must be new real user evidence. Neutral exchanges, bare numeric instructions and the assistant’s emotional claims alone do not justify changes. Experience can change how the model interprets a recurring event; no fixed failure-to-frustration rule is used.

The runtime validates sources, schema, per-field limits and captured revision before atomic publication. Immediate changes default to at most 0.25, mood to 0.04 and relationships to 0.01. Mood requires importance at least 0.8 or three distinct recent user fingerprints with the same event kind and relationship meaning. Repeated meanings receive a 0.5 multiplier per match by default; exact repeated evidence applies no new deltas. Replay markers prevent a source exchange from committing twice.

The next admitted request receives direct percentage statements through logged `genesis:self` context, without storage IDs, timestamps or raw appraisal records. The highest-intensity feeling, signed mood valence or loneliness estimate and leading advisory action inclination appear first. Remaining feelings and inclinations follow by descending intensity; relationship estimates retain confidence and attribution. Display values remain quantized by `contextStep`; storage and independent appraisal inputs keep their original numeric scales. Exploration, creation, contact and independent-choice priorities guide choices among already permitted actions; fear informs caution. This supports willingness, negotiation and goal prioritization during an ordinary model turn. It does not schedule a turn, create autonomous goals or authorize execution. Operator instructions, stop controls, budgets and permission checks remain binding.

## Operator relationship and management

One optional operator relationship retains its own branded ID and five independent estimates: affection, trust, attachment, familiarity and felt security, with per-field confidence and origin. Names merely mentioned in dialogue never create relationships. Relationship estimates do not decay across time or Sessions; ordinary separation cannot reduce them, and appraisal cannot reduce familiarity. Attachment permits independent exploration and disagreement.

<a id="operator-management"></a>

Settings → Emotion shows all three layers, the latest appraisal and bounded attributed history. Valence meters and editors support negative values. Manual adjustments require a reason and include all three layers. Settings edit limits, sensitivity, mood baseline and recovery durations. Saved operator policy overrides deployment defaults; changing parameters first recovers under the old rules. Stale writes preserve drafts and require an explicit reload. Settings → Relationship edits estimates separately.

## Persistence and failure

The current emotion anchor is version 3. Only this generation is accepted; no automatic emotion migration or fallback is provided. Historical event payloads remain immutable and are not converted into current readouts; omitted-history counts include these older entries. An offline operator conversion must preserve identity, record the before/after representations and retain a verified rollback copy. See the [upgrade guide](../upgrade-guide/v0.2.1-rc.2/genesis-affective-state-v2/guide.md).

Model or validation failures preserve the trusted state and completed chat. Storage or backup uncertainty stops dependent life operations until verified reload. Unload cancels inference and drains admitted writes before storage closes. Strict parsing refuses damaged or incompatible state instead of creating a new life. Full-state record and character budgets still apply.

The model can still misinterpret an event, lexical retrieval can miss related memories, and needs are engineering estimates. There is no autonomous contact, wake scheduling, learned personality training or psychological diagnosis. Scripted Loader tests exercise appraisal, logged context and restart; they do not establish live-provider response quality.

## Dev Note

None.
