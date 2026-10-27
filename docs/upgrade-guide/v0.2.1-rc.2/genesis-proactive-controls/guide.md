---
kind: upgrade-guide
description: "Genesis proactive settings and event cursors add persisted fields that older strict readers reject."
---

# Genesis proactive controls

English | [中文](guide.zh.md)

## Change

The source-workspace Life overlay loads Social Initiative paused and exposes Settings → Proactive messages. Existing explicit `socialInitiative: {}` deployments remain enabled by default. Persisted operator settings override deployment defaults. Outboxes without settings or cursors remain readable; new fields are added without replacing prior opportunities or receipts. Older strict readers reject these fields.

The assistant-receipt projection uses state version 2, rebuilt from existing Session events. No Session format change or manual log edit is required. Unknown post-crash reservations become uncertain and are not automatically resent.

## Migration

1. Stop processes using the life and retain verified copies of both storage domains, backup manifest and its `.d` directory.
2. Rebuild current Host, Client and generated Remote definitions together. Open Settings → Proactive messages. Enable the switch and save the desired interval and limits; an idle character conversation and configured model are required for delivery.
3. Verify that the saved policy survives restart and that sent messages carry actual assistant receipts. Review pending or uncertain records in the original conversation before further action; enqueueing alone is not success.
4. For rollback, stop the new process and restore complete verified pre-upgrade primary and backup copies. Do not strip fields or rewrite immutable Session history. See [proactive messages](../../../genesis/social.md) for detailed timing and recovery behavior.
