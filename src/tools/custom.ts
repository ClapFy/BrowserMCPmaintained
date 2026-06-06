import { zodToJsonSchema } from "zod-to-json-schema";

import { mcpConfig } from "@/config/mcp.config";
import { GetConsoleLogsTool, ScreenshotTool } from "@/types/mcp/tool";

import type { Tool } from "./tool";

export const getConsoleLogs: Tool = {
  schema: {
    name: GetConsoleLogsTool.shape.name.value,
    description: GetConsoleLogsTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetConsoleLogsTool.shape.arguments),
  },
  handle: async (context, _params) => {
    const consoleLogs = await context.sendSocketMessage(
      "browser_get_console_logs",
      {},
    );
    const text = consoleLogs
      .slice(0, mcpConfig.limits.maxConsoleLogLines)
      .map((log) => JSON.stringify(log))
      .join("\n");
    return {
      content: [{ type: "text", text }],
    };
  },
};

export const screenshot: Tool = {
  schema: {
    name: ScreenshotTool.shape.name.value,
    description: ScreenshotTool.shape.description.value,
    inputSchema: zodToJsonSchema(ScreenshotTool.shape.arguments),
  },
  handle: async (context, _params) => {
    const imageData = await context.sendSocketMessage(
      "browser_screenshot",
      {},
    );
    return {
      content: [
        {
          type: "image",
          data: imageData,
          mimeType: "image/png",
        },
      ],
    };
  },
};
