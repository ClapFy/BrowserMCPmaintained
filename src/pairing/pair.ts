import { ensureBridgeDaemon } from "@/bridge/ensure";

import { resolveClientTargets } from "./clients";
import { installServerConfig } from "./install";
import { createInstallLinks } from "./links";
import { openInstallLink } from "./open-link";
import { resolveServerConfig } from "./server-config";
import type { McpClientId, PairOptions, PairResult } from "./types";

function log(message: string): void {
  console.log(message);
}

function logStep(title: string, body: string): void {
  log(`\n${title}`);
  log(body);
}

export async function pairMcpClients(options: PairOptions = {}): Promise<PairResult> {
  const serverConfig = resolveServerConfig({ local: options.local });
  const targets = resolveClientTargets(options.clients);
  const links = createInstallLinks(serverConfig);

  const installed: PairResult["installed"] = [];
  const skipped: PairResult["skipped"] = [];

  for (const client of targets) {
    const { updated } = installServerConfig(client, serverConfig);
    if (updated) {
      installed.push(client);
    } else {
      skipped.push(client);
    }
  }

  let daemonStarted = false;
  if (!options.skipDaemon) {
    try {
      await ensureBridgeDaemon();
      daemonStarted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logStep("Bridge daemon", `Could not start automatically: ${message}`);
    }
  }

  log("Browser MCP pairing complete.\n");

  if (installed.length) {
    logStep(
      "Installed MCP config",
      installed.map((client) => `- ${client.label}: ${client.configPath}`).join("\n"),
    );
  }

  if (skipped.length) {
    logStep(
      "Already configured or skipped",
      skipped.map((client) => `- ${client.label}`).join("\n"),
    );
  }

  logStep("One-click install links", [
    `Cursor: ${links.cursor}`,
    `VS Code: ${links.vscode}`,
  ].join("\n"));

  if (daemonStarted) {
    logStep("Bridge daemon", "Running on ports 9009 (extension) and 9010 (MCP).");
  }

  logStep(
    "Next steps",
    [
      "1. Restart MCP in your editor (Cursor: Settings → MCP → restart browsermcp).",
      "2. Open the Browser MCP Chrome extension and click Connect on your tab.",
      "3. Or use a one-click link above to install in Cursor / VS Code.",
    ].join("\n"),
  );

  if (options.open) {
    const clientsToOpen: McpClientId[] =
      options.open === "all" ? ["cursor", "vscode"] : [options.open];

    for (const clientId of clientsToOpen) {
      const link = clientId === "vscode" ? links.vscode : links.cursor;
      try {
        await openInstallLink(link);
        log(`\nOpened ${clientId} install link.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`\nCould not open ${clientId} install link: ${message}`);
        log(link);
      }
    }
  }

  return {
    serverConfig,
    installed,
    skipped,
    links,
    daemonStarted,
  };
}
