# Genesis 长时记忆

[English](memory.md) | 中文

## 启用

Genesis 的可选 `memory` 配置启用语义回忆和每轮结束后的独立记忆更新。先配置 Harness 的普通对话提供方。决策和写入角色使用已注册的 Harness LLM 适配器，分别发起调用、使用独立指令，只接收已完成的当前轮对话，不接收其他会话的对话历史。两种角色可以使用同一模型路由。决策使用通用 LLM 输出并验证 JSON，当前没有包含 Typesafe/jev 专用适配器。

在启动环境中将 `GENESIS_EMBEDDING_URL` 设置为完整的 OpenAI 兼容 `/embeddings` 地址，`GENESIS_EMBEDDING_MODEL` 设置为模型标识，`GENESIS_EMBEDDING_DIMENSIONS` 设置为向量长度，`GENESIS_EMBEDDING_API_KEY` 设置为凭据。不要把凭据放进补丁或 Git。先应用 Genesis 补丁，再应用提供的记忆补丁：

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/genesis/cordis.memory.patch.yml --dump-config
```

配置转储只检查组合，不调用模型。配置好端点后移除 `--dump-config` 并传入任务即可对话。示例为两种辅助角色选择 `deepseek-official/deepseek-v4-flash`；修改 `memory.decisionProvider`、`decisionModel`、`writerProvider` 和 `writerModel` 可选择其他已注册路由。免密本地嵌入服务器可在自定义补丁中省略 `embeddingKeyEnv`。完全省略 `memory` 配置块会保留原有关键词检索和手动记忆行为。

## 回忆与更新

当前会话的对话就是短时记忆。陈述性长时记忆保存经历、陈述和自我知识，不会自动加入提示词。AI 使用非空查询主动调用 `genesis_recall`。知识库对查询和记录进行嵌入，按余弦相似度排序，并在查询和结果预算内返回完整记录。非陈述性记忆保存少量持久习惯或人设指导，作为有归属、不可信的候选数据进入已记录的提示词。缺少历史分类的记录中，过程类记忆视为非陈述性，其余类别视为陈述性。

辅助请求的配置、提示词、完整输入和已完成响应会在记忆发布前记录为可忽略的 `plugin:genesis/memory-call` 会话记录。它们只保留在来源会话中，不进入对话上下文，也不驱动恢复；不了解 Genesis 的读取器会保留并跳过它们。

成功回复后，独立决策调用返回更新或不更新。不更新时不会调用写入模型或嵌入模型。需要更新时，另一个 LLM 调用接收当前轮对话、语义检索候选和少量非陈述性记忆。经过验证的创建、修改、删除计划必须引用真实对话序号。用户陈述记忆只能引用用户消息，来自助手的内容保留为模型推断。修改保留已有证据。整个计划与来源轮次的去重标记一同提交，回放不会重复已完成的处理。此模式下 `genesis_remember` 返回待审核状态，不宣称记忆已经保存。

`maxImplicitMemories` 和 `memoryChars` 限制小容量层，`maxChanges`、`inputChars`、`outputChars`、`maxTokens` 和 `timeoutMs` 限制辅助工作。超限输入或输出、无效引用、截断的模型输出和不兼容向量会明确拒绝更新。模型或嵌入失败不会删除对话文本，但会将该轮标记为失败；已经观察到的证据可能保留，不会写入审核完成标记。提交计划前会检查取消；已经接受的主写入仍会完成排空，重启不会自动重试中断的轮次。

## 持久化与本地备份

既有生命存储在不同会话之间共享身份、人设记忆和长时记忆，不合并上下文。记忆记录保留来源事件引用、分类、归属和可选嵌入缓存。端点、模型和维度共同标识嵌入空间。新建和更新的向量会持久保存；历史或不兼容缓存会在搜索时按需重建。搜索目前扫描有界的本地向量集合，不依赖外部向量数据库。

每次主快照提交还会通过临时文件、文件同步和原子替换，写入仅所有者可读写的本地 JSON 备份。`backupPath` 可覆盖默认的 `${leasePath}.backup.json`；若主存储位于远端，可使用独立的本地目录。文件包含完整生命状态、记忆文本、证据和向量缓存。这是当前状态备份，不是版本归档；删除记忆也会替换备份中的对应内容。请将主存储和此文件一起纳入恢复策略。

备份失败可能发生在主存储已经提交之后。Genesis 会停止依赖状态的操作并报告不确定结果，重启前应检查两份数据。主状态缺失但备份存在时，Genesis 拒绝创建替代生命。请停止写入、保留两份数据，并用 `stateSchema` 验证备份后，通过已配置的 Storage Domain 后端恢复其 `states/life` 记录。独立备份不是完整的 Storage Domain 文件，不能直接覆盖 `genesis.json`。未知或损坏的主状态不会被静默替换。

## 验证与限制

免密 Loader 集成验证独立模型角色、同义语义检索、重启连续性、会话隔离、本地备份，以及对无效证据和向量响应的拒绝。真实提供方调用需要部署凭据，这些测试未验证实时服务。完整快照存储保留既有容量限制，记忆推断不是已核实事实。持久工具学习与首次账号配置/命名流程见[首次唤醒](awakening.zh.md)。情绪和自主唤醒调度仍未实现。
