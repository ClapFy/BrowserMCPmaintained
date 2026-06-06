import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { installServerConfig } from "../src/pairing/install.js";
import { createCursorInstallLink, createVsCodeInstallLink } from "../src/pairing/links.js";
import { resolveServerConfig } from "../src/pairing/server-config.js";
import { SERVER_NAME } from "../src/pairing/types.js";

describe("pairing", () => {
  it("creates a Cursor install deeplink with base64 config", () => {
    const config = {
      command: "npx",
      args: ["-y", "@browsermcp/mcp@0.2.1"],
    };
    const link = createCursorInstallLink(config);

    assert.match(link, /^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?/);
    assert.match(link, /name=browsermcp/);
    assert.match(link, /config=/);

    const configParam = new URL(link.replace("cursor://", "https://")).searchParams.get("config");
    assert.ok(configParam);
    const decoded = JSON.parse(Buffer.from(configParam, "base64url").toString("utf8")) as {
      command: string;
      args: string[];
    };
    assert.deepEqual(decoded, config);
  });

  it("creates a VS Code install deeplink", () => {
    const config = {
      command: "npx",
      args: ["-y", "@browsermcp/mcp@0.2.1"],
    };
    const link = createVsCodeInstallLink(config);

    assert.match(link, /^vscode:\/\/mcp\/install\?/);
    const payload = decodeURIComponent(link.replace("vscode://mcp/install?", ""));
    const parsed = JSON.parse(payload) as {
      name: string;
      type: string;
      command: string;
      args: string[];
    };
    assert.equal(parsed.name, SERVER_NAME);
    assert.equal(parsed.type, "stdio");
    assert.equal(parsed.command, config.command);
    assert.deepEqual(parsed.args, config.args);
  });

  it("merges browsermcp into an existing mcp.json idempotently", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "browsermcp-pair-"));
    const configPath = path.join(dir, "mcp.json");

    const serverConfig = resolveServerConfig({ local: true });

    const first = installServerConfig(
      { id: "cursor", label: "Cursor", configPath },
      serverConfig,
    );
    assert.equal(first.updated, true);

    const written = JSON.parse(readFileSync(configPath, "utf8")) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    assert.ok(written.mcpServers[SERVER_NAME]);
    assert.equal(written.mcpServers[SERVER_NAME].command, serverConfig.command);

    const second = installServerConfig(
      { id: "cursor", label: "Cursor", configPath },
      serverConfig,
    );
    assert.equal(second.updated, false);

    rmSync(dir, { recursive: true, force: true });
  });
});
