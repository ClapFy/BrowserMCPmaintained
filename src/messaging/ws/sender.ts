import { WebSocket } from "ws";

import { mcpConfig } from "@/config/mcp.config";
import { generateRequestId } from "@/utils/id";

import {
  MESSAGE_RESPONSE_TYPE,
  type SocketMessageRequest,
  type SocketMessageResponse,
} from "./types";

export function createSocketMessageSender(ws: WebSocket) {
  async function sendSocketMessage<TPayload, TResult>(
    type: string,
    payload: TPayload,
    options: { timeoutMs?: number } = { timeoutMs: mcpConfig.defaultRequestTimeoutMs },
  ): Promise<TResult> {
    const { timeoutMs } = options;
    const id = generateRequestId();
    const message: SocketMessageRequest<TPayload> = { id, type, payload };

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        removeSocketMessageResponseListener();
        ws.removeEventListener("error", errorHandler);
        ws.removeEventListener("close", cleanup);
        clearTimeout(timeoutId);
      };

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`WebSocket response timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      const removeSocketMessageResponseListener = addSocketMessageResponseListener(
        ws,
        (responseMessage: SocketMessageResponse<TResult>) => {
          const { payload: responsePayload } = responseMessage;
          if (responsePayload.requestId !== id) {
            return;
          }
          const { result, error } = responsePayload;
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result as TResult);
          }
          cleanup();
        },
      );

      const errorHandler = () => {
        cleanup();
        reject(new Error("WebSocket error occurred"));
      };

      ws.addEventListener("error", errorHandler);
      ws.addEventListener("close", cleanup);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        cleanup();
        reject(new Error("WebSocket is not open"));
      }
    });
  }

  return { sendSocketMessage };
}

function addSocketMessageResponseListener<TResult>(
  ws: WebSocket,
  typeListener: (message: SocketMessageResponse<TResult>) => void | Promise<void>,
) {
  const listener = async (rawData: WebSocket.RawData) => {
    const message = JSON.parse(
      rawData.toString(),
    ) as SocketMessageResponse<TResult>;
    if (message.type !== MESSAGE_RESPONSE_TYPE) {
      return;
    }
    await typeListener(message);
  };
  ws.on("message", listener);
  return () => ws.off("message", listener);
}

