# Genesis architecture

English | [中文](architecture.zh.md)

## Summary

The experimental Genesis plugin owns one persistent life. Its life core depends on the Storage Domain interface and data types, while the integration adapter owns Cordis, Session evidence, prompt contributions and native tools. No Agent Loop or provider implementation is replaced.

## Loading and ownership

Loading acquires an exclusive writer lease, opens the `genesis` domain, validates stored records, restores or atomically creates the identity with its birth fact, and records startup. Domain reads that fail never create a replacement identity. The lease path must be shared by every process addressing the same data.

The core serializes read-modify-write operations and commits one complete state row. Its domain is closed only after accepted work and the graceful-stop fact settle. Plugin effects withdraw tools, prompts and listeners; the lease is released during teardown. A crash may leave no stop fact and an abandoned lease.

## Harness integration

`agent/created` binds a real Session to the existing life. `system-prompt/assemble` and `agent/pre-step` refresh selected context and actual scoped tool declarations. The Harness logs the contributed system and runtime context normally. Native tool results follow the existing durable tool pipeline.

`session/event` observes real user messages and tool results as metadata facts, identified by Session ID and sequence. It never republishes a Session event. Only the latest live user evidence and pending tool-call names are held in adapter memory; no deprecated synchronous historical Session readers are used.

Facts say what happened; memories contain attributed interpretations. Model output never changes identity. In awakening mode, a validated learning call records a learned capability without granting execution permission. Live availability is scoped to an Agent; old Session observations remain historical. Authorization stays with the Harness execution pipeline.

The optional [memory pipeline](memory.md) attaches to `agent/turn-stopping`, serializes independent reviews across Sessions and drains or cancels remote work before core teardown. Auxiliary calls use the configured Harness model adapters; embedding requests use an explicit endpoint. Declarative recall is tool-driven, while only the small non-declarative layer joins prompt context. Each core commit also replaces the local backup.

The optional [awakening layer](awakening.md) owns the complete character prompt, naming prerequisite and learned-tool schema selection. A monotonic registry guard independently denies unlearned calls. Only learned tool observations enter its self context, so the registry catalogue is never an initial model input. First-conversation and learning facts share the life domain; independent Sessions do not share transcript state.

## Web status

The optional browser companion mounts its generated experimental Remote contribution separately from stable API assemblies. `GenesisStatusGateway.inspect` samples real live tools and bounded persisted previews through the existing authenticated Gateway. The General settings contribution uses the shared resource model, with explicit refresh and reconnection refresh, no polling and no additional port. With awakening enabled, the authenticated `initialize` operation prepares the configured routes, probes embeddings and commits the user-selected name once. API/account configuration uses existing provider services. Naming operations are cancelled and drained before life teardown.

## Dev Note

None.
