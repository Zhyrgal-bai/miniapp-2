import { processMediaDestroyQueue } from "./mediaDestroyQueue.js";
import { prisma } from "../server/db.js";

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

/** Retry failed Cloudinary destroys on a schedule. */
export function startMediaDestroyScheduler(): void {
  const raw = process.env.MEDIA_DESTROY_RETRY_INTERVAL_MS;
  const intervalMs =
    raw != null && String(raw).trim() !== "" ? Number(raw) : DEFAULT_INTERVAL_MS;
  const interval =
    Number.isFinite(intervalMs) && intervalMs >= 60_000
      ? intervalMs
      : DEFAULT_INTERVAL_MS;

  const run = async () => {
    try {
      await processMediaDestroyQueue(prisma);
    } catch (e) {
      console.error("[mediaDestroyScheduler]", e);
    }
  };

  void run();
  setInterval(() => void run(), interval);
}
