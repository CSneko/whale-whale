---
kind: upgrade-guide
description: "Genesis Web defaults to Jev memory decisions and a selectable Life preset with shared memories."
---

# Genesis Life mode and memory model configuration

English | [中文](guide.zh.md)

## Change

The Genesis life overlay selects TypeSafe Jev decisions instead of the chat LLM. The Web companion adds Life mode and makes it the deployment default, while retaining existing saved preset choices. Newborn behavior and tool learning apply only to Life mode; the original four presets share identity and memory while retaining task behavior. Initialization is an explicit button action. Do not show again durably suppresses automatic credential reminders. After naming, the action opens the first conversation and triggers a source-tagged built-in greeting.

## Migration

1. Rebuild affected Host and browser packages and restart with the same `DSH_HOME`, storage, backup and lease. Do not delete or recreate an existing life.
2. Open Settings → Knowledge Base. Configure the Jev endpoint, model and credential, or select an existing provider to retain general-LLM decisions. Configure the independent writer and embeddings there; GUI preferences take precedence over deployment values. See [memory configuration](../../../genesis/memory.md).
3. Preserve both `genesis_model_settings` and `genesis_embedding_settings` domains plus the credential store in backups; the life JSON backup does not include these preferences.
4. Confirm Life mode appears beside the other presets, and click Initialize life to name her or enter the pending first conversation. The button disappears after the first successful text reply, including after restart. Memory failures show a separate warning with the failed stage and safe reason and permit continued chat; retry is available while the failed turn's live evidence remains.

5. Settings → Memories manages records and manually integrates selected memories into one or several sourced interpretations; originals are replaced atomically. Knowledge Base configures models and embeddings. Life includes innate recall and time context. Completed replies support manual memory generation alongside automatic review.

6. Preserve a verified pre-upgrade life backup before the first write. Optional experience metadata, links and previous interpretations extend version-1 life records; old records remain readable, while older strict readers reject new fields. Accepted user inputs now trigger bounded embedding-based association. Set `memory.associationLimit: 0` to retain tool-only recall. Inspect experience time and previous interpretations in Memories; old transcripts are not backfilled.

7. Idle consolidation reuses the writer and embeddings; disable it in Settings → Memories. Preserve a pre-write backup for older strict readers of optional `habit` and `consolidation` fields. Identity and memories remain; pending work and failures survive restart. Existing transcripts are not backfilled as habit evidence. Auxiliary reasoning defaults to `auto`; set `memory.reasoningEffort: provider-default` to inherit provider reasoning.

8. Life overlays enable `emotion: {}`: one decision and optional writer per eligible exchange. The emotion subrecord now writes version 2 while retaining life identity; follow the [emotion and relationship upgrade](../genesis-affective-state-v2/guide.md).

9. Settings → Emotion persists appraisal/recovery choices and reason-bearing manual adjustments. Older strict readers reject optional `controls`; preserve the pre-write backup for downgrade. Saved choices override deployment defaults. Pausing stops automatic emotion inference; recovery and context continue. Reload after revision conflicts.
