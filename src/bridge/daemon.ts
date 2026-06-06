import net from "node:net";

import { WebSocket, WebSocketServer } from "ws";

import { mcpConfig } from "@/config/mcp.config";
import { MESSAGE_RESPONSE_TYPE } from "@/messaging/ws/types";
import type { SocketMessageRequest, SocketMessageResponse } from "@/messaging/ws/types";
import { ensureBridgeToken, tokensMatch } from "@/security/token";
import { assertAllowedPort } from "@/security/validation";

import {
  encodeBridgeMessage,
  parseBridgeEnvelope,
  parseBridgeMessages,
  type BridgeForwardResponse,
} from "./protocol";

export async function startBridgeDaemon(
  wsPort: number = mcpConfig.defaultWsPort,
  controlPort: number = mcpConfig.bridgeControlPort,
): Promise<{ close: () => Promise<void> }> {
  assertAllowedPort(wsPort);
  assertAllowedPort(controlPort);

  const bridgeToken = await ensureBridgeToken();
  let extensionSocket: WebSocket | undefined;
  const controlSockets = new Set<net.Socket>();
  const requestControlSocket = new Map<string, net.Socket>();
  const controlBuffers = new Map<net.Socket, string>();
  const keepaliveTimers = new Map<WebSocket, ReturnType<typeof setInterval>>();

  const wss = new WebSocketServer({ port: wsPort, host: "127.0.0.1" });
  await new Promise<void>((resolve, reject) => {
    wss.once("listening", () => resolve());
    wss.once("error", reject);
  });

  const controlServer = net.createServer((socket) => {
    controlSockets.add(socket);
    controlBuffers.set(socket, "");
    let authenticated = false;

    const authTimeout = setTimeout(() => {
      socket.destroy();
    }, mcpConfig.bridgeAuthTimeoutMs);

    const rejectAuth = (error: string) => {
      clearTimeout(authTimeout);
      socket.write(
        encodeBridgeMessage({
          kind: "auth",
          ok: false,
          error,
        }),
      );
      socket.destroy();
    };

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      let controlBuffer = controlBuffers.get(socket) ?? "";
      controlBuffer += chunk.toString();
      const { messages, remainder, overflow } = parseBridgeMessages(controlBuffer);
      controlBuffers.set(socket, remainder);

      if (overflow) {
        controlBuffers.set(socket, "");
        socket.destroy();
        return;
      }

      for (const raw of messages) {
        const parsed = parseBridgeEnvelope(raw);
        if (!parsed || parsed.kind !== "auth" && parsed.kind !== "request" && parsed.kind !== "response") {
          continue;
        }

        if (!authenticated) {
          if (parsed.kind !== "auth" || !parsed.token) {
            rejectAuth(mcpConfig.errors.bridgeAuthFailed);
            return;
          }
          if (!tokensMatch(bridgeToken, parsed.token)) {
            rejectAuth(mcpConfig.errors.bridgeAuthFailed);
            return;
          }
          authenticated = true;
          clearTimeout(authTimeout);
          socket.write(encodeBridgeMessage({ kind: "auth", ok: true }));
          continue;
        }

        if (parsed.kind !== "request" || !parsed.message) {
          continue;
        }

        if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
          sendBridgeResponse(socket, {
            requestId: parsed.message.id,
            error: mcpConfig.errors.noConnectedTab,
          });
          continue;
        }
        requestControlSocket.set(parsed.message.id, socket);
        extensionSocket.send(JSON.stringify(parsed.message));
      }
    });

    socket.on("close", () => {
      clearTimeout(authTimeout);
      controlSockets.delete(socket);
      controlBuffers.delete(socket);
      for (const [requestId, owner] of requestControlSocket.entries()) {
        if (owner === socket) {
          requestControlSocket.delete(requestId);
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    controlServer.once("listening", () => resolve());
    controlServer.once("error", reject);
    controlServer.listen(controlPort, "127.0.0.1");
  });

  wss.on("connection", (websocket) => {
    if (extensionSocket && extensionSocket !== websocket) {
      const previousTimer = keepaliveTimers.get(extensionSocket);
      if (previousTimer) {
        clearInterval(previousTimer);
        keepaliveTimers.delete(extensionSocket);
      }
      extensionSocket.removeAllListeners();
      extensionSocket.terminate();
    }

    extensionSocket = websocket;

    websocket.on("message", (raw) => {
      let message: SocketMessageResponse<unknown>;
      try {
        message = JSON.parse(raw.toString()) as SocketMessageResponse<unknown>;
      } catch {
        return;
      }
      if (message.type !== MESSAGE_RESPONSE_TYPE) {
        return;
      }
      const requestId = message.payload.requestId;
      const controlSocket = requestControlSocket.get(requestId);
      if (!controlSocket || controlSocket.destroyed) {
        return;
      }
      requestControlSocket.delete(requestId);
      sendBridgeResponse(controlSocket, message.payload);
    });

    websocket.on("close", () => {
      const timer = keepaliveTimers.get(websocket);
      if (timer) {
        clearInterval(timer);
        keepaliveTimers.delete(websocket);
      }
      if (extensionSocket === websocket) {
        extensionSocket = undefined;
      }
    });

    websocket.on("pong", () => {
      websocket.isAlive = true;
    });

    websocket.isAlive = true;
    const timer = setInterval(() => {
      if (websocket.readyState !== WebSocket.OPEN) {
        clearInterval(timer);
        keepaliveTimers.delete(websocket);
        return;
      }
      if (websocket.isAlive === false) {
        clearInterval(timer);
        keepaliveTimers.delete(websocket);
        websocket.terminate();
        return;
      }
      websocket.isAlive = false;
      websocket.ping();
    }, mcpConfig.keepaliveMs);
    keepaliveTimers.set(websocket, timer);
  });

  return {
    close: async () => {
      for (const timer of keepaliveTimers.values()) {
        clearInterval(timer);
      }
      keepaliveTimers.clear();
      for (const socket of controlSockets) {
        socket.destroy();
      }
      controlSockets.clear();
      requestControlSocket.clear();
      controlBuffers.clear();
      await new Promise<void>((resolve) => controlServer.close(() => resolve()));
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}

function sendBridgeResponse(socket: net.Socket, payload: BridgeForwardResponse) {
  socket.write(
    encodeBridgeMessage({
      kind: "response",
      payload,
    }),
  );
}

declare module "ws" {
  interface WebSocket {
    isAlive?: boolean;
  }
}
