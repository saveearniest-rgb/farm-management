import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(
        "node_modules/next/dist/compiled/server-only/empty.js",
      ),
      "@": path.resolve("src"),
    },
  },
});
