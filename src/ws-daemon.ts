import { startBridgeDaemon } from "@/bridge/daemon";
import { mcpConfig } from "@/config/mcp.config";

const wsPort = Number(process.env.BROWSERMCP_WS_PORT ?? mcpConfig.defaultWsPort);
const controlPort = Number(
  process.env.BROWSERMCP_CONTROL_PORT ?? mcpConfig.bridgeControlPort,
);

const daemon = await startBridgeDaemon(wsPort, controlPort);

process.on("SIGINT", async () => {
  await daemon.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await daemon.close();
  process.exit(0);
});
