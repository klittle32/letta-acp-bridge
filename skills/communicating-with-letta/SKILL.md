---
name: communicating-with-letta
description: Communicates with a persistent Letta agent through the bundled ACPX wrapper. Use when a user asks to message, tell, ask, or continue an exchange with Johnny5 or another configured Letta agent from a coding harness.
---

# Communicating with Letta

Use `scripts/letta-message` rather than raw `acpx`, `letta -p`, or direct
adapter commands. Run it from the current working directory; that directory is
the conversation scope, so follow-ups from the same workspace continue the
same Letta conversation.

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
