import os from "node:os";
import path from "node:path";

import type { McpClientId, McpClientTarget } from "./types";

function homePath(...segments: string[]): string {
  return path.join(os.homedir(), ...segments);
}

const ALL_CLIENTS: McpClientTarget[] = [
  {
    id: "cursor",
    label: "Cursor",
    configPath: homePath(".cursor", "mcp.json"),
  },
  {
    id: "claude",
    label: "Claude Desktop",
    configPath:
      process.platform === "darwin"
        ? homePath("Library", "Application Support", "Claude", "claude_desktop_config.json")
        : process.platform === "win32"
          ? homePath("AppData", "Roaming", "Claude", "claude_desktop_config.json")
          : homePath(".config", "Claude", "claude_desktop_config.json"),
  },
  {
    id: "windsurf",
    label: "Windsurf",
    configPath: homePath(".codeium", "windsurf", "mcp_config.json"),
  },
  {
    id: "vscode",
    label: "VS Code",
    configPath: homePath(".vscode", "mcp.json"),
  },
];

export function listMcpClients(): McpClientTarget[] {
  return ALL_CLIENTS;
}

export function getMcpClient(id: McpClientId): McpClientTarget | undefined {
  return ALL_CLIENTS.find((client) => client.id === id);
}

export function resolveClientTargets(ids?: McpClientId[]): McpClientTarget[] {
  if (!ids?.length) {
    return ALL_CLIENTS;
  }

  return ids.flatMap((id) => {
    const client = getMcpClient(id);
    return client ? [client] : [];
  });
}
