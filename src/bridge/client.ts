import net from "node:net";

import { mcpConfig } from "@/config/mcp.config";
import type { SocketMessageRequest } from "@/messaging/ws/types";
import { readBridgeToken } from "@/security/token";
import { generateRequestId } from "@/utils/id";

import {
  encodeBridgeMessage,
  parseBridgeEnvelope,
  parseBridgeMessages,
  type BridgeForwardResponse,
} from "./protocol";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
};

export class BridgeClient {
  private socket: net.Socket;
  private buffer = "";
  private pending = new Map<string, PendingRequest>();
  private closed = false;

  private constructor(socket: net.Socket) {
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("close", () => this.rejectAll(new Error(mcpConfig.errors.bridgeDisconnected)));
    socket.on("error", (error) =>
      this.rejectAll(error instanceof Error ? error : new Error(String(error))),
    );
  }

  static async connect(
    port: number = mcpConfig.bridgeControlPort,
    timeoutMs: number = mcpConfig.bridgeConnectTimeoutMs,
  ): Promise<BridgeClient> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const connection = net.createConnection({ host: "127.0.0.1", port });
      const timeoutId = setTimeout(() => {
        connection.destroy();
        reject(new Error(`Browser MCP bridge not reachable on port ${port}`));
      }, timeoutMs);

      connection.once("connect", () => {
        clearTimeout(timeoutId);
        resolve(connection);
      });
      connection.once("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    const client = new BridgeClient(socket);
    await client.authenticate();
    client.attachDataListener();
    return client;
  }

  get connected(): boolean {
    return !this.closed && !this.socket.destroyed;
  }

  async sendSocketMessage<TPayload, TResult>(
    type: string,
    payload: TPayload,
    options: { timeoutMs?: number } = { timeoutMs: mcpConfig.defaultRequestTimeoutMs },
  ): Promise<TResult> {
    if (!this.connected) {
      throw new Error(mcpConfig.errors.bridgeDisconnected);
    }
    if (this.pending.size >= mcpConfig.maxPendingBridgeRequests) {
      throw new Error(mcpConfig.errors.tooManyPendingRequests);
    }

    const id = generateRequestId();
    const message: SocketMessageRequest<TPayload> = { id, type, payload };
    const { timeoutMs } = options;

    return new Promise((resolve, reject) => {
      const timeoutId =
        timeoutMs && timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              reject(new Error(`Bridge response timeout after ${timeoutMs}ms`));
            }, timeoutMs)
          : undefined;

      this.pending.set(id, {
        resolve: (value) => resolve(value as TResult),
        reject,
        timeoutId,
      });

      this.socket.write(encodeBridgeMessage({ kind: "request", message }));
    });
  }

  private attachDataListener() {
    this.socket.on("data", (chunk: string | Buffer) =>
      this.onData(typeof chunk === "string" ? chunk : chunk.toString("utf8")),
    );
  }

  private async authenticate(): Promise<void> {
    const token = await readBridgeToken();
    this.socket.write(encodeBridgeMessage({ kind: "auth", token }));

    await new Promise<void>((resolve, reject) => {
      const authTimeout = setTimeout(() => {
        cleanup();
        reject(new Error(mcpConfig.errors.bridgeAuthTimeout));
      }, mcpConfig.bridgeAuthTimeoutMs);

      const onData = (chunk: string | Buffer) => {
        this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        const { messages, remainder, overflow } = parseBridgeMessages(this.buffer);
        this.buffer = remainder;

        if (overflow) {
          cleanup();
          reject(new Error(mcpConfig.errors.bridgeAuthFailed));
          return;
        }

        for (const raw of messages) {
          const parsed = parseBridgeEnvelope(raw);
          if (!parsed || parsed.kind !== "auth") {
            continue;
          }
          cleanup();
          if (parsed.ok) {
            resolve();
          } else {
            reject(new Error(parsed.error ?? mcpConfig.errors.bridgeAuthFailed));
          }
          return;
        }
      };

      const cleanup = () => {
        clearTimeout(authTimeout);
        this.socket.off("data", onData);
      };

      this.socket.on("data", onData);
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    const { messages, remainder, overflow } = parseBridgeMessages(this.buffer);
    this.buffer = remainder;

    if (overflow) {
      this.buffer = "";
      this.rejectAll(new Error("Bridge message buffer overflow"));
      this.socket.destroy();
      return;
    }

    for (const raw of messages) {
      const parsed = parseBridgeEnvelope(raw);
      if (!parsed || parsed.kind !== "response" || !parsed.payload) {
        continue;
      }
      const { requestId, result, error } = parsed.payload;
      const pending = this.pending.get(requestId);
      if (!pending) {
        continue;
      }
      this.pending.delete(requestId);
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    }
  }

  private rejectAll(error: Error) {
    this.closed = true;
    for (const pending of this.pending.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(error);
    }
    this.pending.clear();
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.socket.removeAllListeners();
    this.socket.destroy();
    this.rejectAll(new Error("Bridge client closed"));
  }
}
