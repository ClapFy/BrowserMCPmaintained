import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";

import { appConfig } from "@/config/app.config";

import type { Resource } from "@/resources/resource";
import { createServerWithTools } from "@/server";
import * as common from "@/tools/common";
import * as custom from "@/tools/custom";
import * as snapshot from "@/tools/snapshot";
import type { Tool } from "@/tools/tool";

import { pairMcpClients } from "@/pairing/pair";
import type { McpClientId } from "@/pairing/types";

import packageJSON from "../package.json";

function setupExitWatchdog(server: Server) {
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

const commonTools: Tool[] = [common.pressKey, common.wait];

const customTools: Tool[] = [custom.getConsoleLogs, custom.screenshot];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  ...commonTools,
  ...customTools,
];

const resources: Resource[] = [];

async function createServer(): Promise<Server> {
  return createServerWithTools({
    name: appConfig.name,
    version: packageJSON.version,
    tools: snapshotTools,
    resources,
  });
}

const MCP_CLIENT_IDS = ["cursor", "claude", "windsurf", "vscode"] as const;

function parseClientIds(value: string): McpClientId[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is McpClientId =>
      (MCP_CLIENT_IDS as readonly string[]).includes(part),
    );
}

/**
 * Note: Tools must be defined *before* calling `createServer` because only declarations are hoisted, not the initializations
 */
program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .command("pair")
  .alias("setup")
  .description("Install Browser MCP in your editor with one-click pairing links")
  .option("--local", "Use the local build instead of npx @browsermcp/mcp")
  .option("--clients <ids>", "Comma-separated clients: cursor,claude,windsurf,vscode")
  .option("--open [client]", "Open a one-click install link (cursor, vscode, or all)")
  .option("--skip-daemon", "Do not start the bridge daemon")
  .action(async (options: {
    local?: boolean;
    clients?: string;
    open?: boolean | string;
    skipDaemon?: boolean;
  }) => {
    let open: McpClientId | "all" | undefined;
    if (options.open === true) {
      open = "cursor";
    } else if (typeof options.open === "string") {
      open = options.open === "all" ? "all" : (options.open as McpClientId);
    }

    await pairMcpClients({
      local: options.local,
      clients: options.clients ? parseClientIds(options.clients) : undefined,
      open,
      skipDaemon: options.skipDaemon,
    });
  });

program.action(async () => {
  const server = await createServer();
  setupExitWatchdog(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
});
program.parse(process.argv);
