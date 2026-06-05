import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@repo-shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    include: ["tests/smoke/**/*.test.ts"],
    environment: "node",
  },
});
