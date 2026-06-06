import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { McpClientTarget, McpConfigFile, McpServerEntry } from "./types";
import { SERVER_NAME } from "./types";

function readConfigFile(configPath: string): McpConfigFile {
  if (!existsSync(configPath)) {
    return { mcpServers: {} };
  }

  const raw = readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return { mcpServers: {} };
  }

  const parsed = JSON.parse(raw) as Partial<McpConfigFile>;
  return {
    mcpServers: parsed.mcpServers ?? {},
  };
}

function writeConfigFile(configPath: string, config: McpConfigFile): void {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function entriesMatch(existing: McpServerEntry, next: McpServerEntry): boolean {
  return (
    existing.command === next.command &&
    existing.args.length === next.args.length &&
    existing.args.every((arg, index) => arg === next.args[index]) &&
    JSON.stringify(existing.env ?? {}) === JSON.stringify(next.env ?? {})
  );
}

export function installServerConfig(
  client: McpClientTarget,
  serverConfig: McpServerEntry,
): { updated: boolean } {
  const config = readConfigFile(client.configPath);
  const existing = config.mcpServers[SERVER_NAME];

  if (existing && entriesMatch(existing, serverConfig)) {
    return { updated: false };
  }

  config.mcpServers[SERVER_NAME] = serverConfig;
  writeConfigFile(client.configPath, config);
  return { updated: true };
}
