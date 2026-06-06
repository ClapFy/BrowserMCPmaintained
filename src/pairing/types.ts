export const SERVER_NAME = "browsermcp" as const;

export type McpServerEntry = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type McpConfigFile = {
  mcpServers: Record<string, McpServerEntry>;
};

export type McpClientId = "cursor" | "claude" | "windsurf" | "vscode";

export type McpClientTarget = {
  id: McpClientId;
  label: string;
  configPath: string;
};

export type PairOptions = {
  clients?: McpClientId[];
  local?: boolean;
  open?: McpClientId | "all";
  skipDaemon?: boolean;
};

export type PairResult = {
  serverConfig: McpServerEntry;
  installed: McpClientTarget[];
  skipped: McpClientTarget[];
  links: {
    cursor?: string;
    vscode?: string;
  };
  daemonStarted: boolean;
};
