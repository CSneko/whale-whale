---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-26-genesis-deliberation-source

[English](2026-10-26-genesis-deliberation-source.md) | 中文

## 概述

增加带决策标识的 Genesis 审议通知来源，并记录可忽略的辅助审议审计数据。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

来源附着于既有用户消息、开发者消息、收件箱和标题请求封套。当前读取器保留既有来源种类，旧读取器按既定来源归属策略保留未知种类。可选 Genesis 适配器使用自身持久决策和实时准入控制意愿，通用会话重放不会根据通知授予执行权限。既有事件判别项和会话写入版本不变；生命审议状态使用自身版本化投影，旧版严格 Genesis 读取器明确拒绝新增状态。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/experimental/genesis/tests/agency.spec.ts packages/experimental/genesis/tests/interest.spec.ts packages/experimental/genesis/tests/integration.spec.ts packages/experimental/genesis/tests/participants.spec.ts：51 项测试通过，包括实际 Loader 组合、工具拒绝、自主事件执行、带来源兴趣评估和重启连续性。

<a id="dev-note"></a>
## 开发备注

无。
