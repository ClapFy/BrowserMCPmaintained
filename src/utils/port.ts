import { execSync } from "node:child_process";
import net from "node:net";

import { mcpConfig } from "@/config/mcp.config";
import { assertAllowedPort } from "@/security/validation";

const ALLOWED_KILL_PORTS: ReadonlySet<number> = new Set([
  mcpConfig.defaultWsPort,
  mcpConfig.bridgeControlPort,
]);

export async function isPortInUse(
  port: number,
  host = "127.0.0.1",
): Promise<boolean> {
  assertAllowedPort(port);

  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

export function killProcessOnPort(port: number): void {
  assertAllowedPort(port);

  if (!ALLOWED_KILL_PORTS.has(port)) {
    throw new Error(`Refusing to kill processes on port ${port}`);
  }

  try {
    if (process.platform === "win32") {
      execSync(
        `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`,
        { stdio: "ignore" },
      );
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
        shell: "/bin/sh",
        stdio: "ignore",
      });
    }
  } catch {
    // No process on port — expected when the port is already free.
  }
}
