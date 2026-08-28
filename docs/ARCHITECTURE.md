# Architecture

## Roles

| Component | Role |
| --- | --- |
| Calling harness | Sends messages and uses the replies in its own work. |
| Portable skill | Teaches the harness the bridge's small command surface. |
| Bridge wrapper | Reads the configured target and adapter environment, then owns conversation mapping and ACPX invocation. |
| ACPX | Headless ACP client that creates/resumes a local session and streams structured results. |
| `letta-acp` | ACP server adapter exposing a stateful Letta agent. |
| Letta agent | Persistent identity, memory, and conversation state. |

## Boundary

```text
calling harness
  └── portable skill
        └── bridge wrapper
              └── acpx [resolved profile session]
                    └── letta-acp
                          └── Letta agent identity
```

The wrapper resolves user and project profile configuration into the Letta
target and adapter environment. Calling harnesses should not invoke raw
`acpx --agent ...` or reconstruct adapter startup themselves.

User profiles come from `$XDG_CONFIG_HOME/letta-acp-bridge/config.json` (or the
`~/.config` fallback). Project profiles come from
`<git-root>/.letta-acp-bridge/config.json`. Project-only names extend the user
map; a same-name project profile replaces the complete user profile object.

## Identity and continuity

Three identifiers serve different purposes:

```text
calling-work context (workspace, project, task, or branch)
  → ACPX session scope / Letta conversation
    → durable Letta agent identity and memory
```

- The **Letta agent identity** provides persona and durable memory.
- An **ACP session** maps to a specific Letta conversation and carries its working transcript.
- The **calling-work context** decides which session is appropriate.

ACPX's persisted-session scope is based on `(agent command, absolute cwd,
optional name)`. The wrapper supplies an internal name made from the visible
profile name and a short fingerprint of the resolved profile. A changed
same-name override therefore creates a new conversation instead of resuming one
bound to a different target.

## Wrapper contract

The wrapper supports an ordinary message exchange:

```text
letta-message [--profile <name>] <message>
```

It:

1. resolve the named/default user and project profile;
2. ensure the intended session exists;
3. send the message and return the final reply cleanly; and
4. fail clearly when the exchange cannot be completed.

The important boundary is that callers use the wrapper rather than rebuilding
the ACPX and Letta configuration themselves.

## Protocol boundary

ACP is a local client-to-agent-runtime protocol, usually over stdio. It is useful for standardizing session lifecycle, prompts, streamed updates, cancellations, workspace capabilities, and approvals.

It is not itself an agent-to-agent routing network, a multi-user collaboration plane, or a remote session-discovery protocol. Those are outside this project's scope.
