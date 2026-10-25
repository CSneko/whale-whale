---
kind: upgrade-guide
description: "Genesis workspace Web launches use network binding and browser key login instead of a tokenized loopback URL."
---

# Genesis Web uses browser key login

English | [中文](guide.zh.md)

## Change

Source-workspace Genesis Web now listens on `0.0.0.0:4004` and prints a clean URL. Browser login requires the private server key, is bound to the direct client IP and expires at each process restart. Launch-token URLs and `/connect` token exchange cannot authenticate this mode. Ordinary Harness profiles and Desktop retain their existing defaults.

## Migration

1. Start with `pnpm dsh web`. On the server, read `${DSH_HOME:-$HOME/.genesis-harness}/web-login.key`, then enter that value at `http://<server IP>:4004/`. Keep the generated file private; restart DSH when changing keys to revoke previous logins.
2. For a custom patch replacing the Connection config, preserve `keyLogin.keyFile` and `trustedHosts`; for a custom WebServer patch using a wildcard host, explicitly set `allowWildcardHost: true`. Domain access still needs `--trusted-host`, and TLS uses the existing certificate/key flags. See [remote access](../../../genesis/remote-access.md) for direct-IP and reverse-proxy behavior.
3. Confirm that a clean browser shows the key form, a correct key opens the application, and restarting DSH requires login again. Use `pnpm dsh --no-genesis web` for the ordinary loopback/token composition.
