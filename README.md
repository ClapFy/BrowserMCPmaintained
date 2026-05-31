<a href="https://browsermcp.io">
  <img src="./.github/images/banner.png" alt="Browser MCP banner">
</a>

<h3 align="center">Browser MCP</h3>

<p align="center">
  Automate your browser with AI.
  <br />
  <a href="https://browsermcp.io"><strong>Website</strong></a> 
  •
  <a href="https://docs.browsermcp.io"><strong>Docs</strong></a>
</p>

## About

Browser MCP is an MCP server + Chrome extension that allows you to automate your browser using AI applications like VS Code, Claude, Cursor, and Windsurf.

## Features

- Fast: Automation happens locally on your machine, without network latency to remote browsers.
- Private: Browser activity stays on your device.
- Logged In: Uses your existing browser profile and sessions.
- Stealth: Uses your real browser fingerprint to reduce basic bot detection.

## Development

Requires Node.js 18+.

```bash
npm install
npm run build
npm run typecheck
```

Run the MCP inspector:

```bash
npm run inspector
```

## Credits

Browser MCP was adapted from the [Playwright MCP server](https://github.com/microsoft/playwright-mcp) to automate the user's browser rather than spawning new browser instances.
