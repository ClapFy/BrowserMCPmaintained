import { WebSocketServer } from "ws";

import { mcpConfig } from "@/config/mcp.config";
import { isPortInUse } from "@/utils/port";
import { wait } from "@/utils/wait";

const PORT_WAIT_INTERVAL_MS = 100;
const PORT_WAIT_MAX_ATTEMPTS = 50;

export async function createWebSocketServer(
  port: number = mcpConfig.defaultWsPort,
): Promise<WebSocketServer> {
  for (let attempt = 0; attempt < PORT_WAIT_MAX_ATTEMPTS; attempt++) {
    if (!(await isPortInUse(port))) {
      break;
    }
    if (attempt === PORT_WAIT_MAX_ATTEMPTS - 1) {
      throw new Error(
        `Port ${port} is still in use after ${(PORT_WAIT_MAX_ATTEMPTS * PORT_WAIT_INTERVAL_MS) / 1000}s`,
      );
    }
    await wait(PORT_WAIT_INTERVAL_MS);
  }

  const wss = new WebSocketServer({ port, host: "127.0.0.1" });
  await new Promise<void>((resolve, reject) => {
    wss.once("listening", () => resolve());
    wss.once("error", reject);
  });
  return wss;
}
