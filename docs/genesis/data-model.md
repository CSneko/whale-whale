# Genesis data model

English | [中文](data-model.zh.md)

## Summary

The owning [schemas](../../packages/experimental/genesis/src/model.ts) define the durable records. Domain version 1 and row `schemaVersion: 1` refuse incompatible readers. Identity and its history are not tied to a model name, Session ID, user ID or prompt.

## Records

| Record | Meaning |
|---|---|
| Identity | Stable branded life ID, nullable name, immutable creation time, update time, core version and initial framework/version. |
| Life event | Branded event ID, life ID, type, time, source, JSON payload, stable deduplication key and optional Session/event references. |
| Memory | Branded memory ID, category, content, creation/update times, importance, confidence and required existing source-event IDs. |
| Capability | Tool name as branded capability ID, declaration hash, first observation/change times, scope availability, execution-time permission and last use outcome. |
| Growth | Branded growth ID, system category, time, title, description and related life-event IDs. |

## Consistency and recovery

One `states/life` row commits identity, events, memories, Session observations and growth together. The domain schema checks record ownership, unique IDs/deduplication keys, exactly one matching birth and existing memory/growth sources. Initial memory and birth cannot commit separately.

The existing JSON and SQLite Storage Domain backends support this representation. No new SQL schema or migration framework is introduced. Failed persistence makes the core unavailable until reload, because an I/O failure can have an unknown durable outcome. Input/capacity refusals do not mutate committed data.

Retained history is bounded by configurable record and serialized-character limits. Capacity exhaustion refuses new writes instead of discarding history. Each write currently replaces the whole snapshot; larger histories need an explicit migration and incremental storage design.

Future migrations must preserve the life ID, birth time and source relationships. Back up the complete storage unit before any conversion; never reinterpret incompatible data as an empty life.

## Dev Note

None.
