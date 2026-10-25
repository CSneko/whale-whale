# Genesis remote browser access

English | [中文](remote-access.zh.md)

## Start and sign in

The source-workspace Genesis Web defaults bind `0.0.0.0:4004` and enable key-form login. Start with `pnpm dsh web`, then visit `http://<server IP>:4004/`. The printed startup URL is clean and carries no launch token. Explicit `--host`, `--port`, TLS flags and profile patches retain precedence.

On first start, the server generates a private `$DSH_HOME/web-login.key` file; the default Genesis home is `~/.genesis-harness`. Read it on the server and enter its value into the webpage's access-key field:

```sh
cat "${DSH_HOME:-$HOME/.genesis-harness}/web-login.key"
```

The key is not printed at startup, placed in a URL or stored in Git. The key file must be an owned regular file, without a symbolic link and, on POSIX, without group/other permissions. It holds 16–1024 UTF-8 bytes after trimming surrounding whitespace. You may replace the file's contents with another valid private key; restart DSH to invalidate previous logins as well. An unreadable, malformed or insecure existing file is never overwritten with a replacement key.

The same browser keeps its signed HttpOnly cookie while its direct IP is unchanged. A changed client IP requires the key again; IP alone does not authenticate another browser. Each DSH process has its own signing key, so every restart invalidates existing browser logins. Connection plugin reloads within the same process retain the process identity. The ordinary cookie lifetime still applies as an upper limit.

## Network and request behavior

The browser sends the key in a bounded POST form to `/auth/login`, with a process-, authority- and IP-bound form token. Incorrect keys, invalid forms and rate exhaustion are refused. The configured attempt count, rate window, tracked-address capacity and body timeout bound login work; overload returns 429. No submitted key is included in failure pages or logs. The login page is available before application startup and supports Chinese and English.

HTTP does not encrypt the form or later traffic. Use the existing `--tls-cert`/`--tls-key` options when the connection needs transport encryption; TLS cookies carry `Secure`. An HTTPS reverse proxy must terminate encryption through the whole path you intend to protect. Authentication never trusts `X-Forwarded-For`, `Forwarded` or `X-Forwarded-Host`.

The Host/Origin check remains active. A direct request through a wildcard listener may use its actual local socket IP as Host; arbitrary domain names still require an explicit `--trusted-host <hostname>`. RPC, uploads and WebSocket admission all require the cookie and matching physical peer IP. Query tokens and the token-based `/connect` exchange cannot log in while key mode is enabled. Static assets remain public.

IP binding uses the immediate socket peer. Behind a reverse proxy, that is the proxy's IP, so a change in the browser's external IP cannot be detected by this mode. Direct access supplies the requested client-IP behavior; forwarded client addresses are not implicitly trusted.

## Configuration and recovery

`config/genesis-web.patch.yml` enables `webserver.allowWildcardHost` and `connection.keyLogin.keyFile` together. Other profiles preserve their existing authentication and listener defaults. `pnpm dsh --no-genesis web` selects the ordinary Harness Web composition.

For a custom profile, configure `keyLogin` on the Connection row and explicitly opt into wildcard binding on the WebServer row. `keyFile` must be absolute. `attemptsPerWindow`, `windowMs`, `maxAddresses` and `timeoutMs` control admission; see the [configuration catalog](../config-catalog.md). A wildcard address without `allowWildcardHost` still fails at WebServer activation.

If key-file access fails during login, the existing application data remains intact and login returns a safe service-unavailable page. Restore the original file and permissions and retry. A restart clears process login state and rate counters; it does not replace the life identity, records or configured access key.
