# Agent Note: Independent layered memory for one Genesis life

Status: implemented

English | [中文](2026-10-23-genesis-layered-memory.zh.md)

## Problem

Lexical retrieval and automatic injection of selected memories conflate active recollection with prompt-resident habits. Letting the conversation model directly persist its own interpretation also obscures the difference between a user statement and an assistant inference.

## Decision

The optional Genesis memory pipeline uses separately configured decision and writer calls after a reply. It gathers only bounded live committed text from the current Session turn. The independent writer receives retrieved candidate memories, not other Sessions' transcripts, and cites source sequence numbers. Source-role validation prevents assistant evidence from becoming a user-stated memory. The core atomically commits the entire plan with its turn deduplication marker. Ignorable plugin records in the source Session retain auxiliary requests and completed responses without entering conversation history or becoming recovery state.

Declarative memory is retrieved through embedding similarity; a small non-declarative layer enters normal logged prompt context. Embedding-space identifiers include endpoint, model and dimensions. New vectors persist with the memory; incompatible historical vectors are rebuilt during search. Every primary snapshot also replaces an owner-private local backup; a backup failure stops the core because the primary may already have committed.

## Alternatives considered

**Direct conversation-model writes** preserve the earlier manual workflow but cannot provide an independent interpretation. They remain available only when the optional pipeline is absent.

**An external vector database** scales beyond full snapshots but adds a second durable owner and cross-store commit recovery. The bounded local collection uses existing storage and keeps text, evidence and new vectors together; larger-scale indexing requires a separate storage design.

**Typesafe-only decisions** would bind deployment to a classifier route that is not an existing Harness chat adapter. The decision currently uses validated JSON through registered LLM adapters; no Typesafe-specific wire protocol is assumed.

## Consequences

The optional pipeline adds model latency before turn completion, embedding costs on update/search, and a local backup write per state commit. Invalid plans fail atomically and visibly; source observations may already exist, and failed turns are not automatically retried after restart. The older lexical/manual configuration remains loadable. New optional memory fields are backward-readable by this implementation but rejected by older strict readers.
