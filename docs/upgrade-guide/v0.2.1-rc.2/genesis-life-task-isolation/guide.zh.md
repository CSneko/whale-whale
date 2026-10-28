---
kind: upgrade-guide
description: "普通预设不再参与已配置的 Genesis Life 生命周期。"
---

# 将 Life 与普通工作区任务隔离

[English](guide.md) | 中文

## 变更

设置 `awakening.lifePreset` 后，只有该预设接收 Genesis 工具和上下文，或参与生命记忆、情绪、兴趣和能力历史。标准、PTC、极简和创造模式不再共享这些功能。逐回复记忆操作在 Life 以外隐藏，Host 拒绝普通会话的记忆生成。Life 仍是工作区 Web 默认模式。基础组合及未限制预设的 awakening 保留所有会话参与的行为。

## 迁移

1. 保留 Life 覆盖配置的 `awakening.lifePreset: life` 和已有生命存储，在 Life 模式中继续角色对话；新建 Life 会话共享原有身份与记忆。
2. 为隔离工作新建普通会话。已有日志中的生命提示词、记忆和观察均保留，不清理或重写已有普通会话历史。
3. 通过 `learn` 教授 Life `genesis_tasks`，以分配普通工作。明确指定已注册工作区与非 Life 模式，重试时复用一个请求标识。通过 `inspect` 检查真实状态和结果，或打开目标工作区会话。依赖、权限和工作中断行为参见[工作区任务](../../../genesis/tasks.zh.md)。
