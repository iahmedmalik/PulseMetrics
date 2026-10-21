import { defineConfig } from "tsup";

// Bundle the shared package into the server so Render only needs `node dist/server.js`.
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  noExternal: ["@pulse/core"],
});
