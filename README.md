# Letta ACP Bridge

A small, portable bridge that lets coding harnesses communicate with a chosen persistent Letta agent through [ACPX](https://github.com/openclaw/acpx) and [`letta-acp`](https://github.com/letta-ai/letta-acp).

## The problem

Coding harnesses can already reach Letta through commands such as `letta -p`, but each harness must handle the target agent, invocation details, and conversation continuation correctly. Agents often struggle with that procedure.

This project defines a narrow, reusable contract:

```text
portable harness skill
  → stable local wrapper
    → acpx (ACP client)
      → letta-acp (ACP server)
        → selected persistent Letta agent
```

The harness gets a simple way to start and continue an exchange. The Letta agent keeps its identity, memory, tools, and conversation continuity rather than being reduced to a stateless model endpoint.

## Scope

This project provides:

- a stable wrapper for communicating with configured Letta agents;
- a small portable skill for coding harnesses;
- predictable conversation continuation; and
- layered user and project profiles.

See [Architecture](docs/ARCHITECTURE.md) and the [Pilot plan](docs/PILOT.md).

## Configure

The bundled skill uses Node.js executable scripts on macOS, Linux, and WSL.
Install or copy `skills/communicating-with-letta` into the harness's skill
directory, then create a named profile:

```bash
skills/communicating-with-letta/scripts/setup-letta-profile \
  --scope user \
  --name my-agent \
  --agent-id agent-... \
  --default
```

Without flags, the setup command prompts interactively. Use `--scope project`
to write project configuration instead. Configuration layers are:

```text
user:    $XDG_CONFIG_HOME/letta-acp-bridge/config.json
project: <git-root>/.letta-acp-bridge/config.json
```

When `XDG_CONFIG_HOME` is unset, the user path falls back to
`~/.config/letta-acp-bridge/config.json`. Project profiles extend user profiles.
A same-name project profile replaces the complete user profile object, and a
project default overrides the user default.

The default backend is `cloud-oauth`, the default permission mode is `standard`,
and the adapter is an installed `letta-acp` or `npx -y @letta-ai/letta-acp`.
Configure a custom launcher when needed:

```bash
skills/communicating-with-letta/scripts/setup-letta-profile \
  --scope user \
  --name my-agent \
  --agent-id agent-... \
  --server-command /path/to/launcher \
  --server-arg value
```

Server arguments are stored as a JSON array, preserving argument boundaries.
Profiles contain no credentials; authentication remains in Letta's login or
secret storage.

Communicate with a profile:

```bash
skills/communicating-with-letta/scripts/letta-message \
  --profile my-agent \
  'message text'
```

Omit `--profile` to use the resolved project or user default.

## Non-goals

- Replacing Letta Code, ACPX, or an existing coding harness.
- Building an A2A network, delegation or orchestration framework, general collaboration bus, or plugin ecosystem.
- Prescribing interaction roles. Communication through the bridge is neutral.
- Requiring Letta agents to initiate new traffic back into coding harnesses.

## Status

The wrapper, portable skill, interactive/noninteractive profile setup, layered
user/project configuration, and fingerprinted session continuation are
implemented. The same installed skill has successfully started and continued a
shared Letta conversation from multiple coding harnesses.
