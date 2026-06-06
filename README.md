# Browser MCP (community fork)

A maintained fork of [Browser MCP](https://github.com/BrowserMCP/mcp), the MCP server and Chrome extension that lets AI tools automate your existing browser.

Upstream development has slowed, so this repository exists to keep the project usable, fix regressions, and ship improvements without waiting on the original maintainers.

## About

Browser MCP connects an MCP server to a Chrome extension so applications like Cursor, VS Code, Claude, and Windsurf can drive the browser you already use: your profile, your logins, your tabs.

This fork keeps that model and focuses on reliability for day-to-day agent workflows.

## Why this fork

- Upstream activity and issue response have been limited for some time.
- Cursor and other clients restart MCP processes frequently; the original server could drop the extension connection on every restart.
- We wanted standalone builds, clearer pairing, and hardening without depending on upstream release cadence.

If upstream becomes active again, we are happy to contribute fixes back. Until then, this repo is the maintained line.

## What is different here

Compared to upstream `0.1.x`, this fork (`0.2.x`) includes:

- **Persistent bridge daemon** — keeps the extension WebSocket alive across MCP restarts.
- **Separate control channel** — the editor reconnects without killing the browser tab connection.
- **No port killing on startup** — avoids random `Not connected` errors.
- **Bridge token auth** — local control traffic requires a token in `~/.browsermcp/bridge.token`.
- **Input validation** — blocks dangerous navigation schemes and caps payload sizes.
- **One-click pairing** — `browsermcp pair` writes client config and starts the daemon.
- **Standalone build** — ships a self-contained `dist/` without fragile monorepo assumptions.

See [README-STABILITY.md](./README-STABILITY.md) for implementation details and pairing steps.

The [`extension/`](../extension/) directory tracks popup UI fixes (for example, disconnecting from any tab). See [extension/README.md](../extension/README.md).

## Features

- **Fast** — automation runs locally; no remote browser latency.
- **Private** — browser activity stays on your machine.
- **Logged in** — uses your existing profile and sessions.
- **Stealth** — uses your real browser fingerprint to reduce basic bot detection.

## Quick start

From a local build:

```bash
npm install
npm run build
node dist/index.js pair --open cursor
```

After pairing, restart the `browsermcp` MCP server in your editor. In Chrome, open the Browser MCP extension and click **Connect** on the tab you want to automate.

Published installs can use:

```bash
npx @browsermcp/mcp pair --open cursor
```

## Development

Requires Node.js 18+.

```bash
npm install
npm run build
npm run typecheck
npm run test
```

Run the MCP inspector:

```bash
npm run inspector
```

## Credits

Browser MCP was created by the [BrowserMCP](https://github.com/BrowserMCP) project and adapted from the [Playwright MCP server](https://github.com/microsoft/playwright-mcp) to automate the user's browser rather than spawning new browser instances.

This fork is maintained independently. Upstream website and docs remain at [browsermcp.io](https://browsermcp.io) and [docs.browsermcp.io](https://docs.browsermcp.io) for reference.

## License

Apache-2.0. See [LICENSE](./LICENSE).
