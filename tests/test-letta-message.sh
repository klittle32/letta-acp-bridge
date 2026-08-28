#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
scripts="$root/skills/communicating-with-letta/scripts"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

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

ACPX_TEST_DIR=$tmp ACPX_BIN=$tmp/acpx \
  "$scripts/letta-message" 'hello from a harness'

grep -Fx -- 'sessions' "$tmp/args.1" >/dev/null
grep -Fx -- 'ensure' "$tmp/args.1" >/dev/null
grep -Fx -- "$scripts/johnny5-acp" "$tmp/args.1" >/dev/null
grep -Fx -- "$PWD" "$tmp/args.1" >/dev/null
grep -Fx -- '--file' "$tmp/args.2" >/dev/null
grep -Fx -- '-' "$tmp/args.2" >/dev/null
grep -Fx -- 'hello from a harness' "$tmp/stdin.2" >/dev/null

printf 'ok\n'
