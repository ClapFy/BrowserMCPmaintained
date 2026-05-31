import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { WebSocket, WebSocketServer } from "ws";

import { Context } from "../src/context.js";
import { mcpConfig } from "../src/config/mcp.config.js";
import { MESSAGE_RESPONSE_TYPE } from "../src/messaging/ws/types.js";
import { createSocketMessageSender } from "../src/messaging/ws/sender.js";
import { createServerWithTools } from "../src/server.js";
import {
  ClickTool,
  NavigateTool,
  SnapshotTool,
  TypeTool,
} from "../src/types/mcp/tool.js";
import { isPortInUse, killProcessOnPort } from "../src/utils/port.js";
import { createWebSocketServer } from "../src/ws.js";

function randomPort(): number {
  return 20_000 + Math.floor(Math.random() * 10_000);
}

describe("build artifact", () => {
  it("dist/index.js has a single shebang and is non-empty", () => {
    const dist = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
    assert.match(dist, /^#!\/usr\/bin\/env node\n/);
    assert.equal((dist.match(/^#!\/usr\/bin\/env node\n/gm) ?? []).length, 1);
    assert.ok(dist.length > 10_000);
  });
});

describe("tool schemas", () => {
  it("parses navigate arguments", () => {
    const parsed = NavigateTool.shape.arguments.parse({ url: "https://example.com" });
    assert.equal(parsed.url, "https://example.com");
  });

  it("parses click arguments", () => {
    const parsed = ClickTool.shape.arguments.parse({
      element: "Submit button",
      ref: "e42",
    });
    assert.equal(parsed.ref, "e42");
  });

  it("parses type arguments with submit flag", () => {
    const parsed = TypeTool.shape.arguments.parse({
      element: "Search",
      ref: "e1",
      text: "hello",
      submit: true,
    });
    assert.equal(parsed.text, "hello");
    assert.equal(parsed.submit, true);
  });

  it("snapshot tool has empty arguments object", () => {
    assert.deepEqual(SnapshotTool.shape.arguments.parse({}), {});
  });
});

describe("port utilities", () => {
  it("killProcessOnPort does not throw on a free port", () => {
    assert.doesNotThrow(() => killProcessOnPort(randomPort()));
  });

  it("isPortInUse returns false for a free port", async () => {
    const port = randomPort();
    assert.equal(await isPortInUse(port), false);
  });

  it("isPortInUse returns true while a server is listening", async () => {
    const port = randomPort();
    const wss = new WebSocketServer({ port });
    await new Promise<void>((resolve) => wss.once("listening", resolve));
    try {
      assert.equal(await isPortInUse(port), true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        wss.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});

describe("WebSocket messaging", () => {
  it("correlates request/response by id", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = await new Promise<number>((resolve) => {
      wss.once("listening", () => {
        const address = wss.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const request = JSON.parse(raw.toString()) as {
          id: string;
          type: string;
          payload: { value: number };
        };
        ws.send(
          JSON.stringify({
            type: MESSAGE_RESPONSE_TYPE,
            payload: {
              requestId: request.id,
              result: request.payload.value * 2,
            },
          }),
        );
      });
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      client.once("open", () => resolve());
      client.once("error", reject);
    });

    try {
      const { sendSocketMessage } = createSocketMessageSender(client);
      const result = await sendSocketMessage<{ value: number }, number>(
        "test_echo",
        { value: 21 },
        { timeoutMs: 2000 },
      );
      assert.equal(result, 42);
    } finally {
      client.close();
      await new Promise<void>((resolve) =>
        wss.close(() => resolve()),
      );
    }
  });

  it("rejects when the socket is not open", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = await new Promise<number>((resolve) => {
      wss.once("listening", () => {
        const address = wss.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      client.once("open", () => resolve());
      client.once("error", reject);
    });
    client.close();
    await new Promise<void>((resolve) => client.once("close", () => resolve()));

    const { sendSocketMessage } = createSocketMessageSender(client);
    await assert.rejects(
      () => sendSocketMessage("test", {}, { timeoutMs: 500 }),
      /WebSocket is not open/,
    );

    await new Promise<void>((resolve) =>
      wss.close(() => resolve()),
    );
  });

  it("rejects on response error payload", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = await new Promise<number>((resolve) => {
      wss.once("listening", () => {
        const address = wss.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const request = JSON.parse(raw.toString()) as { id: string };
        ws.send(
          JSON.stringify({
            type: MESSAGE_RESPONSE_TYPE,
            payload: { requestId: request.id, error: "No tab is connected" },
          }),
        );
      });
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      client.once("open", () => resolve());
      client.once("error", reject);
    });

    try {
      const { sendSocketMessage } = createSocketMessageSender(client);
      await assert.rejects(
        () => sendSocketMessage("browser_navigate", { url: "https://x.test" }),
        /No tab is connected/,
      );
    } finally {
      client.close();
      await new Promise<void>((resolve) =>
        wss.close(() => resolve()),
      );
    }
  });
});

describe("Context", () => {
  it("throws a helpful error when no extension is connected", () => {
    const context = new Context();
    assert.throws(() => context.ws, /No connection to browser extension/);
  });

  it("maps noConnectedTab errors to the extension message", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = await new Promise<number>((resolve) => {
      wss.once("listening", () => {
        const address = wss.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const request = JSON.parse(raw.toString()) as { id: string };
        ws.send(
          JSON.stringify({
            type: MESSAGE_RESPONSE_TYPE,
            payload: {
              requestId: request.id,
              error: mcpConfig.errors.noConnectedTab,
            },
          }),
        );
      });
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      client.once("open", () => resolve());
      client.once("error", reject);
    });

    const context = new Context();
    context.ws = client;

    try {
      await assert.rejects(
        () => context.sendSocketMessage("getUrl", undefined),
        /No connection to browser extension/,
      );
    } finally {
      await context.close();
      await new Promise<void>((resolve) =>
        wss.close(() => resolve()),
      );
    }
  });
});

describe("MCP server lifecycle", () => {
  it("createWebSocketServer binds to a custom port", async () => {
    const port = randomPort();
    const wss = await createWebSocketServer(port);
    try {
      assert.equal(await isPortInUse(port), true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        wss.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it("server.close() completes without hanging", async () => {
    const port = randomPort();
    const server = await createServerWithTools({
      name: "test",
      version: "0.0.0",
      tools: [],
      resources: [],
      wsPort: port,
    });

    await assert.doesNotReject(async () => {
      await Promise.race([
        server.close(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("server.close() timed out")), 5000),
        ),
      ]);
    });

    assert.equal(await isPortInUse(port), false);
  });
});
