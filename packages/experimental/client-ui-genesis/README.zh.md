---
description: "在 Web 常规设置中查看 Genesis 身份、记忆和成长的只读预览。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-client-ui-genesis

[English](README.md) | 中文

## 概述

在常规设置中查看真实 Genesis 身份、诞生时间、运行中会话能力与有界记忆和成长预览。按需刷新，请求失败时保留旧样本。此可选配套界面需要 Genesis 生命插件，不增加模型指导或网络监听。

## 目录

[使用](#use) · [实现](#implementation) · [延伸阅读](#further-exploration) · [模型体验](#model-experience) · [已知限制与后续工作](#known-limitations-and-deferred-work)

<a id="use"></a>
## 使用

将本包的 `cordis.patch.yml` 与 [Genesis 核心补丁](../genesis/README.zh.md)一起应用到 Web 或 Desktop 配置，启动前重新构建浏览器包。打开设置 → 常规 → Genesis，样本时间可区分成功刷新与保留旧样本。

<a id="implementation"></a>
## 实现

插件挂载所属包生成的 Remote，注册 `genesis` 资源提供方并贡献本地化常规设置区域。共享资源模型负责已读取数据，并在失败后保留旧值。用户刷新与重连会请求新样本，插件不运行轮询定时器；资源中止会取消 RPC 并释放刷新监听器。

<a id="further-exploration"></a>
## 延伸阅读

[运行 Genesis](../../../docs/genesis/README.zh.md) · [架构](../../../docs/genesis/architecture.zh.md) · [客户端资源](../../../docs/subsystems/client-resources.zh.md)

<a id="model-experience"></a>
## 模型体验

无，本包仅在 Web 设置中展示 Genesis 的只读状态。

#### KV 缓存影响

不直接产生模型 token 或缓存变化，刷新页面只读取主机状态，不增加对话事件。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 此视图只读并按需采样，不重命名身份、不确认记忆、不编辑权限，也不持续轮询。
- 返回预算可能省略预览，数量与省略提示会明确区分；历史非活动会话的工具不会作为实时能力展示。

### 开发备注

无。
