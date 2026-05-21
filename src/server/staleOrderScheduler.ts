import { releaseStaleUnpaidOrders } from "./staleOrderService.js";
import { healAllBusinessesInventory } from "./inventoryHealService.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Hourly cleanup of unpaid orders with stale stock reservations. */
export function startStaleOrderCleanupScheduler(): void {
  const rawInterval = process.env.STALE_ORDER_CLEANUP_INTERVAL_MS;
  const intervalMs =
    rawInterval != null && String(rawInterval).trim() !== ""
      ? Number(rawInterval)
      : DEFAULT_INTERVAL_MS;
  const interval =
    Number.isFinite(intervalMs) && intervalMs >= 60_000
      ? intervalMs
      : DEFAULT_INTERVAL_MS;

  const rawMaxAge = process.env.STALE_ORDER_TTL_MS;
  const maxAgeMs =
    rawMaxAge != null && String(rawMaxAge).trim() !== ""
      ? Number(rawMaxAge)
      : DEFAULT_MAX_AGE_MS;
  const maxAge =
    Number.isFinite(maxAgeMs) && maxAgeMs >= 60_000
      ? maxAgeMs
      : DEFAULT_MAX_AGE_MS;

  const run = async () => {
    try {
      await releaseStaleUnpaidOrders({ maxAgeMs: maxAge });
      await healAllBusinessesInventory();
    } catch (e) {
      console.error("staleOrderCleanup:", e);
    }
  };

  void run();
  setInterval(() => void run(), interval);

  console.log(
    `staleOrderCleanup: scheduler every ${Math.round(interval / 60_000)} min (ttl ${Math.round(maxAge / 60_000)} min)`,
  );
}
