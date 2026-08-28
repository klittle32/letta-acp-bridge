# Pilot

## Objective

Verify that independent coding harnesses can start and continue a conversation
with a configured persistent Letta agent without knowing the raw ACPX or
`letta-acp` mechanics.

## Preconditions

- Node.js 22.19 or newer is available.
- The packed or published `letta-acp-bridge` package is installed globally.
- Letta is authenticated for the selected backend.
- The target persistent Letta agent ID is known.
- The `communicating-with-letta` skill is available to each calling harness.

## Automated checks

From the repository root:

```bash
npm test
```

These checks cover:

- primary CLI dispatch and compatibility entry points;
- user and project profile resolution;
- whole-object project overrides;
- user and project setup scopes;
- profile fingerprint changes after an override;
- ACPX session selection and message forwarding;
- clean ordinary output and explicit verbose output;
- explicit skill targets, overwrite refusal, and forced replacement;
- package-local ACPX resolution without `npx`;
- custom server argv preservation; and
- safe adapter defaults.

## Live pilot

1. Create a profile with `letta-acp-bridge profile add`.
2. Install the skill to an explicit harness target.
3. From one coding harness, use the skill to send a message containing a unique
   marker.
4. Send a follow-up and confirm the same Letta conversation recalls the marker.
5. From another harness using the same physical skill target in the same
   workspace, ask for the marker without repeating it.
6. Add a same-name project override and confirm the internal fingerprint and
   Letta conversation change.

## Cross-harness discovery verification

Verified on 2026-08-28 with Codex CLI 0.150.1 and Grok 1.0.8:

```bash
letta-acp-bridge skill install \
  --target "$HOME/.agents/skills/communicating-with-letta"
```

- `grok inspect --json` reported the skill as a user skill at the exact
  canonical `SKILL.md` path, and explicit `$communicating-with-letta`
  invocation loaded that path.
- A clean temporary installation of `@openai/codex@0.150.1` explicitly invoked
  `$communicating-with-letta` and loaded the same canonical `SKILL.md` path.
- The package test suite verifies that two harness-specific symlinks to one
  canonical target both pass the same resolved skill path to the bridge.

These checks prove the current Codex and Grok user-scoped discovery pattern on
macOS. They do not imply support in an untested harness or older release.

## Exit criteria

The pilot succeeds when:

- both harnesses use the same portable procedure;
- same-command, same-workspace, same-profile follow-ups continue one Letta
  conversation;
- a changed resolved profile cannot resume the old target's conversation; and
- no credentials are written to profile configuration.

The packaged implementation pins ACPX 0.13.2. Registry publication remains a
separate release step.
