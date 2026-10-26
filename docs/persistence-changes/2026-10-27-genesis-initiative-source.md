---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-27-genesis-initiative-source

English | [中文](2026-10-27-genesis-initiative-source.zh.md)

## Summary

Add a Session source tag for attributed Genesis initiative messages.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-27-genesis-initiative-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-26-genesis-deliberation-source"
    after: "54ba505cf139a19fac58ba2840b4048a464dd53762983d55f22e44f848d414fb"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-26-genesis-deliberation-source"
    after: "ed69643170b45d5c035515cefd348bcbb126b3f1d11b7b34b15fd5db68b692da"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-26-genesis-deliberation-source"
    after: "c664e1950aa0b0aa979636753929778cd227c1b64939c2413dd2a4f1b7b8cddb"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-26-genesis-deliberation-source"
    after: "2eb26a790c4b4f6bb5569264d3f6484419c410b4d6ea56c3d6e7da8df01f117a"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

The new literal identifies assistant input admitted from a persisted initiative receipt. Existing Session sources keep their meanings, and readers that treat source as attribution retain the logged message content and role unchanged. This adds no required fields and does not reinterpret prior events.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/experimental/genesis/tests/agency.spec.ts packages/experimental/genesis/tests/emotion.spec.ts packages/experimental/genesis/tests/integration.spec.ts packages/experimental/genesis/tests/status-error.spec.ts packages/experimental/genesis/tests/personality.spec.ts: 76 tests passed.

<a id="dev-note"></a>
## Dev Note

None.
