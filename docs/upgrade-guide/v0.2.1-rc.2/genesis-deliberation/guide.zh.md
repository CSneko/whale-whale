---
kind: upgrade-guide
description: "启用 Genesis 审议会新增旧版严格读取器拒绝的持久状态，并要求生命任务工具具有已记录的接受决策。"
---

# Genesis 审议状态

[English](guide.md) | 中文

## 变更

`deliberation` 在 Genesis 生命投影中新增可选版本 1 `agency` 状态，并追加带来源的动机、目标和决策事件。工作区 Life 覆盖配置同时启用审议与既有记忆、情绪和兴趣；普通 Life 请求获准前会调用独立写入模型，只有接受才允许任务工具。缺少审议状态的旧数据仍可读取，生命 ID 和诞生时间不变；旧版严格 Genesis 读取器会拒绝新增字段。Harness 会话格式版本不变。

## 迁移

1. 停止旧进程，保留两个生命存储域及独立备份的经验证副本，保持同一 `DSH_HOME`、存储路由和锁路径。
2. 重新构建 Genesis 并启动 Life 覆盖配置，或显式配置 `deliberation: {}` 及所需 `memory` 写入路由。支持的 `dsh` 组合见[审议说明](../../../genesis/motivation.zh.md)。
3. 检查身份连续性、初始空审议清单及 Life Events 中的 `agency.initialized`。完成一次交互，检查已记录的 `genesis-deliberation` 选择与实际结果。写入模型或配置失败会阻止输入获准，修正模型路由后再重试。
4. 删除 `deliberation` 配置会停止运行行为，但保留状态。降级时须一起恢复经验证的启用审议前存储和对应备份，绝不删除无法读取的生命来创建替代身份。
