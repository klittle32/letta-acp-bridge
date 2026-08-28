---
name: communicating-with-letta
description: Communicates with a configured persistent Letta agent through the bundled ACPX wrapper. Use when a user asks to message, tell, ask, or continue an exchange with a Letta agent from a coding harness.
---

# Communicating with Letta

Use `scripts/letta-message` rather than raw `acpx`, `letta -p`, or direct
adapter commands. Run it from the current working directory. ACPX resumes a
conversation when the physical bridge command path, working directory, and
profile-derived session name match. A shared skill target therefore supports
cross-harness continuity, while separate copied skills remain isolated.

## Configure a profile

When the user asks to configure a Letta agent, run:

```bash
<skill-directory>/scripts/setup-letta-profile
```

The command prompts for user or project scope, profile name, agent ID, and
optional adapter settings. For noninteractive setup, pass at least `--scope`,
`--name`, and `--agent-id`; run it with `--help` for all flags.

User configuration lives under `$XDG_CONFIG_HOME/letta-acp-bridge/` or
`~/.config/letta-acp-bridge/`. Project configuration lives at
`<git-root>/.letta-acp-bridge/config.json`. A project profile replaces a
same-name user profile as a complete object. Never put credentials in either
file.

Do not silently run setup during an ordinary message attempt. If a profile is
missing, return the setup command from the error.

## Communicate

Send a short message as an argument:

```bash
<skill-directory>/scripts/letta-message --profile <name> 'message text'
```

Omit `--profile` when a default profile is configured. The resolved profile
name and fingerprint select the ACPX session, so changed project overrides do
not resume a conversation created for another Letta target.

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

On success, ordinary stdout contains only the Letta agent's reply; failures
remain visible on stderr. When transport details are needed for diagnosis, add
`--verbose` to the same command rather than reconstructing the ACPX invocation.
