#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DAEMON="$ROOT/dist/ws-daemon.js"
MCP="$ROOT/dist/index.js"

if ! lsof -iTCP:9010 -sTCP:LISTEN -t >/dev/null 2>&1; then
  nohup node "$DAEMON" >>/tmp/browsermcp-ws-daemon.log 2>&1 &
  for _ in $(seq 1 40); do
    lsof -iTCP:9010 -sTCP:LISTEN -t >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

exec node "$MCP"
