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

This project is currently a design-and-pilot effort. It will establish:

- a stable wrapper for communicating with one configured Letta agent;
- a small portable skill for coding harnesses;
- predictable conversation continuation; and
- a small pilot across a few coding harnesses.

See [Architecture](docs/ARCHITECTURE.md) and the [Pilot plan](docs/PILOT.md).

## Non-goals

- Replacing Letta Code, ACPX, or an existing coding harness.
- Building an A2A network, delegation or orchestration framework, general collaboration bus, or plugin ecosystem.
- Prescribing interaction roles. Communication through the bridge is neutral.
- Requiring Letta agents to initiate new traffic back into coding harnesses.

## Status

The manual ACPX-to-Johnny5 path and conversation continuation are proven. The
working launch now lives behind
`skills/communicating-with-letta/scripts/letta-message`, with the portable skill
beside it. Grok Build and OMP both used the skill successfully, including a
cross-harness follow-up in the same Letta conversation.
