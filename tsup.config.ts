import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/ws-daemon.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  dts: false,
  sourcemap: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
