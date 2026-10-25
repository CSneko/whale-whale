# Genesis interests

English | [中文](interest.zh.md)

## Summary

Genesis can form topic interests from recorded exchanges without an initial list of favored subjects. Interest is an attributed interpretation of behavior, distinct from remembered facts, momentary emotion, tool skill and permission.

## Enable

The workspace life overlay enables `interest: {}` alongside memory and emotion. Other profiles can enable it with the optional interest overlay after the core patch:

```sh
pnpm dsh --profile headless --patch packages/experimental/genesis/cordis.patch.yml --patch packages/experimental/genesis/cordis.interest.patch.yml --dump-config
```

The dump checks composition only. An actual conversation needs configured model routes; the interest reviewer uses the saved independent memory writer route and `memory` input, output, token and timeout limits. Disabling `interest` stops reviews and prompt injection while retaining existing interest records.

## Development from experience

The initial interest inventory is empty. After a completed exchange with a real user message and an assistant reply, one independent writer call may propose up to two topic changes or no change. It sees bounded recent dialogue and tool names with success outcomes; tool arguments and result bodies remain in the Session log. Contact, curiosity, exploration, return and disinterest are separate observations. A single encounter cannot establish a lasting preference.

Exploration requires a cited successful tool result or substantive visible creation in the assistant reply. A lasting preference requires at least `interest.minEnduringTurns` distinct exchanges (default 3), an exploration, and a later self-initiated return. An explicitly prompted topic cannot count as that return. A negative experience may make an interest dormant; silence, shutdown and elapsed time do not. After dormancy, a lasting preference needs new exploration and a later return. The model supplies the topic and attributed reason, while the life core checks current-exchange citations and progression. These checks cannot prove that a model interpreted the dialogue correctly.

Each accepted change persists its old and new stage, reason and source life-event IDs. A no-change review has a durable replay marker. Reviews serialize across Sessions, and restarting restores the same interests. Invalid or missing interest state refuses loading rather than silently replacing the life. The current and historical stages remain model inferences, not verified personal facts.

## Use in conversation

The next model request receives a small, logged `genesis:self` snapshot of active interests; `genesis_self` returns bounded current summaries. The assistant may propose a related inquiry or creation during the active conversation. Actual tool calls still require availability and execution authorization. Interest does not start background work or invent activity between conversations.

“Life information” shows current interests, latest source IDs and bounded change history. Refresh reads the latest state; a failed review keeps the previous interest state and reports a safe diagnostic. `interest.windowTurns`, `interest.maxInterests`, `interest.minEnduringTurns` and `interest.contextChars` are validated deployment limits. Hitting storage or response capacity reports a failure without discarding history.

With [deliberation](motivation.md) enabled, interest review also admits actual assistant or tool outcomes of a recorded autonomous decision; a trigger or plan alone is not an experience. Citations must belong to that decision’s settled outcome. Strength, stability and formation time derive from existing evidence and enter the logged character context with the current state.

## Limitations

The current page is read-only. Topic matching rejects exact case-insensitive duplicates but cannot merge semantic synonyms automatically. A self-initiated return is a model interpretation checked against explicit topic wording in the current user message; paraphrases can still be misclassified. No independent wake schedule or offline exploration is supplied.

## Dev Note

None.
