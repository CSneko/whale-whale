# Genesis Phase 1

English | [中文](README.zh.md)

## Summary

Keep one life identity across Sessions and models, retain sourced candidate memories, and inspect actual Session tool availability and system growth. Genesis is optional and does not establish subjective consciousness.

## Contents

[First awakening](awakening.md) · [Memory](memory.md) · [Emotion](emotion.md) · [Interests](interest.md) · [Motivation and decisions](motivation.md) · [Proactive messages](social.md) · [Architecture](architecture.md) · [Data model](data-model.md) · [Development](development.md) · [Roadmap](roadmap.md) · [Writings](records.md) · [Remote access](remote-access.md)

## Run from this workspace

Use Node in the repository engines range and install the workspace dependencies. Run the commands from the repository root. A complete build requires Git metadata; a source archive without `.git` cannot supply the build commit.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:artifacts
pnpm run build:check
```

`--ignore-scripts` avoids package installation hooks; build the required native artifacts through the repository build command. A live model conversation needs a configured Harness model provider. The automated Genesis tests use a scripted adapter and need no API key.

Web launches in this workspace load the life core, first awakening and browser companion by default, listening on `0.0.0.0:4004` with browser key login. After building, run:

```sh
pnpm dsh
```

`pnpm dsh web`, `pnpm start:web` and `make web` use the same defaults, including development mode. The default `DSH_HOME` is `~/.genesis-harness`; explicit `DSH_HOME` and `--port` values take precedence, and additional `--patch` files apply after the defaults. You no longer need `PNPM_MANAGE_PACKAGE_MANAGER_VERSIONS`. Configure an API or sign in, then complete embedding settings in Knowledge Base; see [First awakening](awakening.md).

For local browser testing, run `pnpm dsh web --test-no-login`. Open the authenticated URL printed at startup; it exchanges the launch token for a browser cookie without a key-entry form. This workspace-only flag applies the test overlay last, fixes the listener to `127.0.0.1` even when `--host` is supplied, and preserves `--port`. API authentication remains enabled; the bare root URL still requires a valid cookie. Omit the flag to return to key login. Use a dedicated temporary `DSH_HOME` for automated tests.

Use `pnpm dsh --no-genesis web` for ordinary Harness Web. This switch belongs only to the workspace launcher; the published `dsh` CLI, other profiles and Desktop retain their existing defaults. The examples below explicitly enable selected Genesis features.

Opt in to the foundation with the core overlay. Use a dedicated absolute `DSH_HOME` for experiments; keep the same home on subsequent launches to restore the same life.

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --dump-config
```

The dump verifies composition without starting a life or calling a model. Replace `--dump-config` with a task to converse after model configuration.

For the Web status view, apply both overlays below. Settings gains separate Life information and Knowledge Base pages for identity, live capabilities, growth, embedding configuration and memory search. Refresh requests a new authenticated sample.

```sh
pnpm dsh --no-genesis web --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/client-ui-genesis/cordis.patch.yml --dump-config
```

After building, remove `--dump-config` to start Web. The explicitly composed listener and authentication settings apply; Genesis adds no separate listener. The UI shows the last refresh time and retains a previous sample with a warning when refresh fails.

For credential-first naming, the newborn character and persistent tool learning, use the [first-awakening tutorial](awakening.md). Its life overlay includes the independent memory pipeline and limits initial model tools to learning.

## Inspect and remember

Ask for identity or birth time through `genesis_self`; search with `genesis_recall`; query facts or growth with `genesis_history`. Explicitly request a memory and include its literal content: “Please remember: I prefer oolong tea”. `genesis_remember` admits only text from the latest observed real user message and stores it as a sourced candidate.

Disable default Genesis in workspace Web launches with the leading `--no-genesis` switch; omit Genesis overlays for other profiles. Disabling the Web companion only removes its settings section. Neither operation deletes life data.

## Limits

Optional [emotion](emotion.md) maintains immediate state and slower mood; the workspace life overlay enables it. Optional [interests](interest.md) form from cited exchanges without predefined favorite topics. Optional [deliberation](motivation.md) provides persistent motivations, cross-Session goals and enforced willingness; autonomous task scheduling, reflection and self-improvement remain unavailable. Tool discovery records availability, not mastery or permission. The optional [memory pipeline](memory.md) adds embedding search and independent updates. Automatic plugin installation and autonomous source modification remain unavailable.

## Dev Note

None.
