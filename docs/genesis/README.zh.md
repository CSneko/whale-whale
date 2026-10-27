# Genesis Phase 1

[English](README.md) | 中文

## 概要

Genesis 在会话和模型之间保持同一生命身份，保存带来源的候选记忆，查询真实会话工具与系统成长。Genesis 是可选功能，不代表已建立主观意识。

## 目录

[首次唤醒](awakening.zh.md) · [记忆](memory.zh.md) · [情绪](emotion.zh.md) · [兴趣](interest.zh.md) · [动机与决策](motivation.zh.md) · [主动消息](social.zh.md) · [架构](architecture.zh.md) · [数据模型](data-model.zh.md) · [开发](development.zh.md) · [后续方向](roadmap.zh.md) · [文字记录](records.zh.md) · [远程访问](remote-access.zh.md)

## 从源码工作区运行

使用仓库 engines 范围内的 Node 并安装工作区依赖，以下命令在仓库根目录执行。完整构建需要 Git 元数据；缺少 `.git` 的源码归档无法提供构建提交号。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:artifacts
pnpm run build:check
```

`--ignore-scripts` 不运行依赖安装钩子；所需原生构建产物由仓库构建命令生成。真实模型对话需要配置 Harness 模型提供方。Genesis 自动化测试使用脚本化适配器，无需 API Key。

本工作区的 Web 启动默认加载生命核心、首次唤醒和浏览器配套配置，监听 `0.0.0.0:4004`，使用网页密钥登录。构建完成后运行：

```sh
pnpm dsh
```

`pnpm dsh web`、`pnpm start:web` 和 `make web` 使用相同默认配置，开发模式也沿用它。默认 `DSH_HOME` 为 `~/.genesis-harness`；显式设置的 `DSH_HOME` 和 `--port` 优先，额外 `--patch` 在默认配置之后应用。无需再设置 `PNPM_MANAGE_PACKAGE_MANAGER_VERSIONS`。先配置 API 或登录，再在知识库完成嵌入配置，详见[首次唤醒](awakening.zh.md)。

本机浏览器测试可运行 `pnpm dsh web --test-no-login`。打开启动时输出的已认证地址，启动令牌会换取浏览器 Cookie，无需填写密钥登录表单。此开关仅属于源码工作区，将测试补丁放在最后，即使指定 `--host` 也固定监听 `127.0.0.1`，并保留 `--port`。API 认证仍然开启，直接访问根地址仍须有效 Cookie。不加此参数即可恢复密钥登录。自动化测试使用独立的临时 `DSH_HOME`。

需要普通 Harness Web 时使用 `pnpm dsh --no-genesis web`。此开关只属于工作区启动层；已发布的 `dsh` CLI、其他配置和桌面应用保留原有默认行为。下面是显式启用部分 Genesis 功能的示例。

通过核心补丁显式启用基础能力。实验请指定独立的绝对路径 `DSH_HOME`，再次启动时保持同一路径以恢复同一生命。

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --dump-config
```

配置转储用于验证组装，不创建生命、不调用模型。配置模型后，将 `--dump-config` 替换为任务即可进行对话。

Web 状态展示需要同时应用下面两个补丁。设置中会增加独立的“生命信息”和“知识库”页面，分别展示身份、运行能力、成长，以及嵌入配置和记忆搜索。刷新会请求新的认证状态样本。

```sh
pnpm dsh --no-genesis web --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/client-ui-genesis/cordis.patch.yml --dump-config
```

构建后去掉 `--dump-config` 即可启动 Web，监听与认证由显式组合的配置决定，Genesis 不新增独立监听端口。界面显示上次刷新时间；刷新失败时保留旧样本并显示警告。

需要先配置凭据、命名、新生角色和持久工具学习时，请使用[首次唤醒教程](awakening.zh.md)。生命覆盖配置包含独立记忆流水线，最初只向模型开放学习工具。

## 查询与记忆

通过 `genesis_self` 查询身份和诞生时间，使用 `genesis_recall` 搜索记忆，使用 `genesis_history` 查询事实或成长。明确要求记忆并写出原文，例如“请记住：我喜欢乌龙茶”。`genesis_remember` 只接受最近观察到的真实用户消息中的原文，并保存为带来源的候选记忆。

在工作区 Web 启动时添加前置 `--no-genesis` 即可禁用默认 Genesis；其他配置下省略 Genesis 补丁即可禁用；单独禁用 Web 配套插件只移除设置区域。这些操作均不删除生命数据。

## 限制

可选[情绪](emotion.zh.md)保存即时状态与较慢的心境，工作区生命覆盖配置默认启用。可选[兴趣](interest.zh.md)从带来源的交流形成，不预设喜欢的主题。可选[审议](motivation.zh.md)提供持久动机、跨会话目标和实际执行意愿检查；自主任务调度、反思与自我完善尚不可用。工具发现记录可用性，不代表掌握能力或已获权限。可选[记忆流水线](memory.zh.md)提供嵌入搜索和独立更新；自动插件安装和自主修改源码仍不可用。

## 开发说明

无。
