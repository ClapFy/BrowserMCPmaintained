import assert from "node:assert/strict";
import net from "node:net";
import { describe, it } from "node:test";
import { WebSocket } from "ws";

import { BridgeClient } from "../src/bridge/client.js";
import { startBridgeDaemon } from "../src/bridge/daemon.js";
import { encodeBridgeMessage } from "../src/bridge/protocol.js";
import { mcpConfig } from "../src/config/mcp.config.js";
import { MESSAGE_RESPONSE_TYPE } from "../src/messaging/ws/types.js";
import { ensureBridgeToken, tokensMatch } from "../src/security/token.js";
import {
  assertAllowedPort,
  assertSafeNavigationUrl,
} from "../src/security/validation.js";
import { NavigateTool } from "../src/types/mcp/tool.js";
import { killProcessOnPort } from "../src/utils/port.js";

function randomPort(): number {
  return 20_000 + Math.floor(Math.random() * 10_000);
}

describe("security validation", () => {
  it("allows http and https URLs", () => {
    assert.doesNotThrow(() => assertSafeNavigationUrl("https://example.com/path"));
    assert.doesNotThrow(() => assertSafeNavigationUrl("http://localhost:3000"));
  });

  it("blocks dangerous URL protocols", () => {
    assert.throws(
      () => assertSafeNavigationUrl("javascript:alert(1)"),
      /Blocked URL protocol/,
    );
    assert.throws(() => assertSafeNavigationUrl("file:///etc/passwd"), /Blocked URL protocol/);
    assert.throws(() => assertSafeNavigationUrl("data:text/html,hello"), /Blocked URL protocol/);
  });

  it("rejects invalid ports", () => {
    assert.throws(() => assertAllowedPort(0), /Invalid port/);
    assert.throws(() => assertAllowedPort(99_999), /Invalid port/);
  });

  it("NavigateTool rejects javascript URLs", () => {
    assert.throws(
      () => NavigateTool.shape.arguments.parse({ url: "javascript:alert(1)" }),
      /Blocked URL protocol/,
    );
  });

  it("compares tokens in constant time", () => {
    assert.equal(tokensMatch("secret-token", "secret-token"), true);
    assert.equal(tokensMatch("secret-token", "secret-tokex"), false);
    assert.equal(tokensMatch("short", "longer-value"), false);
  });
});

describe("bridge authentication", () => {
  it("requires a valid token on the control channel", async () => {
    const wsPort = randomPort();
    const controlPort = randomPort();
    const token = await ensureBridgeToken();
    const daemon = await startBridgeDaemon(wsPort, controlPort);

    const wss = new WebSocket(`ws://127.0.0.1:${wsPort}`);
    await new Promise<void>((resolve, reject) => {
      wss.once("open", () => resolve());
      wss.once("error", reject);
    });

    wss.on("message", (raw) => {
      const request = JSON.parse(raw.toString()) as { id: string };
      wss.send(
        JSON.stringify({
          type: MESSAGE_RESPONSE_TYPE,
          payload: { requestId: request.id, result: "ok" },
        }),
      );
    });

    try {
      const client = await BridgeClient.connect(controlPort);
      const result = await client.sendSocketMessage("browser_wait", { time: 0.01 });
      assert.equal(result, "ok");
      await client.close();

      await assert.rejects(
        () =>
          new Promise<void>((resolve, reject) => {
            const socket = net.createConnection({ host: "127.0.0.1", port: controlPort });
            socket.once("connect", () => {
              socket.write(encodeBridgeMessage({ kind: "auth", token: "wrong-token" }));
            });
            socket.on("data", (chunk) => {
              const payload = JSON.parse(chunk.toString()) as { ok?: boolean };
              if (payload.ok === false) {
                socket.destroy();
                reject(new Error("auth rejected"));
              } else {
                resolve();
              }
            });
            socket.once("error", reject);
          }),
        /auth rejected/,
      );

      assert.equal(token.length >= 16, true);
    } finally {
      wss.close();
      await daemon.close();
    }
  });
});

describe("port utilities", () => {
  it("refuses to kill processes on arbitrary ports", () => {
    assert.throws(() => killProcessOnPort(randomPort()), /Refusing to kill processes/);
  });
});
