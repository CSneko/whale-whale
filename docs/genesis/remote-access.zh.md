# Genesis 远程网页访问

[English](remote-access.md) | 中文

## 启动与登录

源码工作区的 Genesis Web 默认监听 `0.0.0.0:4004`，并启用网页密钥登录。使用 `pnpm dsh web` 启动后，访问 `http://<服务器 IP>:4004/`。启动时打印干净的网址，不附带启动 token。显式 `--host`、`--port`、TLS 参数和配置补丁仍然优先。

首次启动时，服务器生成私有的 `$DSH_HOME/web-login.key` 文件，默认 Genesis 主目录为 `~/.genesis-harness`。在服务器读取它，然后在网页的访问密钥字段中输入其内容：

```sh
cat "${DSH_HOME:-$HOME/.genesis-harness}/web-login.key"
```

密钥不会在启动时打印，也不放入 URL 或 Git。密钥文件必须是当前用户拥有的普通文件，不能是符号链接；POSIX 下不能授予组或其他用户权限。去掉两端空白后，内容为 16–1024 个 UTF-8 字节。可以将文件内容替换为另一个有效私有密钥；同时重启 DSH 可使旧登录失效。已有文件不可读、格式无效或权限不安全时，不会自动覆盖为新密钥。

同一浏览器在直连 IP 不变时保留签名 HttpOnly cookie。客户端 IP 改变后需要重新输入密钥，单有相同 IP 不会让其他浏览器自动获得认证。每次 DSH 进程使用独立签名密钥，因此重启后原有网页登录全部失效。同一进程中的 Connection 插件重载保留进程身份。普通 cookie 有效期仍作为时间上限。

## 网络与请求行为

浏览器通过有大小限制的 POST 表单向 `/auth/login` 发送密钥，同时提交绑定进程、authority 和 IP 的表单令牌。错误密钥、无效表单或超出频率限制都会被拒绝。配置中的尝试次数、时间窗口、地址跟踪容量和正文超时约束登录工作，过载返回 429。失败页面和日志不包含提交的密钥。登录页面先于应用启动提供，并支持中文和英文。

HTTP 不加密表单和后续流量。需要传输加密时，使用现有的 `--tls-cert`/`--tls-key` 参数；TLS cookie 带有 `Secure`。使用 HTTPS 反向代理时，应覆盖你希望保护的整个传输路径。认证不采信 `X-Forwarded-For`、`Forwarded` 或 `X-Forwarded-Host`。

Host/Origin 检查继续生效。通过通配监听器直接访问时，Host 可以使用实际本地 socket 的 IP；任意域名仍需显式 `--trusted-host <域名>`。RPC、上传和 WebSocket 准入都要求有效 cookie 与匹配的物理对端 IP。密钥模式下，query token 和基于 token 的 `/connect` 交换不能用于登录。静态资源仍然公开。

IP 绑定使用直接连接的 socket 对端。使用反向代理时，它是代理的 IP，因此此模式无法发现浏览器外部 IP 的变化。直接访问提供所要求的客户端 IP 行为，不会隐式信任转发的客户端地址。

## 配置与恢复

`config/genesis-web.patch.yml` 同时启用 `webserver.allowWildcardHost` 和 `connection.keyLogin.keyFile`。其他配置保留原来的认证与监听默认值。`pnpm dsh --no-genesis web` 使用普通 Harness Web 组合。

自定义 profile 可在 Connection 条目配置 `keyLogin`，并在 WebServer 条目显式允许通配监听。`keyFile` 必须是绝对路径。`attemptsPerWindow`、`windowMs`、`maxAddresses` 和 `timeoutMs` 控制准入，详见[配置目录](../config-catalog.zh.md)。未设置 `allowWildcardHost` 的通配地址仍会在 WebServer 激活时失败。

登录过程中密钥文件访问失败时，应用数据保持完整，登录返回安全的服务不可用页面。恢复原文件和权限后重试。重启清除进程登录状态和频率计数，不替换生命身份、文字记录或配置的访问密钥。
