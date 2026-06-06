import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { mcpConfig } from "@/config/mcp.config";
import { isPortInUse, killProcessOnPort } from "@/utils/port";

import { BridgeClient } from "./client";

async function canConnectBridge(): Promise<boolean> {
  try {
    const client = await BridgeClient.connect(mcpConfig.bridgeControlPort, 1_000);
    await client.close();
    return true;
  } catch {
    return false;
  }
}

async function restartStaleBridge(): Promise<void> {
  if (await isPortInUse(mcpConfig.bridgeControlPort)) {
    killProcessOnPort(mcpConfig.bridgeControlPort);
  }
  if (await isPortInUse(mcpConfig.defaultWsPort)) {
    killProcessOnPort(mcpConfig.defaultWsPort);
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export async function ensureBridgeDaemon(): Promise<void> {
  if (await canConnectBridge()) {
    return;
  }

  if (
    (await isPortInUse(mcpConfig.bridgeControlPort)) ||
    (await isPortInUse(mcpConfig.defaultWsPort))
  ) {
    await restartStaleBridge();
  }

  const daemonEntry = fileURLToPath(new URL("../ws-daemon.js", import.meta.url));
  const child = spawn(process.execPath, [daemonEntry], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      BROWSERMCP_DAEMON: "1",
    },
  });
  child.unref();

  for (let attempt = 0; attempt < 30; attempt++) {
    if (await canConnectBridge()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (await isPortInUse(mcpConfig.defaultWsPort)) {
    throw new Error(
      `Browser MCP WebSocket port ${mcpConfig.defaultWsPort} is in use but bridge control port ${mcpConfig.bridgeControlPort} is unavailable. Stop stale browsermcp processes or run: node ${daemonEntry}`,
    );
  }

  throw new Error(
    `Failed to start Browser MCP bridge daemon on port ${mcpConfig.bridgeControlPort}`,
  );
}
