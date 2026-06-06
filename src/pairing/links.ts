import type { McpServerEntry } from "./types";
import { SERVER_NAME } from "./types";

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createCursorInstallLink(serverConfig: McpServerEntry): string {
  const config = encodeBase64Url(JSON.stringify(serverConfig));
  const name = encodeURIComponent(SERVER_NAME);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${config}`;
}

export function createVsCodeInstallLink(serverConfig: McpServerEntry): string {
  const payload = JSON.stringify({
    name: SERVER_NAME,
    type: "stdio",
    ...serverConfig,
  });
  return `vscode://mcp/install?${encodeURIComponent(payload)}`;
}

export function createInstallLinks(serverConfig: McpServerEntry): {
  cursor: string;
  vscode: string;
} {
  return {
    cursor: createCursorInstallLink(serverConfig),
    vscode: createVsCodeInstallLink(serverConfig),
  };
}
