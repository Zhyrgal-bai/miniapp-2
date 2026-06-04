/**
 * Render build: embed public API URL into Vite bundle (VITE_API_URL).
 * Uses existing VITE_API_URL, else RENDER_EXTERNAL_URL, else API_URL.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

function pickApiUrlForViteBuild() {
  const fromEnv =
    process.env.VITE_API_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    process.env.API_URL?.trim() ||
    "";
  return fromEnv.replace(/\/$/, "");
}

const viteApiUrl = pickApiUrlForViteBuild();
const env = { ...process.env };
if (viteApiUrl !== "") {
  env.VITE_API_URL = viteApiUrl;
  console.log(`[build] VITE_API_URL=${viteApiUrl}`);
} else {
  console.warn(
    "[build] VITE_API_URL not set — frontend will use runtime origin fallback on *.onrender.com",
  );
}

const r = spawnSync("npm", ["run", "build", "--prefix", "frontend"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
