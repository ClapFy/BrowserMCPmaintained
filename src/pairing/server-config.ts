import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import packageJSON from "../../package.json";

import type { McpServerEntry } from "./types";

function getPackageRoot(): string {
  const entry = fileURLToPath(import.meta.url);
  if (entry.includes(`${path.sep}dist${path.sep}`)) {
    return path.dirname(path.dirname(entry));
  }
  return path.dirname(path.dirname(path.dirname(entry)));
}

function isLocalDevelopment(): boolean {
  const pkgRoot = getPackageRoot();
  const pkgPath = path.join(pkgRoot, "package.json");

  if (!existsSync(pkgPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    return pkg.name === "@browsermcp/mcp" && existsSync(path.join(pkgRoot, "src"));
  } catch {
    return false;
  }
}

export function resolveServerEntryPath(): string {
  return fileURLToPath(import.meta.url);
}

export function resolveServerConfig(options: { local?: boolean } = {}): McpServerEntry {
  const useLocal = options.local ?? isLocalDevelopment();

  if (useLocal) {
    return {
      command: process.execPath,
      args: [resolveServerEntryPath()],
    };
  }

  return {
    command: "npx",
    args: ["-y", `@browsermcp/mcp@${packageJSON.version}`],
  };
}

export function isUsingLocalServerConfig(config: McpServerEntry): boolean {
  const entryPath = resolveServerEntryPath();
  return config.command === process.execPath && config.args.includes(entryPath);
}
