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
 * Read committed naming, learned tools and the first conversation, without copying another Session's context.
 * @returns Detached global life progress; an untrusted or closed core rejects.
 */
learningStatus(): { ready: boolean; tools: string[]; firstSessionId?: SessionId }

/**
 * Name the existing life once after the application has checked model configuration; never create a second identity.
 * @param name - User-selected name, validated before storage admission.
 * @returns After naming commits; repeating the same name is idempotent and a conflicting name is refused.
 */
awaken(name: string): Promise<void>

/**
 * Bind the first accepted conversation once; subsequent Sessions retain their own context.
 * @param sessionId - Session receiving an actual first user input.
 * @returns After the first-conversation fact commits, or after an idempotent repeat.
 */
beginConversation(sessionId: SessionId): Promise<void>

/**
 * Persist one tool-learning event, independently of availability and execution permissions.
 * @param tool - Exact current tool name checked by the learning tool against the caller's registry.
 * @param sessionId - Actual learning Session.
 * @returns After learning and its growth record commit together; repeats do not duplicate them.
 */
learn(tool: string, sessionId: SessionId): Promise<void>

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
 * Atomically apply an independent writer's changes and record a completed review once.
 * @param key - Stable source turn or explicit user-memory request key.
 * @param changes - Validated changes; all references must belong to this life.
 * @param maxImplicit - Whole-life non-declarative record limit.
 * @returns After all changes and the replay marker commit, or no-op on replay.
 */
reviewMemory(key: string, changes: MemoryChange[], maxImplicit: number): Promise<void>

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

Types: [EventQuery](../genesis/data-model.md) · [LifeEvent](../genesis/data-model.md) · [LifeMemory](../genesis/data-model.md) · [LifeState](../genesis/data-model.md) · [MemoryChange](../genesis/memory.md) · [MemoryId](../genesis/data-model.md) · [MemoryInput](../genesis/data-model.md) · [MemoryQuery](../genesis/data-model.md) · [ObservedInteraction](../genesis/data-model.md) · [SessionId](core.md) · [ToolSchema](tools.md)

Source: [`packages/experimental/genesis/src/core.ts`](../../packages/experimental/genesis/src/core.ts)

<a id="ctxgenesisstatus--genesisstatusgateway"></a>

### `ctx.genesisStatus` — `GenesisStatusGateway`

Sample shared life state and initialize its name without changing its identity or permissions.

```ts cordis-catalog
/**
 * Check configured chat/reviewer/writer routes and the embedding service, then name this existing life once.
 * Credentials use the existing provider settings or account sign-in; no secrets are accepted or stored here.
 * @param name - User-chosen name, retained across Sessions and restarts.
 * @param signal - Caller cancellation; an admitted storage commit may still finish after cancellation.
 * @returns After naming commits; errors leave initialization pending unless a storage write has uncertain outcome.
 */
@Remote('initialize') async initialize(name: string, signal: AbortSignal): Promise<void>

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
