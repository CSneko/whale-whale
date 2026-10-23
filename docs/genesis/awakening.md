# Genesis first awakening

English | [中文](awakening.zh.md)

This tutorial starts the optional single-character experience on the existing Web profile. It requires the [memory pipeline](memory.md), a configured embedding endpoint and the Genesis browser companion. Foundation-only deployments retain their existing behavior.

## Configure and start

Keep one dedicated absolute `DSH_HOME` for this project across launches and profiles. Its `genesis` Storage Domain owns one life; unrelated Sessions do not create additional lives. Do not alternate homes or storage roots when continuing the same life, and do not run two writers against it.

Configure `GENESIS_EMBEDDING_URL` (including `/embeddings`), `GENESIS_EMBEDDING_MODEL`, `GENESIS_EMBEDDING_DIMENSIONS` and the secret `GENESIS_EMBEDDING_API_KEY` in your local launch environment. These are the same embedding settings as the memory overlay. For a keyless local embedding server, remove `embeddingKeyEnv` in your own patch. Build the workspace using the [run instructions](README.md), then launch:

```sh
pnpm dsh web --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/genesis/cordis.life.patch.yml --patch packages/experimental/client-ui-genesis/cordis.patch.yml
```

Use the existing Models/API configuration or account sign-in screen first. The supplied overlay uses `deepseek-official` / `deepseek-v4-flash` for chat and independent memory calls. `GENESIS_CHAT_PROVIDER` and `GENESIS_CHAT_MODEL` select a different registered route; `GENESIS_DECISION_PROVIDER`, `GENESIS_DECISION_MODEL`, `GENESIS_WRITER_PROVIDER` and `GENESIS_WRITER_MODEL` override the auxiliary routes independently. All three routes must prepare successfully before naming. Provider configuration and login remain owned by the existing Harness services; Genesis stores no account credential.

After configuration, the naming dialog asks for her name. Saving checks the embedding endpoint with one small probe, then names the already reserved identity. A failed check retains the form for retry. The dialog can return to Models settings; General → Genesis provides the same naming form and a refresh action when you are ready to retry. Storage or backup errors can follow a committed write: inspect both copies before retrying. A conflicting second initialization refuses to rename or replace the life.

## Meet her

The dialog closes after naming. Send your first real message in the conversation composer: introduce yourself, describe your preferences and talk to her. The built-in prompt portrays a curious, innocent, warm young female character without inventing personal knowledge or shared experiences. Existing memories remain intact when enabling awakening on an existing life. The same base persona and selected non-declarative memories accompany later Sessions; the character does not restart as a newborn on each conversation.

An independent reviewer runs after the reply and decides whether information is worth retaining. A separate writer validates sources and stores memories and embeddings with the local backup. The conversation model cannot promise that an unreviewed introduction is already saved. Use General → Genesis to inspect the resulting memory previews after refreshing. See [memory](memory.md) for costs, bounded inputs, errors and recovery.

## Teach a tool

The only initial model-visible tool is `learn`, presented as 学习. Its sole argument is one exact tool name; its description supplies no inventory, enumeration or examples. Tell her a name explicitly, for example: “请学习 genesis_recall，以后需要回忆时可以使用它。” After successful learning, that tool's schema joins the next request. Learning one tool does not unlock any other tool.

Learning is shared across Sessions and restarts. A removed or scope-restricted tool remains learned but cannot run until available again. Unknown names produce a refusal without revealing alternatives. A monotonic executor guard denies unlearned tools even when a caller forges a name or bypasses prompt assembly; independent sandbox and approval policy still apply after learning. Learning does not install plugins or grant permissions.

## Context and recovery

Short-term context belongs only to the current Session. Starting an unrelated Session shares the life ID, name, learned tools and long-term memories, but never copies old messages, tool results or auxiliary memory-call logs. Declarative knowledge requires a learned search tool and embedding-backed recall; only the bounded non-declarative layer enters automatic context. Resuming the same Session intentionally resumes that Session's own context.

Awakening selects a complete character prompt, replacing the default coding-assistant sections and optional runtime contexts that could disclose unlearned tool names. Native tool presentation is required; PTC compositions fail visibly. The normal Session prompt/tool logging and execution policies remain active. The current layer does not provide autonomous goals, emotion or unsolicited wake scheduling.

The identity is reserved durably when the plugin starts; naming marks its first awakening. Birth time and life ID never change during naming. First-conversation and learning events are durable, idempotent life facts, separate from conversational context. Removing the life overlay disables this behavior without deleting the life; keep the same storage, backup and lease when restoring it. Do not delete identity data to repeat the naming flow.
