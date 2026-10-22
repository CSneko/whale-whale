# Genesis development

English | [中文](development.zh.md)

## Summary

Extend the life owner through sourced, atomic state changes; integrate new runtime facts through the adapter. Keep provider-specific execution and authorization outside the life core.

## Validate

```sh
node node_modules/typescript/bin/tsc -b packages/experimental/genesis --pretty false
node node_modules/typescript/bin/tsc -b packages/experimental/client-ui-genesis --pretty false
node node_modules/vitest/vitest.mjs run packages/experimental/genesis/tests packages/experimental/client-ui-genesis/tests
```

Tests allocate private temporary roots, exercise both JSON and SQLite, and load real Cordis configuration with the production Agent Loop and tool registry. Only model output is scripted; no real life history or credentials are required.

## Extend safely

New life facts need an actual producer, stable source key, JSON validation, source attribution and tests for duplicate delivery. Memory retrieval can be replaced independently of persistence. Keep ID/birth writes in initialization; application rename may change only the display name and update time.

Detect capabilities through actual scoped registration. A declaration hash change means the callable declaration changed; it does not establish a package version or learned skill. An installed disabled plugin is unknown to this adapter. Record successful/failed use from settled tool results.

## Diagnose storage

The supplied overlay uses `$DSH_HOME/storages/genesis.json` and `$DSH_HOME/genesis.writer.lock`. Stop the writer and back up the entire file before inspection or repair. After a crash, remove an abandoned lease only after confirming no process still addresses the data. Never delete life data to clear a startup error.

A corrupt JSON document, rejected domain version, invalid identity or missing source causes restoration failure. Retain the damaged data and restore a verified backup or write an explicit migration. Do not silently fall back to a second identity.

## Dev Note

None.
