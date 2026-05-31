import { WebSocket } from "ws";

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

  get ws(): WebSocket {
    if (!this._ws) {
      throw new Error(noConnectionMessage);
    }
    return this._ws;
  }

  set ws(ws: WebSocket) {
    this._ws = ws;
  }

  hasWs(): boolean {
    return !!this._ws;
  }

  clearWs(): void {
    this._ws = undefined;
  }

  async sendSocketMessage<T extends MessageType<SocketMessageMap>>(
    type: T,
    payload: MessagePayload<SocketMessageMap, T>,
    options: { timeoutMs?: number } = { timeoutMs: 30_000 },
  ): Promise<MessageResult<SocketMessageMap, T>> {
    const { sendSocketMessage } = createSocketMessageSender(this.ws);
    try {
      return await sendSocketMessage<
        MessagePayload<SocketMessageMap, T>,
        MessageResult<SocketMessageMap, T>
      >(type, payload, options);
    } catch (e) {
      if (e instanceof Error && e.message === mcpConfig.errors.noConnectedTab) {
        throw new Error(noConnectionMessage);
      }
      throw e;
    }
  }

  async close() {
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
