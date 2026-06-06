import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";

const TOKEN_FILENAME = "bridge.token";
const TOKEN_BYTES = 32;

function tokenDir(): string {
  return process.env.BROWSERMCP_TOKEN_DIR ?? path.join(homedir(), ".browsermcp");
}

function tokenPath(): string {
  return path.join(tokenDir(), TOKEN_FILENAME);
}

export function getBridgeTokenFromEnv(): string | undefined {
  const value = process.env.BROWSERMCP_BRIDGE_TOKEN?.trim();
  return value || undefined;
}

export async function ensureBridgeToken(): Promise<string> {
  const fromEnv = getBridgeTokenFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const file = tokenPath();
  try {
    const existing = (await readFile(file, "utf8")).trim();
    if (existing.length >= 16) {
      return existing;
    }
  } catch {
    // Generate a new token below.
  }

  const token = generateToken();
  await mkdir(tokenDir(), { recursive: true, mode: 0o700 });
  await writeFile(file, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  return token;
}

export async function readBridgeToken(): Promise<string> {
  const fromEnv = getBridgeTokenFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const file = tokenPath();
  const token = (await readFile(file, "utf8")).trim();
  if (!token) {
    throw new Error(
      "Browser MCP bridge token is missing. Restart the bridge daemon or set BROWSERMCP_BRIDGE_TOKEN.",
    );
  }
  return token;
}

export function tokensMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function generateToken(): string {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(TOKEN_BYTES);
    globalThis.crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString("base64url");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
