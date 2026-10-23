# Genesis long-term memory

English | [中文](memory.zh.md)

## Enable

Genesis's optional `memory` configuration enables semantic recall and independent post-turn memory updates. Configure the ordinary Harness chat provider first. The decision and writer routes use registered Harness LLM adapters; they make separate calls with independent instructions and receive only the completed turn, never another Session's conversation history. They may use the same model route. The decision uses validated JSON from a general LLM; a Typesafe/jev-specific adapter is not included.

Set `GENESIS_EMBEDDING_URL` to the full OpenAI-compatible `/embeddings` endpoint, `GENESIS_EMBEDDING_MODEL` to its model identifier, `GENESIS_EMBEDDING_DIMENSIONS` to its vector length and `GENESIS_EMBEDDING_API_KEY` to its credential in the launching environment. Do not put credentials in patches or Git. Apply the supplied memory overlay after the Genesis overlay:

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/genesis/cordis.memory.patch.yml --dump-config
```

The dump checks composition without making model calls. Remove `--dump-config` and supply a task to converse after configuring the endpoints. The sample selects `deepseek-official/deepseek-v4-flash` for both auxiliary roles; change `memory.decisionProvider`, `decisionModel`, `writerProvider` and `writerModel` to select other registered routes. A keyless local embedding server can omit `embeddingKeyEnv` in a custom patch. Omitting the entire `memory` block retains the earlier lexical/manual memory behavior.

## Recall and updates

The current Session conversation is short-term memory. Declarative long-term memory stores episodes, statements and self knowledge; it is absent from automatic prompt context. The AI actively calls `genesis_recall` with a nonempty query. The knowledge base embeds queries and records, ranks them by cosine similarity and returns complete records within the query and result budgets. Non-declarative memory stores a small set of durable habits or persona guidance and enters the logged prompt as attributed, untrusted candidate data. Missing historical kinds classify procedural entries as non-declarative and other categories as declarative.

Auxiliary request configurations, prompts, exact inputs and completed responses are recorded as ignorable `plugin:genesis/memory-call` Session records before memory publication. They remain in their source Session and never enter the conversation context or drive recovery; readers that do not know Genesis retain and skip them.

After a successful reply, a separate decision call returns update/no-update. A no-update decision makes no writer or embedding call. If an update is needed, another LLM call receives the current turn, semantically retrieved candidates and the small non-declarative set. Its validated create/update/delete plan must cite actual conversation sequence numbers. User-stated memories may reference only user messages; assistant-derived entries remain model inferences. Updates retain previous evidence. The entire plan and a source-turn deduplication marker commit together; replay does not repeat a completed review. `genesis_remember` returns pending review in this mode and does not claim a committed memory.

`maxImplicitMemories` and `memoryChars` bound the small layer. `maxChanges`, `inputChars`, `outputChars`, `maxTokens` and `timeoutMs` bound auxiliary work. Oversized input or output, invalid references, truncated model output and incompatible vectors refuse the update visibly. Model/embedding failures leave conversation text intact and record a failed turn; already observed evidence can remain, but no completed review marker is written. Cancellation is checked before commit admission; an already admitted primary write still drains. An interrupted turn is not automatically retried on restart.

## Persistence and local backup

The existing life storage shares identity, persona memory and long-term memory across Sessions without merging their contexts. Memory records keep source-event references, kind, attribution and optional embedding caches. Endpoint, model and dimensions identify each embedding space. New and updated vectors persist; historical or incompatible caches are rebuilt lazily during search. Search currently scans a bounded local vector collection, rather than an external vector database.

Every primary snapshot commit also writes an owner-private local JSON backup using a temporary file, file synchronization and atomic replacement. `backupPath` overrides the default `${leasePath}.backup.json`; use a separate local directory if the primary storage is remote. The file contains the complete life state, memory text, evidence and vector caches. It is a current-state backup, not a version archive; deleting a memory replaces its backup copy too. Include both primary storage and this file in your own recovery policy.

A backup failure can occur after the primary commit. Genesis stops dependent state operations and reports the uncertain result; inspect both copies before restart. If primary state is absent while a backup exists, Genesis refuses to create a replacement life. Stop writers, preserve both copies and verify the backup with `stateSchema` before restoring its `states/life` record through the configured Storage Domain backend. The standalone backup is not a complete Storage Domain file and must not simply replace `genesis.json`. Unknown or corrupt primary state is never silently replaced.

## Verification and limits

The keyless Loader integration exercises separate model roles, semantic synonym retrieval, restart continuity, Session isolation, local backups and rejected evidence/vector responses. Live provider calls require deployment credentials and have not been exercised by these fixtures. Full-snapshot storage retains the existing capacity limits; memory inferences are not verified facts. For persistent tool learning and the first-start account/naming flow, see [first awakening](awakening.md). Emotion and autonomous wake scheduling remain unimplemented.
