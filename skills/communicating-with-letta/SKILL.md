---
name: communicating-with-letta
description: Communicates with a configured persistent Letta agent through the bundled ACPX wrapper. Use when a user asks to message, tell, ask, or continue an exchange with a Letta agent from a coding harness.
---

# Communicating with Letta

Use `scripts/letta-message` rather than raw `acpx`, `letta -p`, or direct
adapter commands. Run it from the current working directory; that directory is
the conversation scope, so follow-ups from the same workspace continue the
same Letta conversation.

The environment must provide `LETTA_AGENT_ID`. Optional settings are
`LETTA_ACP_BACKEND` (default `cloud-oauth`), `LETTA_ACP_PERMISSION_MODE`
(default `standard`), and `LETTA_ACP_SERVER_COMMAND` for a custom executable
that launches `letta-acp`. Supply simple whitespace-delimited arguments through
`LETTA_ACP_SERVER_ARGS`. Without that override, the wrapper uses an installed
`letta-acp` or falls back to `npx -y @letta-ai/letta-acp`.

Send a short message as an argument:

```bash
<skill-directory>/scripts/letta-message 'message text'
```

For multiline content, pipe it through stdin:

```bash
cat <<'EOF' | <skill-directory>/scripts/letta-message
message text
with additional context
EOF
```

Return the Letta agent's reply accurately. If the command fails, report its
error instead of switching to another invocation method or starting a new
session manually.
