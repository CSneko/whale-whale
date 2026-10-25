---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-26-genesis-deliberation-source

English | [中文](2026-10-26-genesis-deliberation-source.zh.md)

## Summary

Adds the Genesis deliberation notice source with a decision identifier, alongside ignorable auxiliary deliberation audit records.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-26-genesis-deliberation-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-23-genesis-first-awakening-source"
    after: "99138ee8a3b8260c2d7a54fe0b749a570379500ec29666f626dc2171cc2c3664"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-23-genesis-first-awakening-source"
    after: "a7871972295ef05e53498a195a2f2d14f7a846f36031e7ae6e3a19c40fac04a3"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-23-genesis-first-awakening-source"
    after: "d436b1734e63bedb580f4b312b72b53906d23df71e915e30db50388d5d96bf3d"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-23-genesis-first-awakening-source"
    after: "b88301672f8168751874c35b2466dd40f435fe695a86afa950d3b0a1fbe78e64"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

The source is attribution on existing user-message, developer-message, inbox and title-request envelopes. Current readers retain existing source kinds; older readers preserve unknown source kinds under the established source-attribution policy. The optional Genesis adapter uses its own persisted decision and live admission to enforce willingness, while generic Session replay never grants execution authority from the notice. No existing event discriminator or Session writer version changes. Agency life state has its own versioned projection and older strict Genesis readers reject it explicitly.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/experimental/genesis/tests/agency.spec.ts packages/experimental/genesis/tests/interest.spec.ts packages/experimental/genesis/tests/integration.spec.ts packages/experimental/genesis/tests/participants.spec.ts: 51 tests passed, including actual Loader composition, tool denial, autonomous event execution, sourced interest review and restart continuity.

<a id="dev-note"></a>
## Dev Note

None.
