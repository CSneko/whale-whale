---
kind: upgrade-guide
description: "Genesis 生命存储和备份改为清单及独立记录目录，恢复副本需要同时包含两者。"
---

# Genesis 生命记录使用独立目录

[English](guide.md) | 中文

## 变更

Genesis 将 `genesis` 域中的完整快照替换为 `genesis-split-v1` 提交清单。`genesis_records` 域分别保存不可变身份、事件、记忆、向量、记忆版本、成长、能力观察与状态投影。使用 JSON 后端时，各类记录位于 `genesis_records/` 下的独立目录；SQLite 在同一配置数据库中使用独立记录。`backupPath` 指定的备份文件改为清单，独立组件位于 `${backupPath}.d/` 下。

## 迁移

1. 停止 Genesis 写入方，完整保存现有主存储和备份。需要降级时必须保留此副本：旧版严格读取器拒绝拆分清单。
2. 后端路由和备份策略需同时包含 `genesis` 与 `genesis_records` 域。未配置的域路由使用 Storage Domain 默认后端。备份需包含清单及其完整的同级 `.d` 目录；仅复制其中之一不足以恢复。
3. 使用原来配置的 `dsh` profile 与 Genesis overlay 启动。启动会校验并转换旧快照，保留生命 ID、诞生时间与来源引用。启动命令和 Genesis 配置键均不变。
4. 重启后确认身份和记忆一致。引用记录缺失或损坏时停止启动，不会创建另一生命。恢复时保留故障存储，并遵循[备份恢复说明](../../../genesis/memory.zh.md#life-backup)。
