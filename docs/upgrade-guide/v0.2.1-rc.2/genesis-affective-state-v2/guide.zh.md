---
kind: upgrade-guide
description: "Genesis 情感版本 3 要求离线转换及三层评价和编辑载荷。"
---

# Genesis 情感状态

[English](guide.md) | 中文

## 变更

Genesis 写入版本 3 情感锚点，包含九项即时情绪、二维心境和独立心理需求。版本 1 和 2 锚点会被拒绝；不提供情感自动迁移。历史事件载荷保持原样。生命身份与操作者关系独立于情感状态。

写入模型须返回 `needsDelta` 与二维 `moodDelta`；`targets` 可记录情绪关联对象。即时变化量移除 `excitement`、`calmness` 和 `curiosity`。设置使用二维心境基准、九项 `shortHalfLifeMs`、两项 `moodHalfLifeMs`、`needsHalfLifeMs`、`interactionHalfLifeMs` 和 `maxNeedsDelta`，移除 `reactionHalfLifeMs`。绝对调整必须包含 `needs`。当前调用方与 Remote 定义须一同重新构建。

## 迁移

1. 停止使用该生命的所有进程，保留两个存储域、独立备份清单及其 `.d` 记录目录。确认主存储和备份指向同一生命。

2. 由操作者离线转换当前锚点。保留生命 ID、出生时间、关系 ID、保留的九项情绪及历史事件。记录六项心境到愉悦度/唤醒度的映射，将新需求标为初始估计，不编造过去的满足情况。通过 `emotion.upgraded` 保存前后状态、映射和回滚位置。重新计算变化记录的哈希并更新两份清单。

3. 加载受支持的 `dsh` 配置并检查“设置 → 情绪”。确认九项即时情绪、有正负值的愉悦度、唤醒度、需求与未变的身份。进行一次有意义的交流并重启，确认带来源的历史及连续性。行为与限制见[情感系统](../../../genesis/emotion.zh.md)。

4. 仅在停止后使用完整可信的转换前数据与对应旧程序回滚。不得把旧清单与变化后的记录混用，也不得就地降低锚点版本。
