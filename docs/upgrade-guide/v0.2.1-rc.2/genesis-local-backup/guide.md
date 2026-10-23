---
kind: upgrade-guide
description: "Genesis now requires a writable local backup and refuses a new identity when that backup survives missing primary state."
---

# Genesis local backup and memory records

English | [中文](guide.zh.md)

## Change

Genesis writes a local backup after every primary state commit. The default path is `${leasePath}.backup.json`. A missing primary state with an existing backup now refuses startup instead of creating another life. A backup failure can follow a successful primary write and stops dependent operations.

The optional semantic memory pipeline adds optional memory kind, attribution and vector fields. Existing records remain readable without conversion; older strict implementations refuse records containing those fields.

## Migration

1. Ensure the Genesis process can write the backup directory, or set an absolute `backupPath` distinct from `leasePath` in its plugin configuration. Preserve the same primary storage and writer lease.
2. Restart and verify that the backup contains the same identity as primary `states/life`. Stop and inspect both copies if a commit or backup fails; do not delete the backup merely to make startup create a new life.
3. Before enabling the optional `memory` block, preserve a verified pre-upgrade storage copy for any downgrade. See [memory configuration and recovery](../../../genesis/memory.md) for embedding/model setup and restoring the standalone backup into a Storage Domain record.
