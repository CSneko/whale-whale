---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-23-genesis-first-awakening-source

English | [中文](2026-10-23-genesis-first-awakening-source.zh.md)

## Summary

Adds a tagged Genesis first-awakening message source for the built-in first greeting.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-23-genesis-first-awakening-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-13-user-rpc-principal"
    after: "9650eeadce11b566dcb5c4f57fcb51e3aff6963e7e8a6455ffe9fa191545f9c9"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-13-user-rpc-principal"
    after: "7760f9fda2649da79570e50549e72ff7c94064d2e69f1d044406f0cd1c8763ef"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-13-user-rpc-principal"
    after: "9842a94a9b36253ec71faa13c75871ad92ad38287fb8bffecedc1e03971ceeeb"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-13-user-rpc-principal"
    after: "60b060efced44d7ca85fe5ebce142938e1d458b189892d19da14ef22c5a93aaf"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing messages remain unchanged. The new genesis-awakening discriminator carries the existing notice form and summary. Current readers preserve the source and display generic producer context; memory ingestion excludes it from user-stated evidence. Older merge-extensible source readers retain unknown kinds as opaque producer data, so no existing event discriminator or Session format changes. Auxiliary HTTP model records use the existing ignorable plugin-record envelope and never project into model conversation history.

<a id="verification"></a>
## Verification

vitest run packages/experimental/genesis/tests/integration.spec.ts: 11 tests passed, including one logged first greeting, excluded synthetic user evidence, shared five-mode memory, independent Jev/LLM endpoints, failure containment and restart continuity. A browser smoke exercised naming into the first Life conversation and persisted two sourced memories.

<a id="dev-note"></a>
## Dev Note

None.
