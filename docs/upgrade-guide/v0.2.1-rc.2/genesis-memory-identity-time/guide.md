---
kind: upgrade-guide
description: "Genesis selected-memory organization replaces originals, manual edits omit history, and identity/time storage requires updated readers."
---

# Genesis memory identity, dates and personal files

English | [中文](guide.zh.md)

## Change

Selected-memory organization atomically replaces and deletes the selected originals instead of retaining duplicates. Models cite compact source handles; life-event IDs cannot identify selected memories. New generated memory prose uses precise internal calendar anchors; character-facing recall preserves important exact dates and renders ordinary experiences relatively. Manual edits, layer conversions and deletions directly update current state without adding edit events or historical versions; prior Session logs and existing history remain.

An optional operator profile and current habit-evidence exclusions extend persisted life data. Older strict readers reject snapshots containing these fields. Genesis now requires `sandboxPolicy` in custom compositions. The life overlay enables a persistent personal directory, announced in every conversation mode after learning read/write; explicit grants remain subject to file policy.

## Migration

1. Back up the existing life domain, backup file, credential store and model/embedding settings before upgrading. Preserve the same `DSH_HOME`, storage and lease; never reset identity to resolve a reader error. Restore a complete pre-upgrade backup before downgrading rather than deleting unknown fields.
2. Rebuild affected Host and browser packages and restart through the supported `dsh` profile. Custom Genesis compositions must provide `sandboxPolicy`; base-backed profiles already do. Leave `personalDirectory` unset to disable it, or use the life overlay's `$DSH_HOME/personal`. Back up its files separately. Recorded directories must remain private, owned and at the same canonical location; a missing directory requires restoration.
3. In Settings → Memories → Your identity, enter your name and identity. Save with the independent writer and embeddings configured to safely relabel existing generic roles. Batches commit together; increase `memory.identityRewriteLimit` if the complete legacy set exceeds it. Failed saves retain prior identity and memories.
4. Review selections before organizing: successful results replace originals, while life-event evidence remains. Verify the new count and retry a failed request with its retained selection; concurrent edits require refresh.
5. Set Genesis `timeZone` to the intended IANA zone if the host zone is unsuitable. Use `{{date:...}}` for important exact dates (annual birthdays can omit the year with `--MM-DD`); ordinary `{{time:...}}` anchors render relatively. Organization adds a logged semantic writer pass using original evidence. Only explicit markers are rendered; ordinary words, ages, version numbers and unmarked manual text remain unchanged. Failed semantic review retains the selection. See [memory](../../../genesis/memory.md) and [personal directory](../../../genesis/awakening.md#personal-directory).
