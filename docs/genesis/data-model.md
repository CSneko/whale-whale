# Genesis data model

English | [中文](data-model.zh.md)

## Summary

The owning [schemas](../../packages/experimental/genesis/src/model.ts) define the durable records. Domain version 1 retains validated legacy snapshots; new writes use the `genesis-split-v1` manifest and reconstruct a life with `schemaVersion: 1`. Identity and its history are not tied to a model name, Session ID, user ID or prompt.

## Records

| Record | Meaning |
|---|---|
| Identity | Stable branded life ID, nullable name, immutable creation time, update time, core version and initial framework/version. |
| Life event | Branded event ID, life ID, type, time, source, JSON payload, stable deduplication key and optional Session/event references. |
| Memory | Branded memory ID, category, content, creation/update times, importance, confidence and required existing source-event IDs, optional declarative/non-declarative kind, attribution and embedding-space/vector cache. |
| Interest | Branded interest ID, free-form topic, current inferred stage, reason and distinct completed exchanges with source-event IDs. |
| Capability | Tool name as branded capability ID, declaration hash, first observation/change times, scope availability, execution-time permission and last use outcome. |
| Growth | Branded growth ID, system category, time, title, description and related life-event IDs. |

Optional memory `experience`, `experienceIds`, `history` and `habit` fields retain event context, derivation links, source-bearing previous interpretations and conditional learned behavior. The optional life `consolidation` cursor retains pending revisions, source Session, operator preference, retry count and the last safe outcome. Their behavior and budgets are defined by [memory](memory.md). Optional version-3 `emotion` retains nine immediate reactions, two mood dimensions, independent needs, recovery parameters, a revision, one operator relationship and optional operator `controls`; sourced transition events commit atomically with it. [Emotion](emotion.md) defines appraisal and recovery. Absent optional fields remain readable; emotion versions 1 and 2 require offline operator conversion before loading. Preserve a verified pre-upgrade backup before conversion or downgrade.

Optional `interests` starts empty when enabled. Each accepted stage change and its cited sources commits with an append-only life event; a no-change review also records a replay marker. The field remains in the `projections` component and is restored across Sessions. [Interests](interest.md) defines progression and bounds. Older states without `interests` remain readable; older strict readers reject a newly written field.

Optional version-1 `agency` retains branded motivations, life goals, decisions, goal transition history and observed execution references, requiring matching initialization and valid source events. Changes commit atomically with life events under existing capacity, backup and recovery rules; older states without this field remain readable, while older strict readers reject it. [Motivation and deliberation](motivation.md) defines the records and transition rules.

<a id="life-storage"></a>

## Consistency and recovery

The `genesis` domain retains one atomic `states/life` manifest. Immutable components live in the `genesis_records` domain, using the existing JSON backend’s per-record layout or SQLite records. JSON directories separate `identity`, `events`, `memories_episodic`, `memories_semantic`, `memories_self`, `memories_procedural`, `embeddings`, `memory_history`, `growth`, `capabilities` and `projections`; each filename is its SHA-256 content key. The manifest preserves record order and publishes only after every referenced component is durable. The domain schema checks record ownership, unique IDs/deduplication keys, exactly one matching birth and existing memory/growth sources. Foundation-only initial memory and birth cannot commit separately; a new awakening-mode life starts without personal memories. Naming, first conversation and learned tools are idempotent life events; learning never implies availability or authorization.

Both domains use the configured Storage Domain routes; include both in backups and configure both routes when selecting a dedicated backend. No SQL schema change is required. Startup verifies component hashes and cross-record invariants before exposing the life. A missing, malformed or incompatible referenced record refuses startup; unreferenced interrupted writes are excluded and cleaned after a successful commit. Failed persistence makes the core unavailable until reload, because an I/O failure can have an unknown durable outcome. Input/capacity refusals do not mutate committed data.

Retained history is bounded by configurable record and serialized-character limits. Capacity exhaustion refuses new writes instead of discarding history. Commits reuse unchanged components, replace the manifest and remove superseded records after the independent backup succeeds. Startup and validation still load the complete bounded life; manifest size grows with record count.

Memory extensions are optional on read: existing records retain their identity and sources; missing kinds classify procedural memories as non-declarative and the rest as declarative. Older strict readers refuse records containing these extensions, so preserve a verified pre-upgrade copy before downgrading. Local backup and review semantics are defined by the [memory reference](memory.md).

Legacy complete snapshots convert on the next successful startup without changing life ID, birth time, event order or source relationships. Old strict readers refuse the new manifest. Back up both complete domains and the independent backup before upgrading; never reinterpret incompatible data as an empty life.

## Dev Note

None.
