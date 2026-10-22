# Genesis development

[English](development.md) | 中文

## 概要

通过带来源的原子状态变更扩展生命核心，通过适配层接入新的运行事实。具体模型执行与授权保持在生命核心之外。

## 验证

```sh
node node_modules/typescript/bin/tsc -b packages/experimental/genesis --pretty false
node node_modules/typescript/bin/tsc -b packages/experimental/client-ui-genesis --pretty false
node node_modules/vitest/vitest.mjs run packages/experimental/genesis/tests packages/experimental/client-ui-genesis/tests
```

测试分配独立临时目录，覆盖 JSON 和 SQLite，并通过真实 Cordis 配置加载生产 Agent Loop 与工具注册表。仅模型输出使用脚本替身，无需真实生命历史或凭据。

## 安全扩展

新增生命事实需要真实生产方、稳定来源键、JSON 校验、来源归属与重复投递测试。记忆检索可以独立于持久化替换。ID 和诞生时间只由初始化写入，应用重命名只能修改显示名称与更新时间。

通过真实作用域注册检测能力。声明摘要变化只表示可调用声明发生变化，不代表包版本变化或技能习得。该适配器无法知道已安装但禁用的插件。使用结果只从已结算工具结果记录。

## 存储诊断

提供的补丁使用 `$DSH_HOME/storages/genesis.json` 与 `$DSH_HOME/genesis.writer.lock`。检查或修复前停止写入方并备份完整文件。崩溃后必须确认没有进程访问数据，才能移除遗留锁；绝不通过删除生命数据来消除启动错误。

JSON 损坏、域版本被拒绝、身份无效或来源缺失均会使恢复失败。保留损坏数据，恢复经过验证的备份或编写显式迁移，不能静默创建第二个身份。

## 开发说明

无。
