# Agent Note: One Genesis character with explicit tool learning

Status: implemented

English | [中文](2026-10-23-genesis-first-awakening.zh.md)

## Problem

A shared life ID alone does not provide a first conversation or distinguish learned tools from the runtime registry. Filtering schemas alone permits forged executor calls, while default coding prompts and capability inventories disclose tools before learning.

## Decision

An optional awakening route requires the independent memory pipeline. The existing life row reserves identity before setup; authenticated naming prepares chat and auxiliary model routes and probes embeddings before committing a name once. Existing API configuration and account login remain the credential owners. The first accepted conversation records one life fact, without retaining its messages in global state.

The character uses a complete prompt and bounded life context rather than the default coding-assistant guidance and optional contexts. Initially only `learn` is presented. Successful learning checks the actual caller-scoped registry, commits one idempotent life/growth event, and exposes that tool on subsequent requests across Sessions. A monotonic tool guard independently refuses unlearned execution, including direct calls. Other authorization policies remain authoritative. Learning records survive removal, but cannot make a missing or scope-restricted tool callable.

## Alternatives considered

**Session-local learning** loses continuity when a user opens a new conversation. Learned tools belong to the life, while availability and conversation context belong to each Session.

**A hidden schema without executor enforcement** allows invented tool calls. A monotonic guard cannot be overridden by an allowing waterfall listener.

**Automatic tool discovery in the prompt** defeats the requested learning experience. The underlying registry remains available to trusted Host code, but its catalogue and coding guidance do not enter the character's initial request. Native presentation avoids the PTC SDK inventory.

## Consequences

The opt-in life overlay and browser companion supply credential-first naming; foundation-only configurations remain loadable. Independent memory review can save introductions even before any recall tool is learned. The shared life persists naming, personality memories and learning, while unrelated Sessions receive no old transcript. Keyless Loader integration covers naming failures, forged execution, memory continuity and restart; a recorded headless Session pins the initial learning schema and character prompt. Live provider authentication and response quality require configured services.
