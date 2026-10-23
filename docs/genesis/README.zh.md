# Genesis Phase 1

[English](README.md) | 中文

## 概要

Genesis 在会话和模型之间保持同一生命身份，保存带来源的候选记忆，查询真实会话工具与系统成长。Genesis 是可选功能，不代表已建立主观意识。

## 目录

[首次唤醒](awakening.zh.md) · [记忆](memory.zh.md) · [架构](architecture.zh.md) · [数据模型](data-model.zh.md) · [开发](development.zh.md) · [后续方向](roadmap.zh.md)

## 从源码工作区运行

使用仓库 engines 范围内的 Node 并安装工作区依赖，以下命令在仓库根目录执行。完整构建需要 Git 元数据；缺少 `.git` 的源码归档无法提供构建提交号。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:artifacts
pnpm run build:check
```

`--ignore-scripts` 不运行依赖安装钩子；所需原生构建产物由仓库构建命令生成。真实模型对话需要配置 Harness 模型提供方。Genesis 自动化测试使用脚本化适配器，无需 API Key。

通过核心补丁显式启用。实验请指定独立的绝对路径 `DSH_HOME`，再次启动时保持同一路径以恢复同一生命。

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --dump-config
```

配置转储用于验证组装，不创建生命、不调用模型。配置模型后，将 `--dump-config` 替换为任务即可进行对话。

Web 设置需要同时应用两个补丁。常规设置页会增加 Genesis 区域，展示身份、诞生时间、记录数量、运行中会话能力、记忆与成长预览。刷新会请求新的认证状态样本。

```sh
pnpm dsh web --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/client-ui-genesis/cordis.patch.yml --dump-config
```

构建后去掉 `--dump-config` 即可启动 Web，监听地址遵循原有 Harness 策略，Genesis 不新增监听端口。界面显示上次刷新时间；刷新失败时保留旧样本并显示警告。

需要先配置凭据、命名、新生角色和持久工具学习时，请使用[首次唤醒教程](awakening.zh.md)。生命覆盖配置包含独立记忆流水线，最初只向模型开放学习工具。

## 查询与记忆

通过 `genesis_self` 查询身份和诞生时间，使用 `genesis_recall` 搜索记忆，使用 `genesis_history` 查询事实或成长。明确要求记忆并写出原文，例如“请记住：我喜欢乌龙茶”。`genesis_remember` 只接受最近观察到的真实用户消息中的原文，并保存为带来源的候选记忆。

下次启动时省略 Genesis 补丁即可禁用；单独禁用 Web 配套插件只移除设置区域。这些操作均不删除生命数据。

## 限制

情绪、动机、自主目标、自主唤醒调度、反思与自我完善尚未实现。工具发现记录可用性，不代表掌握能力或已获权限。可选[记忆流水线](memory.zh.md)提供嵌入搜索和独立更新；自动插件安装和自主修改源码仍不可用。

## 开发说明

无。
