---
kind: upgrade-guide
description: "Genesis life storage and backups now require a manifest and separate record directories."
---

# Genesis life records use separate directories

English | [中文](guide.zh.md)

## Change

Genesis replaces the complete `genesis` domain snapshot with a `genesis-split-v1` commit manifest. The `genesis_records` domain stores immutable identity, events, memories, vectors, memory versions, growth, capability observations and projections separately. With the JSON backend, each category has its own directory under `genesis_records/`; SQLite uses separate records in the same configured database. The backup file selected by `backupPath` becomes a manifest with independent components under `${backupPath}.d/`.

## Migration

1. Stop Genesis writers and preserve the complete existing primary storage and backup. Retain this copy if downgrade is required: old strict readers refuse split manifests.
2. Include both `genesis` and `genesis_records` domains in backend routing and backup policies. Unconfigured domain routes use the Storage Domain default backend. Include the backup manifest and its complete sibling `.d` directory; copying either alone is insufficient.
3. Start the same configured `dsh` profile and Genesis overlays. Startup validates and converts the legacy snapshot without changing its life ID, birth time or source references. No launch command or Genesis configuration key changes.
4. Confirm the same identity and memories after restart. Missing or damaged referenced records stop startup without creating another life. For restoration, preserve failed storage and follow [backup recovery](../../../genesis/memory.md#life-backup).
