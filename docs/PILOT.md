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
