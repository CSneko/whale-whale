# Genesis 生命服务

[English](genesis.md) | 中文

可选的 [Genesis 层](../genesis/README.zh.md)负责持久生命、带来源记忆与系统成长观察。[数据记录](../genesis/data-model.zh.md)定义身份连续性与证据，[集成架构](../genesis/architecture.zh.md)定义生命周期与权限归属。

可选的版本 3 `EmotionState` 分别保存九项即时 `EmotionCurrent`、二维 `Mood` 心境与独立 `Needs`；恢复参数、修订、操作者设置及可选的单个 `RelationshipState` 与锚点一同持久化。关系保存五项估计、各字段置信度和来源；`RelationshipAdjustment` 是带原因的明确操作者输入。`EmotionUpdate` 携带有来源的事件评价、有界的情绪/心境/需求变化、可选关联对象与关系变化。`EmotionDialogue` 是有界可重放交流窗口。`EmotionSettings` 控制评价及恢复，用共享 `sensitivity` 倍率调节情绪及关系变化，`EmotionAdjustment` 替换三层情感状态。`EmotionHistoryEntry` 返回有界、带归属的变化、解释和实际应用效果。`LifeCore.reviewEmotion` 将变化、证据与重放标记一同提交，时机、迁移与失败语义见[情绪](../genesis/emotion.zh.md)。

