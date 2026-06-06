# Browser MCP stability fix (0.2.1)

## Problem

Cursor restarts the MCP server process often. The old server called `killProcessOnPort(9009)` on every start, which killed the WebSocket the browser extension was connected to. That caused random `Not connected` errors.

## Fix

1. **Persistent bridge daemon** (`dist/ws-daemon.js`) keeps the extension WebSocket alive on port `9009`.
2. **MCP control channel** on port `9010` lets Cursor reconnect without dropping the browser tab.
3. **WebSocket ping keepalive** every 25s prevents idle disconnects.
4. **No port killing** on startup.
5. **Bridge token auth** on the control channel (`~/.browsermcp/bridge.token`, mode `0600`) blocks other local processes from driving your browser.
6. **Input validation** blocks `javascript:`, `file:`, and `data:` navigation URLs and caps wait/text payload sizes.

The MCP server auto-starts the daemon if it is not already running.

## One-click pairing

Install Browser MCP in your editor and get Cursor / VS Code deeplinks:

```bash
npx @browsermcp/mcp pair --open cursor
```

Or from a local build:

```bash
node dist/index.js pair --open cursor
```

This writes `browsermcp` to `~/.cursor/mcp.json` (and other supported clients), starts the bridge daemon, and prints one-click install links.

After pairing: **Cursor Settings → MCP → restart browsermcp**.

The MCP server auto-restarts a stale bridge daemon if the control port is occupied but authentication fails (for example after upgrading to token auth).

Then in Chrome: open the Browser MCP extension → **Connect** on your Cloudflare tab.

## Manual daemon (optional)

```bash
node /Users/misha/nocursor/browsermcp/mcp/dist/ws-daemon.js
```

Ports: extension `9009`, MCP bridge `9010`.
