---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-27-genesis-initiative-source

[English](2026-10-27-genesis-initiative-source.md) | 中文

## 概述

为带归属的 Genesis 主动消息增加 Session 来源标记。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

新字面值用于标识从持久化主动交互回执准入的助手输入。现有 Session 来源含义保持不变；将来源视为归属信息的读取方仍按原样读取已记录的消息正文与角色。此变更不增加必需字段，也不重新解释既有事件。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/experimental/genesis/tests/agency.spec.ts packages/experimental/genesis/tests/emotion.spec.ts packages/experimental/genesis/tests/integration.spec.ts packages/experimental/genesis/tests/status-error.spec.ts packages/experimental/genesis/tests/personality.spec.ts：76 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
