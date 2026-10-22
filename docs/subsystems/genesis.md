# Genesis life services

English | [中文](genesis.zh.md)

The optional [Genesis layer](../genesis/README.md) owns a persistent life, sourced memories and observed system growth. [Data records](../genesis/data-model.md) define identity continuity and evidence; [integration](../genesis/architecture.md) defines lifecycle and permission ownership.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxgenesis--lifecore"></a>

### `ctx.genesis` — `LifeCore`

One life domain owner. Writes serialize and replace one snapshot, so facts and state commit together. Storage failures poison this instance until reload; validation and capacity refusals leave it usable. Returned data is detached.

```ts cordis-catalog
/**
 * Initialize once or restore the same life; birth and initial memory commit atomically.
 * @returns Resolution only after durable startup.
 */
start(): Promise<void>

/**
 * Read committed state after all previously accepted observations settle.
 * @returns Detached life snapshot; rejects when closed or storage is untrusted.
 */
async snapshot(): Promise<LifeState>

/**
 * Append an attributed fact once, identified by Session plus durable sequence.
 * @param observation - Actual Session event metadata, never a model assertion.
 * @returns Committed fact, including the original fact for duplicate delivery.
 */
observe(observation: ObservedInteraction): Promise<LifeEvent>

/**
 * Bind an actual created or resumed Session to this life without changing identity.
 * @param sessionId - Harness Session identifier.
 * @param source - Actual Harness creation/resume source.
 * @returns After the binding fact commits; repeat bindings are idempotent.
 */
bind(sessionId: SessionId, source: string): Promise<void>

/**
 * Compare real visible tool declarations in one Session scope. Permission
 * remains execution-time policy; declaration changes do not imply tested skill.
 * @param sessionId - Scope whose previous observation is compared.
 * @param tools - Current registry projection after scope restrictions.
 * @returns After changed capabilities and their growth history commit together.
 */
scan(sessionId: SessionId, tools: readonly ToolSchema[]): Promise<void>

/**
 * Create a sourced memory. Caller interpretation remains a candidate, never an automatic fact.
 * @param input - Validated memory fields with existing life-event references.
 * @returns Newly committed memory.
 */
remember(input: MemoryInput): Promise<LifeMemory>

/**
 * Replace mutable memory fields, retaining identity and creation time.
 * @param id - Memory identifier.
 * @param input - Complete replacement and evidence.
 * @returns Committed replacement, or undefined if absent.
 */
updateMemory(id: MemoryId, input: MemoryInput): Promise<LifeMemory | undefined>

/**
 * Delete memory content while retaining an audit fact and its original sources.
 * @param id - Memory identifier.
 * @returns Whether a memory was durably removed.
 */
deleteMemory(id: MemoryId): Promise<boolean>

/**
 * Rename the life through an explicit application operation; immutable birth fields stay fixed.
 * @param name - Display name or null for unnamed.
 * @returns After identity and its history commit.
 */
rename(name: string | null): Promise<void>

/**
 * Read one committed memory without activating a Session.
 * @param id - Stable memory identifier.
 * @returns A detached memory or undefined if absent or deleted.
 */
async getMemory(id: MemoryId): Promise<LifeMemory | undefined>

/**
 * Retrieve lexical memories by category, time, importance and recency.
 * @param query - Explicit result and character bounds.
 * @returns Highest-ranked whole memories fitting both limits.
 */
async retrieve(query: MemoryQuery): Promise<LifeMemory[]>

/**
 * Query facts in chronological order, with optional type/time filters.
 * @param query - Bounded query.
 * @returns Detached facts, newest matching page retained in ascending order.
 */
async events(query: EventQuery): Promise<LifeEvent[]>

/**
 * Stop admission, drain accepted observations, persist graceful stop and release the domain.
 * @returns Shared teardown promise. A stop-write failure rejects after releasing storage.
 */
close(): Promise<void>
```

Types: [EventQuery](../genesis/data-model.md) · [LifeEvent](../genesis/data-model.md) · [LifeMemory](../genesis/data-model.md) · [LifeState](../genesis/data-model.md) · [MemoryId](../genesis/data-model.md) · [MemoryInput](../genesis/data-model.md) · [MemoryQuery](../genesis/data-model.md) · [ObservedInteraction](../genesis/data-model.md) · [SessionId](core.md) · [ToolSchema](tools.md)

Source: [`packages/experimental/genesis/src/core.ts`](../../packages/experimental/genesis/src/core.ts)

<a id="ctxgenesisstatus--genesisstatusgateway"></a>

### `ctx.genesisStatus` — `GenesisStatusGateway`

Read current Genesis state without exposing a remote identity or permission writer.

```ts cordis-catalog
/**
 * Sample live tools, identity, counts and bounded memory/growth previews.
 * Historical scopes are excluded from current availability. Errors reject;
 * callers keep their previous sample visibly stale and offer retry.
 * @param signal - Caller cancellation; already-started life writes retain their durability semantics.
 * @returns A bounded detached status sample with explicit omission counts.
 */
@Remote('inspect') async inspect(signal: AbortSignal): Promise<LifeStatus>
```

Types: [LifeStatus](../genesis/data-model.md)

Source: [`packages/experimental/genesis/src/status.ts`](../../packages/experimental/genesis/src/status.ts)
<!-- END GENERATED cordis-surface -->
