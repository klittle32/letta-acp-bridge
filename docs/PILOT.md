# Pilot plan

## Objective

Verify that a coding harness can start and continue a conversation with one persistent Letta agent through the bridge without learning the raw ACPX or `letta-acp` mechanics.

## Preconditions

- ACPX is installed.
- `letta-acp` is installed and authenticated for the intended Letta backend.
- The wrapper identifies the target Letta agent and supported backend configuration.
- A minimal calling-harness skill invokes only that wrapper.

## Pilot

1. From one coding harness, use the skill to send a message.
2. Confirm that the wrapper creates or resumes the expected ACPX session.
3. Send a follow-up and confirm that it reaches the same conversation.
4. Repeat from another representative coding harness.
5. Fix only the problems that appear in those real exchanges.

## Exit criteria

The pilot succeeds when both harnesses can start and continue a conversation with the selected persistent Letta agent through the same portable procedure.

## Walking skeleton

Proven locally on 2026-08-28 with ACPX 0.13.1 and the same Johnny5
`cloud-oauth` launcher used by Buzz:

```bash
npx -y acpx johnny5 sessions new --name bridge-pilot
npx -y acpx johnny5 -s bridge-pilot '<message>'
npx -y acpx johnny5 -s bridge-pilot '<follow-up>'
```

Both messages used Letta conversation
`conv-51279776-7f67-4105-ac40-cb50234b133d`. The follow-up correctly recalled a
marker supplied only in the first message, proving conversation continuation.

The bundled wrapper was then proven with a second two-message exchange:

```bash
skills/communicating-with-letta/scripts/letta-message '<message>'
skills/communicating-with-letta/scripts/letta-message '<follow-up>'
```

Both calls used conversation `conv-02c448ee-f9a2-479d-a0f6-db45ffe66d1d`, and
the follow-up recalled a marker supplied only in the first call.

The portable skill then passed the two-harness pilot from the same workspace:

- Grok Build used the skill to send a marker to Johnny5.
- OMP independently loaded the skill and asked Johnny5 to recall that marker
  without including it in the follow-up.

Johnny5 returned `GROK_BRIDGE_OK violet-circuit-83` and then
`OMP_BRIDGE_OK violet-circuit-83`. ACPX history confirms both harness messages
and replies remained in conversation
`conv-02c448ee-f9a2-479d-a0f6-db45ffe66d1d`. The pilot exit criteria are met.
