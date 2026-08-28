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

## Install

The package requires Node.js 22.19 or newer and supports global installation
through npm, Bun, or pnpm:

```bash
npm install --global letta-acp-bridge
# or: bun add --global letta-acp-bridge
# or: pnpm add --global letta-acp-bridge
```

ACPX and `letta-acp` are pinned package dependencies. Ordinary message calls
resolve those installed dependencies directly and never invoke `npx` or perform
an implicit download.

Install the bundled harness skill only to an explicit target:

```bash
letta-acp-bridge skill install \
  --target .grok/skills/communicating-with-letta
```

An existing target is refused unless `--force` is supplied. The command does
not scan harness directories. To inspect the package's canonical skill source
for a deliberate symlink-based installation, run:

```bash
letta-acp-bridge skill path
```

Package installation itself does not write profiles, install skills, edit shell
configuration, start services, or modify harness directories. Package upgrades
do not rewrite previously installed skill copies.

## Configure

Create a named profile:

```bash
letta-acp-bridge profile add \
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
and the adapter is the package-pinned `letta-acp`. Configure a custom launcher
when needed:

```bash
letta-acp-bridge profile add \
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
letta-acp-bridge message \
  --profile my-agent \
  'message text'
```

Omit `--profile` to use the resolved project or user default. On success,
ordinary stdout contains only the Letta agent's reply. Add `--verbose` to show
ACPX lifecycle, thinking, and completion output when diagnosing an exchange;
failures remain visible on stderr.

ACPX identifies a persisted conversation by the resolved package server
command, absolute working directory, and profile-derived session name. Calls
through an installed skill also include the skill's canonical target in that
session name. Harnesses using one canonical skill directory (directly or
through symlinks) therefore share a conversation for the same project and
profile. Separate copied installations remain isolated. Shared conversations
may interleave concurrent messages.

The package also installs the previous `letta-message` and
`setup-letta-profile` command names as compatibility entry points. New
documentation uses `letta-acp-bridge`. Existing copied skills are not changed by
package installation or upgrades; once a copied skill is explicitly replaced
with the packaged version, it expects `letta-acp-bridge` on `PATH`.

## Non-goals

- Replacing Letta Code, ACPX, or an existing coding harness.
- Building an A2A network, delegation or orchestration framework, general collaboration bus, or plugin ecosystem.
- Prescribing interaction roles. Communication through the bridge is neutral.
- Requiring Letta agents to initiate new traffic back into coding harnesses.

## Status

The npm CLI, explicit skill installer, portable skill, interactive/noninteractive
profile setup, layered user/project configuration, clean message output, and
fingerprinted session continuation are implemented. Publication to the npm
registry is a separate release step.
