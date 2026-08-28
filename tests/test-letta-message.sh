#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
scripts="$root/skills/communicating-with-letta/scripts"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

if env -u LETTA_AGENT_ID ACPX_BIN=/bin/true \
  "$scripts/letta-message" test 2>"$tmp/missing-agent"; then
  printf 'expected missing LETTA_AGENT_ID to fail\n' >&2
  exit 1
fi
grep -F 'LETTA_AGENT_ID' "$tmp/missing-agent" >/dev/null

cat >"$tmp/acpx" <<'EOF'
#!/bin/sh
set -eu
count=0
[ ! -f "$ACPX_TEST_DIR/count" ] || count=$(cat "$ACPX_TEST_DIR/count")
count=$((count + 1))
printf '%s\n' "$count" >"$ACPX_TEST_DIR/count"
printf '%s\n' "$@" >"$ACPX_TEST_DIR/args.$count"
[ "$count" -eq 1 ] || cat >"$ACPX_TEST_DIR/stdin.$count"
EOF
chmod +x "$tmp/acpx"

ACPX_TEST_DIR=$tmp ACPX_BIN=$tmp/acpx LETTA_AGENT_ID=agent-test \
  "$scripts/letta-message" 'hello from a harness'

grep -Fx -- 'sessions' "$tmp/args.1" >/dev/null
grep -Fx -- 'ensure' "$tmp/args.1" >/dev/null
grep -Fx -- "$scripts/letta-acp-server" "$tmp/args.1" >/dev/null
grep -Fx -- "$PWD" "$tmp/args.1" >/dev/null
grep -Fx -- '--file' "$tmp/args.2" >/dev/null
grep -Fx -- '-' "$tmp/args.2" >/dev/null
grep -Fx -- 'hello from a harness' "$tmp/stdin.2" >/dev/null

cat >"$tmp/custom-server" <<'EOF'
#!/bin/sh
printf 'custom:%s:%s:%s\n' "$LETTA_AGENT_ID" "$LETTA_ACP_BACKEND" "$LETTA_ACP_PERMISSION_MODE"
EOF
chmod +x "$tmp/custom-server"

server_output=$(env -u LETTA_ACP_BACKEND -u LETTA_ACP_PERMISSION_MODE \
  LETTA_AGENT_ID=agent-test LETTA_ACP_SERVER_COMMAND="$tmp/custom-server" \
  "$scripts/letta-acp-server")
[ "$server_output" = 'custom:agent-test:cloud-oauth:standard' ]

cat >"$tmp/npx" <<'EOF'
#!/bin/sh
printf 'npx:%s:%s:%s:%s\n' "$1" "$2" "$LETTA_ACP_BACKEND" "$LETTA_ACP_PERMISSION_MODE"
EOF
chmod +x "$tmp/npx"

fallback_output=$(env -u LETTA_ACP_BACKEND -u LETTA_ACP_PERMISSION_MODE \
  -u LETTA_ACP_SERVER_COMMAND -u LETTA_ACP_SERVER_ARGS \
  PATH="$tmp:/usr/bin:/bin" LETTA_AGENT_ID=agent-test \
  "$scripts/letta-acp-server")
[ "$fallback_output" = 'npx:-y:@letta-ai/letta-acp:cloud-oauth:standard' ]

printf 'ok\n'
