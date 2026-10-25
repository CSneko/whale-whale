---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-23-genesis-first-awakening-source

[English](2026-10-23-genesis-first-awakening-source.md) | 中文

## 概述

为内置首次问候添加带标识的 Genesis 首次唤醒消息来源。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

已有消息保持不变。新增 genesis-awakening 判别值携带既有 notice 形式和摘要。当前读取器保留来源，并显示通用生产者上下文；记忆采集不把它视为用户陈述。旧的可合并扩展来源读取器将未知类型保留为不透明生产者数据，因此不改变既有事件判别值或会话格式。辅助 HTTP 模型记录使用既有可忽略插件记录封装，不投影到模型对话历史。

<a id="verification"></a>
## 验证

vitest run packages/experimental/genesis/tests/integration.spec.ts：11 个测试通过，覆盖单次已记录首次问候、排除合成用户证据、五模式共享记忆、独立 Jev/LLM 端点、失败隔离和重启连续性。浏览器冒烟验证命名后进入首次生命对话，并持久保存两条带来源记忆。

<a id="dev-note"></a>
## 开发备注

无。
