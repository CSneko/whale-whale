---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-28-genesis-task-source

[English](2026-10-28-genesis-task-source.md) | 中文

## 概述

添加 genesis-task 消息来源，将明确分配的普通工作区任务归属到发起 Life 会话、请求标识和输入指纹。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

该来源种类仅表示归属；既有收件箱、用户和开发者消息仍有效。未知该来源的读取方保留普通消息内容和通用上下文展示，不应将其当成人类输入或重放执行。无需提高 Session 格式版本或迁移生命状态。当前任务读取方从轮次事件推导完成状态，并拒绝冲突的请求指纹。

<a id="verification"></a>
## 验证

packages/experimental/genesis/tests/integration.spec.ts 的真实 Loader 组合测试已通过，覆盖隔离工作区分配、并发重试去重、完成与失败结果、中断任务只读查询、重启后的来源恢复和工具卸载。模型为脚本实现，不宣称真实提供方验证。

<a id="dev-note"></a>
## 开发备注

无。
