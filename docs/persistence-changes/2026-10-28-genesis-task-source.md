---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-28-genesis-task-source

English | [中文](2026-10-28-genesis-task-source.zh.md)

## Summary

Adds the genesis-task message source to attribute explicitly assigned ordinary workspace work to its requesting Life session, request id and input fingerprint.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-28-genesis-task-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-27-genesis-initiative-source"
    after: "5a6861b46f58d1d85ef11d5cf19ad97bde49a81c8ba7cd94e3df90daa3b07689"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-27-genesis-initiative-source"
    after: "2a5f26d18361403687e3dbbd0901e10262afd7cce85e27e7518f9f0e6baddc3c"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-27-genesis-initiative-source"
    after: "d2b3d7abd00c88b9cee1ca63b3997cd83432437e41fa8129fa44b175c80b454e"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-27-genesis-initiative-source"
    after: "1693c4a9b78eaee4b1a7d6d7eac77ccbb49e9c9b864967169278d3204daf386b"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

The source kind is attribution-only. Existing inbox, user and developer messages remain valid. Readers that do not know the source retain the ordinary message content and generic context rendering; they must not treat it as a human-authored message or replay execution. No Session format bump or life-state migration is required. Current task readers derive completion from turn events and refuse conflicting request fingerprints.

<a id="verification"></a>
## Verification

Real Loader composition tests in packages/experimental/genesis/tests/integration.spec.ts passed for isolated workspace dispatch, concurrent retry deduplication, completed and failed results, interrupted cold reads, restart attribution and tool disposal. Models were scripted; no live-provider claim is made.

<a id="dev-note"></a>
## Dev Note

None.
