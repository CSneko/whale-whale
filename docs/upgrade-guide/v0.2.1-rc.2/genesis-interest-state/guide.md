---
kind: upgrade-guide
description: "Enabling Genesis interests adds a persisted life field that older strict readers cannot load."
---

# Genesis interest state

English | [中文](guide.zh.md)

## Change

The optional `interest` configuration adds `interests` to the version-1 Genesis life projection and appends `interest.*` life events after startup and completed exchanges. Existing life ID, birth time, memories, emotion and Session logs are retained. Current readers accept older life records without this field; older strict readers reject newly written interest state. The workspace Life overlay enables `interest: {}` by default. The independent memory writer route is required.

## Migration

1. Stop the old Genesis process and retain a verified copy of both Genesis storage domains and the independent backup. Keep the same `DSH_HOME`, lease path and storage routes.
2. Rebuild the Host and Web artifacts, then start the updated `dsh` profile with `interest: {}` or the supplied Life overlay. Do not delete an unreadable life to restart initialization.
3. Open “Life information” and verify that interests start empty on a new life, or that prior interest records and the life ID persist after a restart. A completed exchange can then create an attributed interest stage; inspect its source IDs and change history.
4. To run older code again, restore the verified pre-interest storage and matching backup together. Removing the configuration alone does not remove persisted interest records. See [interest behavior](../../../genesis/interest.md) for evidence limits.
