---
description: "Genesis first-run naming and identity, memory and growth previews in Web General settings."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-client-ui-genesis

English | [中文](README.zh.md)

## Summary

Inspect the actual Genesis identity, creation time, live Session capabilities and bounded memory/growth previews from General settings. Refresh on demand and keep the previous sample visible if a request fails. With the life overlay, name the character after API/account configuration, then introduce yourself in her first conversation. This optional companion requires the Genesis life plugin and adds no model instructions or network listener.

## Table of Contents

[Use](#use) · [Implementation](#implementation) · [Further Exploration](#further-exploration) · [Model Experience](#model-experience) · [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use"></a>
## Use

Apply this package’s `cordis.patch.yml` beside the [Genesis core overlay](../genesis/README.md) to a Web or Desktop profile. Rebuild browser bundles before launching. The [first-awakening tutorial](../../../docs/genesis/awakening.md) enables the ordered naming dialog. Open Settings → General → Genesis; the sample timestamp distinguishes a successful refresh from a retained older sample.

<a id="implementation"></a>
## Implementation

The plugin mounts the owning package’s generated Remote contribution, registers a `genesis` resource provider and contributes a localized General settings section. The shared resource model owns fetched values and retains them after failure. Credential/settings/provider changes, user refresh and reconnection request new samples; the plugin runs no polling timer. Aborting the resource cancels RPC and releases refresh listeners.

<a id="further-exploration"></a>
## Further Exploration

[Run Genesis](../../../docs/genesis/README.md) · [Architecture](../../../docs/genesis/architecture.md) · [Client resources](../../../docs/subsystems/client-resources.md)

<a id="model-experience"></a>
## Model Experience

None, as this package presents Genesis status and performs naming through the Host; the owning life plugin supplies model instructions.

#### KV Cache effect

No direct model tokens or cache changes; refreshing the page reads Host state without adding conversation events.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The view is sampled. One-time naming is available only in awakening mode; it does not replace identity, promote memories, edit permissions or continuously poll.
- Response budgets may omit previews; counts and omission notices expose that distinction. Historical inactive Session tools are not listed as live capabilities.

### Dev Note

None.
