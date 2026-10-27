---
kind: upgrade-guide
description: "Genesis emotion settings add stopped-time accounting and coupled affect recovery fields that older strict readers cannot load."
---

# Genesis emotion evolution

English | [中文](guide.zh.md)

## Change

Immediate feelings approach mood-dependent levels instead of zero. Sustained feelings slowly influence mood within bounded gains. Emotion settings add required `offlineChanges`, `moodEmotionScale` and `emotionMoodInfluence`; update custom settings clients together with the generated Remote definitions.

Existing version-3 anchors without these fields remain readable. Startup settles legacy independent recovery before recording the added settings; identity and history are preserved. Older strict readers reject the newly written fields. Version-1 and version-2 conversion requirements remain unchanged.

## Migration

1. Stop all processes using the life. Preserve both storage domains and the verified backup manifest plus its `.d` directory before upgrading; keep this copy for rollback.
2. Rebuild the current host, client and generated Remote definitions together. Open Settings → Emotion → Emotion settings. The stopped-time switch defaults to enabled, preserving elapsed wall-clock accounting. Disable it to count running time only; saving first settles the old policy.
3. Review the coupling gains: `moodEmotionScale` defaults to 0.2 and `emotionMoodInfluence` to 0.25. Set both to zero only if independent recovery toward zero and the mood baseline is wanted. These are simulation settings, not psychological measurements.
4. Restart and verify that the life identity, saved switch and gains remain unchanged. With stopped-time accounting disabled, the process saves online anchors every `emotion.clockCheckpointMs` (60000 by default) and on normal shutdown. A crash resumes the last successful checkpoint and excludes any uncommitted running interval; storage stalls can lengthen that interval.
5. To roll back, stop the new process and restore the complete verified pre-upgrade primary and backup copies. Do not delete individual fields from live stores or alter immutable history. See [emotion behavior](../../../genesis/emotion.md).
