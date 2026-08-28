# Pilot

## Objective

Verify that independent coding harnesses can start and continue a conversation
with a configured persistent Letta agent without knowing the raw ACPX or
`letta-acp` mechanics.

## Preconditions

- Node.js is available.
- Letta is authenticated for the selected backend.
- The target persistent Letta agent ID is known.
- The `communicating-with-letta` skill is installed in each calling harness.

## Automated checks

From the repository root:

```bash
node --test tests/profile-config.test.mjs
```

These checks cover:

- user and project profile resolution;
- whole-object project overrides;
- user and project setup scopes;
- profile fingerprint changes after an override;
- ACPX session selection and message forwarding;
- custom server argv preservation; and
- safe adapter defaults.

## Live pilot

1. Create a profile with `<skill-directory>/scripts/setup-letta-profile`.
2. From one coding harness, use the skill to send a message containing a unique
   marker.
3. Send a follow-up and confirm the same Letta conversation recalls the marker.
4. From another harness in the same workspace, ask for the marker without
   repeating it.
5. Add a same-name project override and confirm the internal fingerprint and
   Letta conversation change.

## Exit criteria

The pilot succeeds when:

- both harnesses use the same portable procedure;
- same-workspace, same-profile follow-ups continue one Letta conversation;
- a changed resolved profile cannot resume the old target's conversation; and
- no credentials are written to profile configuration.

The initial implementation has met these criteria with ACPX 0.13.1.
