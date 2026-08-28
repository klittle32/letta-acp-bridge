# Architecture

## Roles

| Component | Role |
| --- | --- |
| Calling harness | Sends messages and uses the replies in its own work. |
| Portable skill | Teaches the harness the bridge's small command surface. |
| Bridge wrapper | Owns the configured target, adapter environment, conversation mapping, and ACPX invocation. |
| ACPX | Headless ACP client that creates/resumes a local session and streams structured results. |
| `letta-acp` | ACP server adapter exposing a stateful Letta agent. |
| Letta agent | Persistent identity, memory, and conversation state. |

## Boundary

```text
calling harness
  └── portable skill
        └── bridge wrapper
              └── acpx johnny5 [session policy]
                    └── letta-acp
                          └── Letta agent identity
```

The wrapper is intentionally the only component that knows the Letta target and adapter setup. Calling harnesses should not invoke raw `acpx --agent ...`, edit ACPX configuration, or reconstruct `LETTA_AGENT_ID` and authentication behavior.

## Identity and continuity

Three identifiers serve different purposes:

```text
calling-work context (workspace, Buzz channel, task, or branch)
  → ACPX session scope / Letta conversation
    → durable Letta agent identity and memory
```

- The **Letta agent identity** provides persona and durable memory.
- An **ACP session** maps to a specific Letta conversation and carries its working transcript.
- The **calling-work context** decides which session is appropriate.

ACPX's default persisted-session scope is based on `(agent command, absolute cwd, optional name)`. The wrapper must make any exception explicit rather than accidentally sharing or fragmenting conversations.

## Initial wrapper contract

The first wrapper should support only an ordinary message exchange:

```text
letta-message [--session <name>] <message>
```

It should:

1. use a stable configured ACPX agent alias;
2. ensure the intended session exists;
3. send the message and return the final reply cleanly; and
4. fail clearly when the exchange cannot be completed.

The exact command name may change during implementation. The important boundary is that callers use the wrapper rather than rebuilding the ACPX and Letta configuration themselves.

## Protocol boundary

ACP is a local client-to-agent-runtime protocol, usually over stdio. It is useful for standardizing session lifecycle, prompts, streamed updates, cancellations, workspace capabilities, and approvals.

It is not itself an agent-to-agent routing network, a multi-user collaboration plane, or a remote session-discovery protocol. Those are outside this project's scope.
