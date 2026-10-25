---
description: "Genesis life information, Knowledge Base configuration and independent memory management."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-client-ui-genesis

English | [中文](README.zh.md)

## Summary

Open dedicated Life information, Knowledge Base, Memories and Emotion pages to inspect identity and growth, configure Jev decisions, an independent writer and embeddings, and browse sourced memories. Keys use the existing credential store. All five presets share the life and memory. Initialize life is a manual action on the new-conversation screen and settings pages; after naming it opens the first Life conversation. The button disappears after successful completion. Do not show again persistently suppresses automatic configuration reminders. No network listener is added.

## Table of Contents

[Use](#use) · [Implementation](#implementation) · [Further Exploration](#further-exploration) · [Model Experience](#model-experience) · [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use"></a>
## Use

Apply this package’s `cordis.patch.yml` beside the [Genesis core overlay](../genesis/README.md) to a Web or Desktop profile with the preset registry. Rebuild browser bundles before launching. The [first-awakening tutorial](../../../docs/genesis/awakening.md) enables naming and the first greeting. Life information owns naming, identity and growth; Knowledge Base owns decision/writer/embedding settings. Memories owns bounded search, creation, editing, deletion and layer conversion. Experience times, associated experience IDs and expandable prior interpretations show how a memory formed and changed. The optional Life preset becomes the deployment default; an existing saved user choice takes precedence.
When [interests](../../../docs/genesis/interest.md) are enabled, Life information also shows their current inferred stages, cited source IDs and bounded change history. The page does not edit interests.

Memories also owns the durable automatic-consolidation toggle, explicit pass, last safe failure and learned habit cue/response/evidence. See [idle consolidation](../../../docs/genesis/memory.md#automatic-habits-and-idle-consolidation) for budgets and cancellation.

Settings → Emotion shows nine immediate reactions, two mood dimensions and independent psychological needs, event interpretations and bounded attributed history. Settings → Relationship manages five operator estimates, distinguishes inference confidence from explicit operator values, and provides reason-bearing revision-fenced edits. Its editors save explicit adjustments with reasons, pause automatic appraisal, and configure sensitivity shared by emotion, recovery and relationship changes. Edits are revision-fenced and persist across restart; failed writes retain drafts, while a shell toast survives successful modal dismissal. See [emotion management](../../../docs/genesis/emotion.md#operator-management).

Memories offers multi-selection and explicit organization into one or several interpretations, atomically replacing originals on success and retaining selections on failure. The Life preset includes the built-in [time context](../../context/time-context/README.md), with logged clock readings and browser-zone guidance. See [selected memory organization](../../../docs/genesis/memory.md#selected-memory-organization).

Memories includes an expandable operator identity form. Saving it safely relabels current legacy participant roles; conflicts retain the draft. Direct edits and conversions add no history. The editor retains stable date anchors while character-facing recall retains important exact dates and renders ordinary experiences relatively. See [identity and memory time](../../../docs/genesis/memory.md).

<a id="implementation"></a>
## Implementation

The plugin mounts the owning package’s generated Remote contribution, registers a `genesis` resource provider and contributes five localized settings pages and a manual memory action on each completed reply. Endpoint edits use revisioned life-owned storage; keys use the existing credential store and never enter configuration or memory. Settings failures show the affected operation and specific diagnostic, including HTTP status, validation fields or connection codes, without displaying password values or provider response bodies. Memory and emotion settings show the latest reviewed turn and completion time, including no-change outcomes; Jev decisions also show their update probability and captured threshold. Memory failures in chat and Knowledge Base show the failing stage and safe diagnostic; retry errors preserve their own cause. Retry feedback resets for a new failed turn. A failed save retains the draft; refresh and Reload configuration load the latest accepted values. The shared resource model owns fetched values and retains them after failure. Credential/settings/provider changes, conversation running-status changes, user refresh and reconnection request new samples; the plugin runs no polling timer. Aborting the resource cancels RPC and releases refresh listeners.

Settings → Her writings browses, searches, reads, edits and deletes the character’s writings and manages their categories through the authenticated records Remote. Shared on-demand resources retain data on failure; captured drafts and revision checks protect edits. See [writings](../../../docs/genesis/records.md) for deletion, attribution and recovery.

<a id="further-exploration"></a>
## Further Exploration

[Run Genesis](../../../docs/genesis/README.md) · [Architecture](../../../docs/genesis/architecture.md) · [Client resources](../../../docs/subsystems/client-resources.md)

<a id="model-experience"></a>
## Model Experience

The Host life plugin owns character and memory instructions. This companion creates the first Session through the existing Session API and asks the Host to enqueue its logged built-in awakening. Provider checks prepare configured routes; endpoint checks authenticate against the model catalog, and embedding testing makes one request. Memory-text search and direct CRUD do not run inference. Per-reply generation uses its source conversation and the independent writer, bypasses the decision model and enforces the chosen memory layer; automatic review remains enabled. See [memory controls](../../../docs/genesis/memory.md) for version checks, sources and retry behavior.

#### KV Cache effect

Refreshing reads Host state without adding conversation events or inference calls. Accepted emotion adjustments and recovery settings affect subsequent logged life context; pausing emotion appraisal stops its auxiliary calls. [Emotion](../../../docs/genesis/emotion.md) owns these model effects.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The view is sampled. One-time naming is available only in awakening mode; it does not replace identity, promote memories, edit permissions or continuously poll.
- Response budgets may omit previews; counts and omission notices expose that distinction. Historical inactive Session tools are not listed as live capabilities.

### Dev Note

None.