`MemoryOrganizationRequest` 携带带品牌的请求 ID、所选记忆版本及可选精确结果条数。`OrganizedMemory` 是 `LifeCore.organizeMemories` 接受的已校验、带嵌入推断；`GenesisMemoryGateway.organize` 提供手动归纳。[整理选中记忆](../genesis/memory.zh.md#selected-memory-organization)说明限制与恢复规则。

`OperatorIdentity` 表示明确填写的操作者姓名和身份；可选持久化资料带修订号和来源生命事件。`MemoryRelabel` 表示已验证的称呼替换及重建向量。`LifeState.suppressedHabitEvidence` 在直接人工编辑后排除旧习惯证据，无需记录修改历史。日历时间标记与角色读取的相对时间见[记忆时间](../genesis/memory.zh.md#memory-time)。

`WritingEntry` 保存角色文字、不可变的创建归属和带版本的人工编辑；`WritingType` 保存稳定类型编号和可编辑名称。`WritingSearch` 与 `WritingRead` 返回有界匹配结果和正文分段。`GenesisRecordsGateway` 负责已认证的后台管理，可选的已学工具复用同一记录所有者。[文字记录](../genesis/records.zh.md)定义文件持久化、独立于记忆的语义及恢复。

`AgencyState` 是可选版本化投影，拥有 `LifeMotivation`、跨会话 `LifeGoal` 和结构化 `LifeDecision`。`DeliberationPlan` 校验模型提案，`DeliberationCommit` 保留可信调用方选择的证据与修订；`LifeDeliberationEngine` 提供输入审议和可信自主入口，`LifeCore` 原子提交并确认结果。意愿、权限、状态变化与恢复规则见[动机与审议](../genesis/motivation.zh.md)。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxgenesis--lifecore"></a>

### `ctx.genesis` — `LifeCore`

One life owner. Writes serialize components and replace one manifest, so facts and state commit together. Storage failures poison this instance until reload; validation and capacity refusals leave it usable. Returned data is detached.

```ts cordis-catalog
/**
 * Initialize once or restore the same life; birth and initial memory commit atomically.
 * @returns Resolution only after durable startup.
 */
start(): Promise<void>

/**
 * Record an actual application deliberation trigger without copying user text.
 * @param sessionId - Audit Session receiving the trigger.
 * @param key - Caller-owned stable replay key, scoped to this Session.
 * @param kind - Request admission or externally delivered event.
 * @param source - Required existing life event for an external trigger; absent for requests.
 * @returns Original or newly committed trigger fact.
 */
prepareDeliberation(sessionId: SessionId, key: string, kind: 'request' | 'event', source?: LifeEventId): Promise<LifeEvent>

/**
 * Publish a validated deliberation and all its state transitions atomically.
 * @param commit - Captured evidence, revision and proposal from the independent writer.
 * @returns Committed choice; replay returns the original choice without further changes.
 */
commitDeliberation(commit: DeliberationCommit): Promise<LifeDecision>

/**
 * Reserve an autonomous follow-up once before enqueueing; a crash leaves an explicit uncertain admission.
 * @param id - Pending externally triggered choice.
 * @returns Whether this caller acquired dispatch; replay and settled choices return false.
 */
reserveDecisionDispatch(id: DecisionId): Promise<boolean>

/**
 * Check the committed decision synchronously at tool execution; poisoned storage refuses access.
 * @param id - Choice admitted by this live Agent's integration.
 * @returns Whether willingness permits task tools; execution authorization remains independent.
 */
permitsDecision(id: DecisionId): boolean

/**
 * Attach observed Session result references and update failure history, without claiming goal completion.
 * @param id - Committed decision whose execution has settled.
 * @param outcome - Host-derived result, never model-authored text.
 * @param sources - Actual observed life event IDs from this decision's Session.
 * @returns After result publication; repeat settlements are no-ops.
 */
settleDecision(id: DecisionId, outcome: LifeDecision['outcome']['status'], sources: LifeEventId[]): Promise<void>

/**
 * Confirm goal completion after independent application verification of a successful linked execution.
 * @param id - Active life goal; ordinary chat and deliberation proposals cannot complete it.
 * @param decisionId - Settled successful execution linked to this goal.
 * @param evidence - Successful tool-result fact from that decision's observed outcome.
 * @returns After completion and its immutable history commit; replay is idempotent.
 */
completeLifeGoal(id: LifeGoalId, decisionId: DecisionId, evidence: LifeEventId): Promise<void>

/**
 * Commit one sourced interest interpretation and a replay marker together.
 * @param sessionId - Conversation whose committed exchange supplied the evidence.
 * @param current - Current completed exchange; older turns are context only.
 * @param proposals - Validated writer proposals, or an empty list for no change.
 * @returns After durable publication; replay of this exchange has no effect.
 */
reviewInterest(sessionId: SessionId, current: InterestDialogue['turns'][number], proposals: InterestProposal[]): Promise<void>

/**
 * Read committed state after all previously accepted observations settle.
 * @returns Detached life snapshot; rejects when closed or storage is untrusted.
 */
async snapshot(): Promise<LifeState>

/**
 * Commit an emotion appraisal and its deduplication marker atomically with cited life evidence.
 * @param sessionId - Source conversation, never another Session's text.
 * @param evidence - Current exchange and optional earlier complete exchanges.
 * @param revision - Emotion revision captured before inference; stale proposals are refused.
 * @param update - Validated signed changes; omitted records a no-change decision.
 * @returns After durable commit; replay is a no-op and storage uncertainty stops dependent operations.
 */
reviewEmotion(sessionId: SessionId, evidence: EmotionDialogue['turns'], revision: number, update?: EmotionUpdate): Promise<void>

/**
 * Save operator emotion rules with revision fencing; recovery under the old rules precedes the change.
 * @param settings - Validated complete operator choices; they take precedence over deployment defaults.
 * @param revision - Last displayed emotion revision; concurrent appraisals or edits reject this write.
 * @returns Committed revision; backup uncertainty stops dependent operations until verified reload.
 */
configureEmotion(settings: EmotionSettings, revision: number): Promise<number>

/**
 * Set operator-selected absolute intensities without manufacturing dialogue evidence.
 * @param adjustment - Validated immediate/mood/need values and nonempty operator reason.
 * @param revision - Last displayed emotion revision; stale edits leave state unchanged.
 * @returns Committed revision; the next request receives the adjusted state through logged context.
 */
adjustEmotion(adjustment: EmotionAdjustment, revision: number): Promise<number>

/**
 * Replace the deployment operator's relationship estimates with an explicit attributed adjustment.
 * @param adjustment - Validated display label, five values and audit reason.
 * @param revision - Last observed emotion revision; conflicting changes reject atomically.
 * @returns Committed emotion revision; manual estimates do not become dialogue evidence.
 */
adjustRelationship(adjustment: RelationshipAdjustment, revision: number): Promise<number>

/**
 * Read committed naming, learned tools and the first conversation, without copying another Session's context.
 * @returns Detached global life progress; an untrusted or closed core rejects.
 */
learningStatus(): { ready: boolean; tools: string[]; firstSessionId?: SessionId; firstConversationComplete: boolean }

/**
 * Name the existing life once after the application has checked model configuration; never create a second identity.
 * @param name - User-selected name, validated before storage admission.
 * @returns After naming commits; repeating the same name is idempotent and a conflicting name is refused.
 */
awaken(name: string): Promise<void>

/**
 * Bind the first accepted conversation once; subsequent Sessions retain their own context.
 * @param sessionId - Session receiving the first accepted user or built-in awakening input.
 * @returns After the first-conversation fact commits, or after an idempotent repeat.
 */
beginConversation(sessionId: SessionId): Promise<void>

/**
 * Record completion only after the canonical first Session commits a successful turn with a text reply.
 * @param sessionId - Actual completed conversation.
 * @param eventId - Durable turn-end sequence, retained as source evidence.
 * @param timestamp - Source event time.
 * @returns After the idempotent completion fact is durable; unrelated Sessions do not complete initialization.
 */
completeFirstConversation(sessionId: SessionId, eventId: string, timestamp: string): Promise<void>

/**
 * Persist one tool-learning event, independently of availability and execution permissions.
 * @param tool - Exact current tool name checked by the learning tool against the caller's registry.
 * @param sessionId - Actual learning Session.
 * @returns After learning and its growth record commit together; repeats do not duplicate them.
 */
learn(tool: string, sessionId: SessionId): Promise<void>

/**
 * Record the stable private host directory without replacing an existing location silently.
 * @param path - Prepared canonical directory authorized by deployment configuration.
 * @returns After the location is durable; a conflicting configured location is refused.
 */
setPersonalDirectory(path: string): Promise<void>

/**
 * Save explicit operator identity with version-fenced current-memory relabeling.
 * @param profile - Authenticated human-authored name and identity.
 * @param revision - Displayed operator revision, zero before first configuration.
 * @param versions - Complete memory set captured before inference; concurrent edits refuse publication.
 * @param changes - Validated wording-only replacements and refreshed embeddings.
 * @returns New identity revision; original interpretations remain in version history.
 */
saveOperator(profile: OperatorIdentity, revision: number, versions: Array<{ id: MemoryId; updatedAt: string }>, changes: MemoryRelabel[]): Promise<number>

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
 * Record the first tool inventory as a baseline, then compare declarations in the same Session.
 * Baselines are observations, not growth; permissions and learned skills remain independent.
 * @param sessionId - Scope whose previous observation is compared.
 * @param tools - Current registry projection before the character's learned-tool restriction.
 * @returns After the baseline or subsequent capability changes commit with their source events.
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
 * Create a sourced operator candidate or directly edit its current projection without an edit event or revision history.
 * @param id - Client-allocated UUID; retaining it makes retries of a new entry idempotent.
 * @param draft - Editable candidate fields, never caller-supplied source references.
 * @param updatedAt - Observed version, or null for a new entry.
 * @param maxImplicit - Non-declarative count budget.
 * @returns Committed candidate retaining its identity and earlier sources when edited.
 */
editMemory(id: MemoryId, draft: MemoryDraft, updatedAt: string | null, maxImplicit: number): Promise<LifeMemory>

/**
 * Change only the memory layer, retaining content, sources, identity and its embedding.
 * @param id - Existing memory.
 * @param kind - Explicit operator choice.
 * @param updatedAt - Version observed by the editor; stale conversions are refused.
 * @param maxImplicit - Whole-life non-declarative count budget.
 * @returns Converted memory; an idempotent same-layer request leaves history unchanged.
 */
convertMemory(id: MemoryId, kind: 'declarative' | 'non-declarative', updatedAt: string, maxImplicit: number): Promise<LifeMemory>

/**
 * Delete current memory content; automatic deletion records a fact, while operator deletion creates no edit history.
 * @param id - Memory identifier.
 * @param updatedAt - Optional displayed version; when supplied, concurrent edits are refused.
 * @returns Whether a memory was durably removed.
 */
deleteMemory(id: MemoryId, updatedAt?: string): Promise<boolean>

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
 * @param experience - Optional remembered event; commits atomically with the derived entries.
 * @param evidence - Completed user exchange metadata for independent habit support and durable maintenance.
 * @returns After all changes and the replay marker commit, or no-op on replay.
 */
reviewMemory(key: string, changes: MemoryChange[], maxImplicit: number, experience?: ExperienceChange, evidence?: ReviewEvidence): Promise<void>

/**
 * Persist the operator's maintenance preference independently of deployment defaults.
 * @param enabled - Whether idle maintenance may run.
 * @returns After the preference commits; pending work is retained when disabled.
 */
setConsolidation(enabled: boolean): Promise<void>

/**
 * Request one maintenance pass over current memories, retaining its source Session for the inference audit.
 * @returns After pending work and a fresh retry budget commit; absent conversation evidence is refused.
 */
requestConsolidation(): Promise<void>

/**
 * Commit one bounded consolidation with an optimistic revision check and replay marker.
 * @param plan - Validated changes and the exact selected memory versions.
 * @param maxImplicit - Whole-life prompt memory limit.
 * @returns Whether the pass committed; concurrent edits leave work pending.
 */
consolidate(plan: ConsolidationCommit, maxImplicit: number): Promise<boolean>

/**
 * Atomically replace selected memories with their sourced synthesis.
 * @param request - Stable request and exact source versions.
 * @param changes - Validated, embedded interpretations citing selected memories.
 * @param sessionId - Durable auxiliary inference audit Session.
 * @returns Committed results; retries return the same identities.
 */
organizeMemories(request: MemoryOrganizationRequest, changes: OrganizedMemory[], sessionId: SessionId): Promise<LifeMemory[]>

/**
 * Retain a safe failed maintenance outcome without discarding pending evidence.
 * @param revision - Work revision that failed; superseded work keeps its own retry budget.
 * @param failure - Classified, redacted diagnostic from the operation owner.
 * @returns After the diagnostic commits, or a no-op for superseded work.
 */
failConsolidation(revision: number, failure: ReviewFailure): Promise<void>

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

Types: [ConsolidationCommit](../genesis/memory.zh.md) · [DecisionId](../genesis/motivation.zh.md) · [DeliberationCommit](../genesis/motivation.zh.md) · [EventQuery](../genesis/data-model.zh.md) · [ExperienceChange](../genesis/memory.zh.md) · [InterestDialogue](../genesis/interest.zh.md) · [InterestProposal](../genesis/interest.zh.md) · [LifeDecision](../genesis/motivation.zh.md) · [LifeEvent](../genesis/data-model.zh.md) · [LifeEventId](../genesis/data-model.zh.md) · [LifeGoalId](../genesis/motivation.zh.md) · [LifeMemory](../genesis/data-model.zh.md) · [LifeState](../genesis/data-model.zh.md) · [MemoryChange](../genesis/memory.zh.md) · [MemoryDraft](../genesis/memory.zh.md) · [MemoryId](../genesis/data-model.zh.md) · [MemoryInput](../genesis/data-model.zh.md) · [MemoryOrganizationRequest](../genesis/memory.zh.md) · [MemoryQuery](../genesis/data-model.zh.md) · [MemoryRelabel](../genesis/memory.zh.md) · [ObservedInteraction](../genesis/data-model.zh.md) · [OperatorIdentity](../genesis/memory.zh.md) · [OrganizedMemory](../genesis/memory.zh.md) · [ReviewEvidence](../genesis/memory.zh.md) · [ReviewFailure](../genesis/memory.zh.md) · [SessionId](core.zh.md) · [ToolSchema](tools.zh.md)

Source: [`packages/experimental/genesis/src/core.ts`](../../packages/experimental/genesis/src/core.ts)

<a id="ctxgenesisdeliberation--lifedeliberationengine"></a>

### `ctx.genesisDeliberation` — `LifeDeliberationEngine`

Life-wide FIFO for inference, with per-Agent admitted execution and cancellation ownership.

```ts cordis-catalog
/**
 * Deliberate before real user input is admitted; preserve the original input and append the logged choice.
 * @param agent - Actual conversation scope.
 * @param messages - Accepted pre-step input from downstream listeners.
 * @param signal - Current turn cancellation.
 * @returns Original input plus one source-tagged choice, or unchanged continuation input.
 */
async admit(agent: Agent, messages: UserMessage[], signal: AbortSignal): Promise<UserMessage[]>

/**
 * Run one externally triggered autonomous deliberation without a user assignment; enqueue only its chosen response/action.
 * @param agent - Idle live Agent receiving logged inference and any chosen follow-up.
 * @param request - Stable replay key and an existing life event, supplied by a trusted adapter or future scheduler.
 * @param signal - Caller cancellation; no background wake timer is installed.
 * @returns Committed choice. Waiting queues nothing; replay never dispatches the same decision again.
 */
async deliberate(agent: Agent, request: { key: string; sourceEventId: LifeEventId }, signal: AbortSignal): Promise<LifeDecision>

/**
 * Record only actual committed assistant/tool outcomes and clear live tool admission.
 * @param agent - Agent whose admitted execution is finishing.
 * @param interrupted - Whether failure, cancellation or disposal interrupted execution.
 * @returns After durable settlement; absence of an admission is a no-op.
 */
settle(agent: Agent, interrupted: boolean): Promise<void>

/**
 * Retain bounded result metadata delivered live; no historical Session reads or result bodies are needed.
 * @param sessionId - Actual event owner.
 * @param event - Committed Session event supplied by the integration.
 */
observe(sessionId: SessionId, event: SessionEvent): void

/** Cancel auxiliary inference and drain accepted reviews; core storage remains owned by the plugin.
 * @returns After all pending inference operations settle.
 */
async close(): Promise<void>
```

Types: [Agent](core.zh.md) · [LifeDecision](../genesis/motivation.zh.md) · [LifeEventId](../genesis/data-model.zh.md) · [SessionEvent](session.zh.md) · [SessionId](core.zh.md) · [UserMessage](session.zh.md)

Source: [`packages/experimental/genesis/src/deliberation.ts`](../../packages/experimental/genesis/src/deliberation.ts)

<a id="ctxgenesismemory--genesismemorygateway"></a>

### `ctx.genesisMemory` — `GenesisMemoryGateway`

Explicit user memory controls; errors retain their actual stage and safe diagnostic.

```ts cordis-catalog
/**
 * Generate selected-layer memories for one durable reply without running the decision model.
 * @param sessionId - Open conversation owning the reply.
 * @param messageId - Completed assistant message.
 * @param kind - Operator-selected memory layer.
 * @param signal - Caller cancellation; storage commits already admitted drain.
 * @returns Whether changes were saved; repeated requests are idempotent.
 */
@Remote({ name: 'generate', resources: { session: (sessionId: SessionId) => sessionId } }) generate(sessionId: SessionId, messageId: MessageId, kind: MemoryKind, signal: AbortSignal): Promise<boolean>

/**
 * Create a sourced operator candidate or directly update its current fields without an edit event or revision.
 * @param id - Client-allocated memory UUID, retained across retries.
 * @param draft - Editable fields; attribution and sources are assigned by the core.
 * @param updatedAt - Displayed version, or null when creating.
 * @param signal - Cancellation before storage admission.
 * @returns Accepted memory without its vector cache.
 */
@Remote('save') save(id: MemoryId, draft: MemoryDraft, updatedAt: string | null, signal: AbortSignal): Promise<LifeMemory>

/**
 * Delete current memory content after checking the displayed version, without adding an edit event.
 * @param id - Memory to remove.
 * @param updatedAt - Displayed version; stale deletion is refused.
 * @param signal - Cancellation before storage admission.
 * @returns Whether the memory existed and was deleted.
 */
@Remote('deleteMemory') deleteMemory(id: MemoryId, updatedAt: string, signal: AbortSignal): Promise<boolean>

/**
 * Enable or disable automatic idle consolidation without dropping queued evidence.
 * @param enabled - Operator preference, shared across modes and restarts.
 * @param signal - Cancellation before storage admission.
 * @returns After the preference commits and scheduling is reconsidered.
 */
@Remote('setConsolidation') setConsolidation(enabled: boolean, signal: AbortSignal): Promise<void>

/**
 * Run one explicit consolidation pass using the saved writer and embedding configuration.
 * @param signal - Operator cancellation; a conversation also cancels pending inference.
 * @returns Whether the pending revision committed; failures retain their specific stage and cause.
 */
@Remote('consolidate') consolidate(signal: AbortSignal): Promise<boolean>

/**
 * Integrate explicitly selected memory versions into one or several new candidates.
 * @param request - Stable retry identity, selected versions and optional exact result count.
 * @param signal - Operator cancellation; admitted primary writes drain.
 * @returns Sourced results without vectors, atomically replacing the selection. Inference failures retain originals; storage or cleanup failures require checking the stable request on retry.
 */
@Remote('organize') organize(request: MemoryOrganizationRequest, signal: AbortSignal): Promise<LifeMemory[]>

/**
 * Save explicit operator identity and replace legacy generic role references without changing facts.
 * @param profile - Human-authored operator name and identity.
 * @param revision - Displayed identity revision.
 * @param signal - Caller cancellation; admitted primary writes drain.
 * @returns New revision after identity and all accepted wording replacements commit together.
 */
@Remote('saveOperator') saveOperator(profile: OperatorIdentity, revision: number, signal: AbortSignal): Promise<number>

/**
 * Convert one existing memory between declarative and non-declarative storage.
 * @param id - Existing sourced memory.
 * @param kind - Desired layer; content and sources stay fixed.
 * @param updatedAt - Displayed memory version.
 * @param signal - Caller cancellation before storage admission.
 * @returns Committed memory without its embedding cache.
 */
@Remote('convert') convert(id: MemoryId, kind: MemoryKind, updatedAt: string, signal: AbortSignal): Promise<LifeMemory>
```

Types: [LifeMemory](../genesis/data-model.zh.md) · [MemoryDraft](../genesis/memory.zh.md) · [MemoryId](../genesis/data-model.zh.md) · [MemoryKind](../genesis/memory.zh.md) · [MemoryOrganizationRequest](../genesis/memory.zh.md) · [MessageId](llm-streaming.zh.md) · [OperatorIdentity](../genesis/memory.zh.md) · [SessionId](core.zh.md)

Source: [`packages/experimental/genesis/src/memory-gateway.ts`](../../packages/experimental/genesis/src/memory-gateway.ts)

<a id="ctxgenesisrecords--genesisrecordsgateway"></a>

### `ctx.genesisRecords` — `GenesisRecordsGateway`

Operator API; disabling recording keeps the namespace mounted with an explicit unavailable catalog.

```ts cordis-catalog
/**
 * Read record categories and effective writing limits.
 * @param signal - Caller cancellation.
 * @returns Categories and limits, or null when recording is disabled.
 */
@Remote('catalog') catalog(signal: AbortSignal): Promise<WritingCatalog | null>

/**
 * Search writing titles and content without model calls.
 * @param query - Bounded substring, type and time filters.
 * @param signal - Caller cancellation.
 * @returns Matching records with snippets and continuation offset.
 */
@Remote('search') search(query: WritingQuery, signal: AbortSignal): Promise<WritingSearch>

/**
 * Read one revision in bounded text chunks.
 * @param id - Stable record id.
 * @param offset - Returned continuation position, initially zero.
 * @param signal - Caller cancellation.
 * @returns One bounded text chunk and original attribution.
 */
@Remote('read') read(id: WritingId, offset: number, signal: AbortSignal): Promise<WritingRead>

/**
 * Replace current fields while retaining original creation attribution.
 * @param id - Record to edit.
 * @param draft - Operator replacement text and type.
 * @param revision - Displayed revision.
 * @param signal - Cancellation before commit admission.
 * @returns New revision; rejected edits retain the caller’s draft.
 */
@Remote('edit') edit(id: WritingId, draft: WritingDraft, revision: number, signal: AbortSignal): Promise<number>

/**
 * Erase current writing text and its generated Markdown file.
 * @param id - Record to delete.
 * @param revision - Displayed revision.
 * @param signal - Cancellation before admission.
 * @returns After current text and generated file removal; Session history is independent.
 */
@Remote('deleteRecord') deleteRecord(id: WritingId, revision: number, signal: AbortSignal): Promise<void>

/**
 * Create or update an operator-managed writing category.
 * @param id - Existing type id or null for a new system-generated id.
 * @param name - Display name.
 * @param enabled - Permit new writes.
 * @param revision - Displayed type revision, zero for creation.
 * @param signal - Cancellation before admission.
 * @returns Saved type without relocating records on rename.
 */
@Remote('saveType') saveType(id: WritingTypeId | null, name: string, enabled: boolean, revision: number, signal: AbortSignal): Promise<WritingType>
```

Types: [WritingCatalog](../genesis/records.zh.md) · [WritingDraft](../genesis/records.zh.md) · [WritingId](../genesis/records.zh.md) · [WritingQuery](../genesis/records.zh.md) · [WritingRead](../genesis/records.zh.md) · [WritingSearch](../genesis/records.zh.md) · [WritingType](../genesis/records.zh.md) · [WritingTypeId](../genesis/records.zh.md)

Source: [`packages/experimental/genesis/src/records-gateway.ts`](../../packages/experimental/genesis/src/records-gateway.ts)

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
 * Persist independent memory routes without credentials or profile-overlay precedence.
 * @param settings - Decision and writer routes.
 * @param revision - Displayed revision; stale changes are refused.
 * @param signal - Caller cancellation; admitted writes still drain.
 * @returns Committed revision.
 */
@Remote('saveModels') async saveModels(settings: MemoryModelsSettings, revision: number, signal: AbortSignal): Promise<number>

/**
 * Check a saved provider route, or authenticate against an endpoint's model catalog without sending conversation data.
 * @param role - Independent decision or writer configuration to check.
 * @param signal - Caller cancellation; the memory timeout bounds network work.
 * @returns After provider preparation or a valid model catalog containing the selected model.
 */
@Remote('testModel') async testModel(role: 'decision' | 'writer', signal: AbortSignal): Promise<void>

/**
 * Start the logged built-in awakening in an existing blank life-mode Session, once per life.
 * @param sessionId - Session created through the supported Web Session API.
 * @param language - UI language used only for the first greeting.
 * @param signal - Caller cancellation before admission; queued work belongs to the Agent thereafter.
 * @returns Canonical first Session, including when another browser already started it.
 */
@Remote('greet') async greet(sessionId: SessionId, language: 'en' | 'zh', signal: AbortSignal): Promise<SessionId>

/**
 * Save complete operator emotion rules without changing life identity or permissions.
 * @param settings - JSON-validated enabled state, appraisal bounds and recovery parameters.
 * @param revision - Last displayed emotion revision; stale drafts are rejected.
 * @param signal - Caller cancellation; admitted writes still drain.
 * @returns Committed revision; refresh status before making a subsequent edit.
 */
@Remote('saveEmotionSettings') async saveEmotionSettings(settings: EmotionSettings, revision: number, signal: AbortSignal): Promise<number>

/**
 * Apply an explicit operator adjustment, recorded separately from model appraisals.
 * @param adjustment - Absolute intensities and the operator's reason.
 * @param revision - Last displayed revision; stale drafts cannot overwrite newer state.
 * @param signal - Caller cancellation; accepted writes complete before disposal.
 * @returns Committed revision; the next logged request context reflects this adjustment.
 */
@Remote('adjustEmotion') async adjustEmotion(adjustment: EmotionAdjustment, revision: number, signal: AbortSignal): Promise<number>

/**
 * Adjust the persistent single-operator relationship without creating conversation evidence.
 * @param adjustment - Absolute values, display label and operator reason.
 * @param revision - Last sampled emotion revision; stale edits are refused.
 * @param signal - Caller cancellation; accepted atomic writes drain.
 * @returns Committed revision; refresh the shared status after saving.
 */
@Remote('adjustRelationship') async adjustRelationship(adjustment: RelationshipAdjustment, revision: number, signal: AbortSignal): Promise<number>

/**
 * Retry the latest failed review while its live evidence remains available.
 * @param sessionId - Conversation that owns the failed review.
 * @param signal - Caller cancellation; no new chat reply is generated.
 * @returns After the retry settles; restart or newer-turn evidence requires a new conversation turn.
 */
@Remote('retryMemory') async retryMemory(sessionId: SessionId, signal: AbortSignal): Promise<void>

/**
 * Save nonsecret embedding preferences independently of command-line profile overlays.
 * @param settings - Validated endpoint, model, dimensions and optional credential reference.
 * @param revision - Revision from the displayed status sample.
 * @param signal - Caller cancellation; an admitted write drains even if cancelled later.
 * @returns The committed revision, after durable storage has accepted the update.
 */
@Remote('saveEmbedding') async saveEmbedding(settings: EmbeddingSettings, revision: number, signal: AbortSignal): Promise<number>

/**
 * Probe the saved embedding configuration without changing identity or memories.
 * @param signal - Caller cancellation; the configured memory deadline bounds the request.
 * @returns After one response with the expected vector dimensions has been verified.
 */
@Remote('testEmbedding') async testEmbedding(signal: AbortSignal): Promise<void>

/**
 * Browse or search stored memory text without requiring an embedding request.
 * @param query - Literal search text, bounded by the configured response budget.
 * @param signal - Caller cancellation.
 * @returns Sourced candidate memories within the configured item and response limits, without vectors.
 */
@Remote('memories') async memories(query: string, signal: AbortSignal): Promise<LifeStatus['memories']>

/**
 * Sample live tools, identity, counts and bounded memory/growth previews.
 * Historical scopes are excluded from current availability. Errors reject;
 * callers keep their previous sample visibly stale and offer retry.
 * @param signal - Caller cancellation; already-started life writes retain their durability semantics.
 * @returns A bounded detached status sample with explicit omission counts.
 */
@Remote('inspect') async inspect(signal: AbortSignal): Promise<LifeStatus>
```

Types: [EmbeddingSettings](../genesis/memory.zh.md) · [LifeStatus](../genesis/data-model.zh.md) · [MemoryModelsSettings](../genesis/memory.zh.md) · [SessionId](core.zh.md)

Source: [`packages/experimental/genesis/src/status.ts`](../../packages/experimental/genesis/src/status.ts)
<!-- END GENERATED cordis-surface -->
