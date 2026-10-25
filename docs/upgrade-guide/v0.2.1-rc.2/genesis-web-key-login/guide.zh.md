---
kind: upgrade-guide
description: "Genesis 工作区 Web 启动改用网络监听与网页密钥登录，替换带 token 的回环网址。"
---

# Genesis Web 使用网页密钥登录

[English](guide.md) | 中文

## 变更

源码工作区的 Genesis Web 现在监听 `0.0.0.0:4004`，并打印干净的网址。网页登录需要服务器私有密钥，绑定直连客户端 IP，每次进程重启后失效。带启动 token 的网址和 `/connect` token 交换不能认证此模式。普通 Harness profile 和 Desktop 保留原有默认值。

## 迁移

1. 使用 `pnpm dsh web` 启动。在服务器读取 `${DSH_HOME:-$HOME/.genesis-harness}/web-login.key`，然后在 `http://<服务器 IP>:4004/` 输入该值。保持生成的文件私有，更换密钥时重启 DSH 以撤销旧登录。
2. 自定义补丁替换 Connection 配置时，保留 `keyLogin.keyFile` 与 `trustedHosts`；自定义 WebServer 补丁使用通配地址时，显式设置 `allowWildcardHost: true`。域名访问仍需 `--trusted-host`，TLS 使用既有证书与密钥参数。直连 IP 和反向代理行为见[远程访问](../../../genesis/remote-access.zh.md)。
3. 确认干净的浏览器显示密钥表单，正确密钥可以进入应用，重启 DSH 后需要重新登录。使用 `pnpm dsh --no-genesis web` 可启动普通的回环地址与 token 组合。
