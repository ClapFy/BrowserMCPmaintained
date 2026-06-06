export const mcpConfig = {
  defaultWsPort: 9009,
  bridgeControlPort: 9010,
  keepaliveMs: 25_000,
  bridgeAuthTimeoutMs: 5_000,
  bridgeConnectTimeoutMs: 5_000,
  defaultRequestTimeoutMs: 30_000,
  maxBridgeBufferBytes: 10 * 1024 * 1024,
  maxPendingBridgeRequests: 100,
  limits: {
    maxUrlLength: 8_192,
    maxWaitSeconds: 120,
    maxTextLength: 10_000,
    maxKeyLength: 128,
    maxRefLength: 256,
    maxElementDescriptionLength: 512,
    maxSelectValues: 50,
    maxSelectValueLength: 256,
    maxConsoleLogLines: 500,
  },
  errors: {
    noConnectedTab: "No tab is connected",
    bridgeDisconnected:
      "Browser MCP bridge disconnected. Re-open the Browser MCP extension and click Connect.",
    bridgeAuthFailed: "Bridge authentication failed",
    bridgeAuthTimeout: "Bridge authentication timed out",
    tooManyPendingRequests: "Too many pending bridge requests",
  },
} as const;
