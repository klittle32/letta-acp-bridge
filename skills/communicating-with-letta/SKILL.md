---
name: communicating-with-letta
description: Communicates with a configured persistent Letta agent through the bundled ACPX wrapper. Use when a user asks to message, tell, ask, or continue an exchange with a Letta agent from a coding harness.
---

# Communicating with Letta

Use `<skill-directory>/scripts/letta-message` rather than raw `acpx`, `npx`,
`letta -p`, or direct adapter commands. The thin script calls the installed
package's shared JavaScript message implementation directly and supplies this
skill's canonical target path. It does not invoke an npm command shim. Run it
from the current working directory. A shared skill target therefore supports
cross-harness continuity for the same working directory and resolved profile,
while separate copied skills remain isolated. Concurrent calls to one shared
conversation may interleave, so do not send them concurrently when order
matters.

## Configure a profile

When the user asks to configure a Letta agent, run the package CLI:

```bash
letta-acp-bridge profile add
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

Treat each configured profile name as the human-facing alias for its Letta
recipient. Do not hard-code agent names. Do not query Letta to rediscover the
agent for each message.

When the request names a recipient, resolve it from the current working
directory before sending:

```bash
letta-acp-bridge profile list
```

Match the requested name to the listed profile names case-insensitively when
exactly one configured profile matches. Preserve the configured spelling and
send with `--profile <configured-name>`:

```bash
<skill-directory>/scripts/letta-message \
  --profile <configured-name> \
  'message text'
```

A generic request such as “ask my Letta agent” should use the configured default
by omitting `--profile`:

```bash
<skill-directory>/scripts/letta-message 'message text'
```

If a named recipient is missing or ambiguous, surface that result and the
configured profile names instead of guessing. If a generic request has no
default, surface the configuration error. Do not silently run setup during an
ordinary message attempt.

The resolved profile name and fingerprint select the ACPX session, so changed
project overrides do not resume a conversation created for another Letta
target.

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

The message script imports the installed package implementation directly and
does not require the `letta-acp-bridge` command shim on `PATH`. If a separate
profile-list or setup command is unavailable, report that the package CLI is
not on `PATH`. Do not replace it with `npx` or download another copy implicitly.

If ACPX reports that it cannot prepare `~/.acpx/queues` or another path under
`~/.acpx` because of `EPERM`, the restricted harness is blocking ACPX's queue
and session state. Ask the user to approve or configure read/write access to
`~/.acpx`, then retry the exact same wrapper command. Do not bypass the wrapper,
construct a raw ACPX command, or relocate ACPX state.
