import { mcpConfig } from "@/config/mcp.config";

const BLOCKED_URL_PROTOCOLS = /^(javascript|data|file|vbscript|blob):/i;

export function assertSafeNavigationUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }
  if (trimmed.length > mcpConfig.limits.maxUrlLength) {
    throw new Error(`URL exceeds maximum length of ${mcpConfig.limits.maxUrlLength}`);
  }
  if (BLOCKED_URL_PROTOCOLS.test(trimmed)) {
    throw new Error("Blocked URL protocol. Only http and https URLs are allowed.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }
}

export function assertAllowedPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${port}`);
  }
}
