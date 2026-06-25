import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { correlationIdFromRequest } from "../../middleware/correlationId.js";
import { formatZodApiError } from "../platformRouteBodySchemas.js";
import { logAuthReject } from "../structuredLog.js";
import {
  defaultYandexDeliveryPriceService,
  type YandexDeliveryPriceService,
} from "./providers/yandex/services/YandexDeliveryPriceService.js";
import { calculateBestDeliveryQuote } from "./engine/DeliveryEngine.js";
import "./engine/deliveryEngineBootstrap.js";
import { logYandexDeliveryCalculateRouteError } from "./providers/yandex/utils/yandexPriceLogging.js";
import {
  DELIVERY_PRICE_HTTP_STATUS,
  type DeliveryPriceResult,
} from "./types/deliveryPriceTypes.js";

const deliveryCalculateBodySchema = z
  .object({
    merchantId: z.number().int().positive(),
    destination: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
    weightKg: z.number().positive().optional(),
  })
  .strict();

export type DeliveryCalculateRouteDeps = {
  telegramIdFromRequest: (req: Request) => string | null;
  priceService?: YandexDeliveryPriceService;
  useEngine?: boolean;
};

function httpStatusForResult(result: DeliveryPriceResult): number {
  if (result.ok) return 200;
  return DELIVERY_PRICE_HTTP_STATUS[result.code];
}

/** Storefront delivery price calculation — Yandex provider, pickup from merchant DB. */
export function attachDeliveryCalculateRoutes(
  app: Express,
  deps: DeliveryCalculateRouteDeps,
): void {
  const priceService = deps.priceService ?? defaultYandexDeliveryPriceService;
  const useEngine = deps.useEngine !== false;

  app.post("/api/delivery/calculate", async (req: Request, res: Response) => {
    const correlationId = correlationIdFromRequest(req);

    try {
      const telegramId = deps.telegramIdFromRequest(req);
      if (!telegramId) {
        logAuthReject({
          path: req.path ?? req.url,
          reason: "delivery_calculate_missing_telegram_id",
          ...(req.ip ? { ip: req.ip } : {}),
        });
        res.status(401).json({
          error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
        });
        return;
      }

      const parsed = deliveryCalculateBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          code: "invalid_coordinates",
          message: formatZodApiError(parsed.error),
        });
        return;
      }

      const requestId = randomUUID();
      const calcInput = {
        merchantId: parsed.data.merchantId,
        destination: parsed.data.destination,
        ...(parsed.data.weightKg != null ? { weightKg: parsed.data.weightKg } : {}),
        requestId,
        ...(correlationId ? { correlationId } : {}),
      };
      const result = useEngine
        ? await calculateBestDeliveryQuote(calcInput)
        : await priceService.calculate(calcInput);

      res.status(httpStatusForResult(result)).json(result);
    } catch {
      logYandexDeliveryCalculateRouteError({
        path: req.path ?? "/api/delivery/calculate",
        errorCode: "internal_error",
        ...(correlationId ? { correlationId } : {}),
      });
      res.status(500).json({
        ok: false,
        code: "unknown_provider_error",
        message: "Не удалось рассчитать доставку.",
      });
    }
  });
}
