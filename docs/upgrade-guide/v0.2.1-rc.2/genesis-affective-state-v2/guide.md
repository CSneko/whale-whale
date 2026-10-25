---
kind: upgrade-guide
description: "Genesis emotion version 3 requires offline conversion and three-layer appraisal and editor payloads."
---

# Genesis affect state

English | [中文](guide.zh.md)

## Change

Genesis writes version-3 emotion anchors with nine immediate feelings, two mood dimensions and independent psychological needs. Version-1 and version-2 anchors are refused; no automatic emotion migration is provided. Historical event payloads remain unchanged. Life identity and the operator relationship remain separate from affect state.

Writers must return `needsDelta` and two-field `moodDelta`; `targets` can attribute individual feelings to an object. Remove `excitement`, `calmness` and `curiosity` from immediate deltas. Settings use a mood-only baseline, nine `shortHalfLifeMs` fields, two `moodHalfLifeMs` fields, `needsHalfLifeMs`, `interactionHalfLifeMs` and `maxNeedsDelta`; remove `reactionHalfLifeMs`. Absolute adjustments require `needs`. Rebuild all current callers and Remote definitions together.

## Migration

1. Stop every process using this life and preserve both storage domains, the independent backup manifest and its `.d` record directory. Verify the primary and backup identify the same life.

2. Have the operator convert the current anchor offline. Preserve the life ID, birth, relationship ID, retained nine feelings and historical events. Document the chosen mapping from six mood fields to valence/arousal and mark new needs as initial estimates; do not invent past fulfillment. Record `emotion.upgraded` with before/after values, mapping and rollback location. Recompute changed record hashes and update both manifests.

3. Load the supported `dsh` profile and inspect Settings → Emotion. Confirm nine immediate feelings, signed valence, arousal, needs and unchanged identity. Send one meaningful exchange and restart to confirm sourced history and continuity. See [emotion](../../../genesis/emotion.md) for behavior and limitations.

4. Roll back only while stopped, using the complete verified pre-conversion data and matching old code. Never combine an old manifest with changed records or downgrade an anchor in place.
