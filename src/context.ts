import { WebSocket } from "ws";

import { BridgeClient } from "@/bridge/client";
import { mcpConfig } from "@/config/mcp.config";
import type {
  MessagePayload,
  MessageResult,
  MessageType,
} from "@/messaging/types";
import { createSocketMessageSender } from "@/messaging/ws/sender";
import type { SocketMessageMap } from "@/types/messages/ws";

const noConnectionMessage = `No connection to browser extension. In order to proceed, you must first connect a tab by clicking the Browser MCP extension icon in the browser toolbar and clicking the 'Connect' button.`;

export class Context {
  private _ws: WebSocket | undefined;
  private _bridge: BridgeClient | undefined;

  get ws(): WebSocket {
    if (!this._ws) {
      throw new Error(noConnectionMessage);
    }
    return this._ws;
  }

  set ws(ws: WebSocket) {
    this._ws = ws;
  }

  set bridge(bridge: BridgeClient) {
    this._bridge = bridge;
  }

  hasWs(): boolean {
    return !!this._ws;
  }

  usesBridge(): boolean {
    return !!this._bridge;
  }

  clearWs(): void {
    this._ws = undefined;
  }

  async sendSocketMessage<T extends MessageType<SocketMessageMap>>(
    type: T,
    payload: MessagePayload<SocketMessageMap, T>,
    options: { timeoutMs?: number } = { timeoutMs: mcpConfig.defaultRequestTimeoutMs },
  ): Promise<MessageResult<SocketMessageMap, T>> {
    try {
      if (this._bridge) {
        if (!this._bridge.connected) {
          await this._bridge.close().catch(() => undefined);
          this._bridge = await BridgeClient.connect();
        }
        return (await this._bridge.sendSocketMessage(
          type,
          payload,
          options,
        )) as MessageResult<SocketMessageMap, T>;
      }

      const { sendSocketMessage } = createSocketMessageSender(this.ws);
      return await sendSocketMessage<
        MessagePayload<SocketMessageMap, T>,
        MessageResult<SocketMessageMap, T>
      >(type, payload, options);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === mcpConfig.errors.noConnectedTab) {
          throw new Error(noConnectionMessage);
        }
        if (e.message === mcpConfig.errors.bridgeDisconnected) {
          throw new Error(noConnectionMessage);
        }
        if (e.message === "WebSocket is not open") {
          throw new Error(noConnectionMessage);
        }
      }
      throw e;
    }
  }

  async close() {
    if (this._bridge) {
      await this._bridge.close();
      this._bridge = undefined;
    }
    if (!this._ws) {
      return;
    }
    const ws = this._ws;
    this._ws = undefined;
    ws.removeAllListeners();
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }
  }
}
