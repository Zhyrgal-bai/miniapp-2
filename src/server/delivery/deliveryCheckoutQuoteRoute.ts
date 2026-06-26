import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { correlationIdFromRequest } from "../../middleware/correlationId.js";
import { formatZodApiError } from "../platformRouteBodySchemas.js";
import { logAuthReject } from "../structuredLog.js";
import { resolveHybridCheckoutDelivery } from "./engine/hybridCheckoutDeliveryResolver.js";
import "./engine/deliveryEngineBootstrap.js";
import {
  CHECKOUT_DELIVERY_QUOTE_HTTP_STATUS,
  type CheckoutDeliveryQuote,
} from "../../shared/hybridDeliveryCheckout.js";
import type { DeliveryDestinationLocality } from "../../shared/merchantDeliveryLocality.js";

const destinationLocalitySchema = z
  .object({
    city: z.string().trim().min(1).max(200).optional(),
    district: z.string().trim().min(1).max(200).optional(),
    region: z.string().trim().min(1).max(200).optional(),
    country: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

function normalizeDestinationLocality(
  locality: z.infer<typeof destinationLocalitySchema>,
): DeliveryDestinationLocality {
  return {
    city: locality.city ?? null,
    district: locality.district ?? null,
    region: locality.region ?? null,
    country: locality.country ?? null,
  };
}

const checkoutQuoteBodySchema = z
  .object({
    merchantId: z.number().int().positive(),
    destination: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
    subtotalSom: z.number().min(0),
    fulfillmentMode: z.enum(["DELIVERY", "PICKUP"]),
    destinationLabel: z.string().trim().min(1).max(2000).optional(),
    destinationLocality: destinationLocalitySchema.optional(),
  })
  .strict();

export type DeliveryCheckoutQuoteRouteDeps = {
  telegramIdFromRequest: (req: Request) => string | null;
};

function httpStatusForQuote(result: CheckoutDeliveryQuote): number {
  if (result.ok) return 200;
  return CHECKOUT_DELIVERY_QUOTE_HTTP_STATUS[result.code] ?? 400;
}

/** Storefront checkout delivery quote — hybrid engine + merchant fallback. */
export function attachDeliveryCheckoutQuoteRoutes(
  app: Express,
  deps: DeliveryCheckoutQuoteRouteDeps,
): void {
  app.post("/api/delivery/checkout-quote", async (req: Request, res: Response) => {
    const correlationId = correlationIdFromRequest(req);

    try {
      const telegramId = deps.telegramIdFromRequest(req);
      if (!telegramId) {
        logAuthReject({
          path: req.path ?? req.url,
          reason: "delivery_checkout_quote_missing_telegram_id",
          ...(req.ip ? { ip: req.ip } : {}),
        });
        res.status(401).json({
          error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
        });
        return;
      }

      const parsed = checkoutQuoteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          code: "INVALID_COORDINATES",
          message: formatZodApiError(parsed.error),
        });
        return;
      }

      const requestId = randomUUID();
      const result = await resolveHybridCheckoutDelivery({
        merchantId: parsed.data.merchantId,
        destination: parsed.data.destination,
        subtotalSom: parsed.data.subtotalSom,
        fulfillmentMode: parsed.data.fulfillmentMode,
        requestId,
        ...(parsed.data.destinationLabel
          ? { destinationLabel: parsed.data.destinationLabel }
          : {}),
        ...(parsed.data.destinationLocality
          ? { destinationLocality: normalizeDestinationLocality(parsed.data.destinationLocality) }
          : {}),
        ...(correlationId ? { correlationId } : {}),
      });

      res.status(httpStatusForQuote(result)).json(result);
    } catch {
      res.status(500).json({
        ok: false,
        code: "DELIVERY_UNAVAILABLE",
        message: "Не удалось рассчитать доставку.",
      });
    }
  });
}
