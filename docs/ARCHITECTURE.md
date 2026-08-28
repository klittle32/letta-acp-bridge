# Architecture

## Roles

| Component | Role |
| --- | --- |
| Calling harness | Sends messages and uses the replies in its own work. |
| Portable skill | Teaches the harness the bridge's small command surface and supplies its canonical installation scope. |
| Package CLI | Owns profiles, explicit skill installation, conversation mapping, and ACPX invocation. |
| ACPX | Headless ACP client that creates/resumes a local session and streams structured results. |
| `letta-acp` | ACP server adapter exposing a stateful Letta agent. |
| Letta agent | Persistent identity, memory, and conversation state. |

## Boundary

```text
calling harness
  └── portable skill
        └── letta-acp-bridge CLI
              └── acpx [resolved profile session]
                    └── letta-acp
                          └── Letta agent identity
```

The package CLI resolves user and project profile configuration into the Letta
target and adapter environment. Calling harnesses should not invoke raw
`acpx --agent ...` or reconstruct adapter startup themselves.

The npm package pins ACPX and `letta-acp` and resolves their JavaScript entry
points from its own dependency graph. Runtime fallback through `npx`, PATH
discovery, or implicit package downloads is intentionally absent. Custom ACP
server commands remain an explicit profile option.

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
optional name)`. The CLI supplies an internal name made from the visible profile
name and a short fingerprint of the resolved profile. Calls through an installed
skill append a short fingerprint of that skill's canonical target. A changed
same-name override therefore creates a new conversation instead of resuming one
bound to a different target.

The skill target is intentionally meaningful. Its thin wrapper resolves
symlinks before passing the target to the package CLI. Harnesses that invoke one
canonical skill target share a conversation for the same cwd and profile;
separate copied skill directories create separate conversations. This permits
either shared cross-harness continuity or harness-level isolation without a
second routing system.

## Wrapper contract

The wrapper supports an ordinary message exchange:

```text
letta-acp-bridge message [--verbose] [--profile <name>] <message>
```

It:

1. resolve the named/default user and project profile;
2. ensure the intended session exists;
3. send the message and return only the final reply by default;
4. expose ACPX lifecycle output when `--verbose` is requested; and
5. fail clearly when the exchange cannot be completed.

The important boundary is that callers use the wrapper rather than rebuilding
the ACPX and Letta configuration themselves.

## Installation boundary

Global package installation installs executable code and pinned dependencies
only. Profile creation and skill placement are separate explicit commands.
`skill install` requires a target, refuses an existing target by default, and
writes only beneath the requested path. There is no postinstall mutation,
harness-directory scanning, telemetry owned by this package, shell-profile
editing, or background service.

## Protocol boundary

ACP is a local client-to-agent-runtime protocol, usually over stdio. It is useful for standardizing session lifecycle, prompts, streamed updates, cancellations, workspace capabilities, and approvals.

It is not itself an agent-to-agent routing network, a multi-user collaboration plane, or a remote session-discovery protocol. Those are outside this project's scope.
