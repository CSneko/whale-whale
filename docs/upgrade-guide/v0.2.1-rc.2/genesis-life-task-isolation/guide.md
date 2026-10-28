---
kind: upgrade-guide
description: "Ordinary presets no longer participate in the configured Genesis Life lifecycle."
---

# Separate Life from ordinary workspace tasks

English | [中文](guide.zh.md)

## Change

When `awakening.lifePreset` is set, only that preset receives Genesis tools and context or contributes to life memory, emotion, interests and capability history. Standard, PTC, Minimal and Creator no longer share those features. The per-reply memory action is hidden outside Life, and the Host rejects ordinary-session memory generation. Life remains the workspace Web default. Foundation-only compositions and awakening without a preset restriction retain their all-Session behavior.

## Migration

1. Keep the Life overlay's `awakening.lifePreset: life` and existing life storage. Continue character conversations in Life mode; new Life sessions share the original identity and memory.
2. Start new ordinary sessions for isolated work. Previously logged life prompts, memory and observations are preserved; existing ordinary history is not scrubbed or rewritten.
3. Teach Life `genesis_tasks` through `learn` to assign ordinary work. Use an explicit registered workspace and non-Life mode, and keep one request id for retries. Check real status/results through `inspect` or open the target workspace session. See [workspace tasks](../../../genesis/tasks.md) for dependencies, permissions and interrupted-work behavior.
