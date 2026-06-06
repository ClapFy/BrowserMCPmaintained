import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebSocket } from "ws";

import { BridgeClient } from "@/bridge/client";
import { ensureBridgeDaemon } from "@/bridge/ensure";
import { Context } from "@/context";
import type { Resource } from "@/resources/resource";
import type { Tool } from "@/tools/tool";
import { createWebSocketServer } from "@/ws";

import { mcpConfig } from "@/config/mcp.config";

type Options = {
  name: string;
  version: string;
  tools: Tool[];
  resources: Resource[];
  /** WebSocket listen port (defaults to mcp config). */
  wsPort?: number;
  /** Use persistent bridge daemon instead of embedded WebSocket server. */
  useBridge?: boolean;
};

export async function createServerWithTools(options: Options): Promise<Server> {
  const { name, version, tools, resources, wsPort, useBridge = true } = options;
  const context = new Context();
  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  let wss: Awaited<ReturnType<typeof createWebSocketServer>> | undefined;

  if (useBridge) {
    await ensureBridgeDaemon();
    context.bridge = await BridgeClient.connect();
  } else {
    wss = await createWebSocketServer(wsPort);
    wss.on("connection", (websocket) => {
      attachExtensionSocket(context, websocket);
    });
  }

  const toolByName = new Map(tools.map((tool) => [tool.schema.name, tool]));
  const resourceByUri = new Map(resources.map((resource) => [resource.schema.uri, resource]));

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map((tool) => tool.schema) };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resources.map((resource) => resource.schema) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolByName.get(request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Tool "${request.params.name}" not found` },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handle(context, request.params.arguments);
      return result;
    } catch (error) {
      return {
        content: [{ type: "text", text: String(error) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = resourceByUri.get(request.params.uri);
    if (!resource) {
      return { contents: [] };
    }

    const contents = await resource.read(context, request.params.uri);
    return { contents };
  });

  const closeServer = server.close.bind(server);
  server.close = async () => {
    if (wss) {
      await new Promise<void>((resolve) => wss!.close(() => resolve()));
    }
    await context.close();
    await closeServer();
  };

  return server;
}

function attachExtensionSocket(context: Context, websocket: WebSocket) {
  if (context.hasWs()) {
    const previous = context.ws;
    previous.removeAllListeners();
    previous.close();
  }
  context.ws = websocket;

  websocket.on("close", () => {
    if (context.hasWs() && context.ws === websocket) {
      context.clearWs();
    }
  });

  websocket.on("pong", () => {
    websocket.isAlive = true;
  });

  websocket.isAlive = true;
  const timer = setInterval(() => {
    if (websocket.readyState !== WebSocket.OPEN) {
      clearInterval(timer);
      return;
    }
    if (websocket.isAlive === false) {
      clearInterval(timer);
      websocket.terminate();
      return;
    }
    websocket.isAlive = false;
    websocket.ping();
  }, mcpConfig.keepaliveMs);
}

declare module "ws" {
  interface WebSocket {
    isAlive?: boolean;
  }
}
