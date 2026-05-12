/** Vite config — Telegram miniapp frontend */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Откройте /build-info.txt на проде — должен совпадать с последним коммитом в Git (иначе Vercel/Render отдаёт старый билд). */
function writeBuildInfoPlugin(): Plugin {
  return {
    name: "write-build-info",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const sha =
        process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
        process.env.RENDER_GIT_COMMIT?.trim() ||
        process.env.GITHUB_SHA?.trim() ||
        "local";
      fs.writeFileSync(path.join(outDir, "build-info.txt"), `${sha}\n`, "utf8");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), writeBuildInfoPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@repo-shared": path.resolve(__dirname, "../src/shared"),
      "@repo-storefront": path.resolve(__dirname, "../src/storefront"),
    },
  },
});