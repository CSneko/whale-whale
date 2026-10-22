# Genesis Phase 1

English | [中文](README.zh.md)

## Summary

Keep one life identity across Sessions and models, retain sourced candidate memories, and inspect actual Session tool availability and system growth. Genesis is optional and does not establish subjective consciousness.

## Contents

[Architecture](architecture.md) · [Data model](data-model.md) · [Development](development.md) · [Roadmap](roadmap.md)

## Run from this workspace

Use Node in the repository engines range and install the workspace dependencies. Run the commands from the repository root. A complete build requires Git metadata; a source archive without `.git` cannot supply the build commit.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:artifacts
pnpm run build:check
```

`--ignore-scripts` avoids package installation hooks; build the required native artifacts through the repository build command. A live model conversation needs a configured Harness model provider. The automated Genesis tests use a scripted adapter and need no API key.

Opt in with the core overlay. Use a dedicated absolute `DSH_HOME` for experiments; keep the same home on subsequent launches to restore the same life.

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --dump-config
```

The dump verifies composition without starting a life or calling a model. Replace `--dump-config` with a task to converse after model configuration.

For Web settings, apply both overlays. The General settings page gains a Genesis section with identity, creation time, counts, live Session capabilities, memories and growth previews. Refresh requests a new authenticated sample.

```sh
pnpm dsh web --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/client-ui-genesis/cordis.patch.yml --dump-config
```

After building, remove `--dump-config` to start Web. The default Harness listener policy applies; Genesis adds no listener. The UI shows the last refresh time and retains a previous sample with a warning when refresh fails.

## Inspect and remember

Ask for identity or birth time through `genesis_self`; search with `genesis_recall`; query facts or growth with `genesis_history`. Explicitly request a memory and include its literal content: “Please remember: I prefer oolong tea”. `genesis_remember` admits only text from the latest observed real user message and stores it as a sourced candidate.

Disable Genesis by omitting its overlays on the next launch. Disabling the Web companion only removes its settings section. Neither operation deletes life data.

## Limits

Emotion, motivation, autonomous goals, awakening, reflection and self-improvement are not implemented. Tool discovery records availability, not mastery or permission. There is no vector database, automatic plugin installation or autonomous source modification.

## Dev Note

None.
