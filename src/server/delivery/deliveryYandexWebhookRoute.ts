import type { Express } from "express";
import { handleYandexDeliveryWebhook } from "./providers/yandex/webhooks/YandexWebhookController.js";

/** Yandex Delivery status push webhook (no Telegram auth). */
export function attachDeliveryYandexWebhookRoutes(app: Express): void {
  app.post(
    "/api/delivery/providers/yandex/webhook",
    handleYandexDeliveryWebhook,
  );
}
