import type { Express } from "express";
import { getDeliveryHealthSnapshot } from "./services/deliveryHealthService.js";

/** Operational delivery subsystem health (no secrets). */
export function attachDeliveryHealthRoutes(app: Express): void {
  app.get("/api/delivery/health", async (_req, res) => {
    try {
      const snapshot = await getDeliveryHealthSnapshot();
      res.status(snapshot.ok ? 200 : 503).json(snapshot);
    } catch {
      res.status(503).json({ ok: false });
    }
  });
}
