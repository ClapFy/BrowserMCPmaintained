import { mcpConfig } from "@/config/mcp.config";
import type { SocketMessageRequest, SocketMessageResponse } from "@/messaging/ws/types";

export type BridgeForwardRequest = SocketMessageRequest<unknown>;

export type BridgeForwardResponse = SocketMessageResponse<unknown>["payload"];

export type BridgeAuthMessage = {
  kind: "auth";
  token?: string;
  ok?: boolean;
  error?: string;
};

export type BridgeEnvelope =
  | BridgeAuthMessage
  | { kind: "request"; message: BridgeForwardRequest }
  | { kind: "response"; payload: BridgeForwardResponse };

export function encodeBridgeMessage(message: unknown): string {
  return `${JSON.stringify(message)}\n`;
}

export function parseBridgeMessages(
  buffer: string,
  maxBytes: number = mcpConfig.maxBridgeBufferBytes,
): {
  messages: string[];
  remainder: string;
  overflow: boolean;
} {
  if (Buffer.byteLength(buffer, "utf8") > maxBytes) {
    return { messages: [], remainder: "", overflow: true };
  }

  const parts = buffer.split("\n");
  const remainder = parts.pop() ?? "";
  const messages = parts.filter((line) => line.trim().length > 0);
  return { messages, remainder, overflow: false };
}

export function parseBridgeEnvelope(raw: string): BridgeEnvelope | undefined {
  try {
    return JSON.parse(raw) as BridgeEnvelope;
  } catch {
    return undefined;
  }
}
