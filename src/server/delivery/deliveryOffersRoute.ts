import type { Express, Request, Response } from "express";
import { correlationIdFromRequest } from "../../middleware/correlationId.js";
import {
  requireDeliveryOffersAccess,
  type DeliveryOffersRouteDeps,
} from "./deliveryRouteAuth.js";
import { calculateOffers } from "./providers/yandex/adapters/yandexOffersAdapter.js";
import { logYandexDeliveryRouteError } from "./providers/yandex/utils/yandexDeliveryLogging.js";
import type {
  YandexCargoOption,
  YandexCargoType,
  YandexOfferRequirementsInput,
  YandexTaxiClass,
} from "./providers/yandex/types/yandexDeliveryTypes.js";

function parseFloatParam(value: unknown): number | null {
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function parseStringParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : null;
}

const VALID_TAXI_CLASSES = new Set<YandexTaxiClass>(["courier", "express", "cargo"]);
const VALID_CARGO_TYPES = new Set<YandexCargoType>(["van", "lcv_m", "lcv_l", "lcv_xl"]);
const VALID_CARGO_OPTIONS = new Set<YandexCargoOption>(["thermobag", "auto_courier"]);

function parseRequirements(query: Request["query"]): YandexOfferRequirementsInput | undefined {
  const taxiClassRaw = parseStringParam(query.taxiClass ?? query.taxiClasses);
  const requirements: YandexOfferRequirementsInput = {};

  if (taxiClassRaw) {
    const classes = taxiClassRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is YandexTaxiClass => VALID_TAXI_CLASSES.has(s as YandexTaxiClass));
    if (classes.length > 0) requirements.taxiClasses = classes;
  }

  const cargoType = parseStringParam(query.cargoType)?.toLowerCase();
  if (cargoType && VALID_CARGO_TYPES.has(cargoType as YandexCargoType)) {
    requirements.cargoType = cargoType as YandexCargoType;
  }

  const cargoLoaders = parseFloatParam(query.cargoLoaders);
  if (cargoLoaders != null) requirements.cargoLoaders = Math.round(cargoLoaders);

  const proCourier = parseStringParam(query.proCourier);
  if (proCourier === "1" || proCourier === "true") requirements.proCourier = true;

  const skipDoor = parseStringParam(query.skipDoorToDoor);
  if (skipDoor === "1" || skipDoor === "true") requirements.skipDoorToDoor = true;

  const cargoOptionsRaw = parseStringParam(query.cargoOptions);
  if (cargoOptionsRaw) {
    const opts = cargoOptionsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is YandexCargoOption => VALID_CARGO_OPTIONS.has(s as YandexCargoOption));
    if (opts.length > 0) requirements.cargoOptions = opts;
  }

  const due = parseStringParam(query.due);
  if (due) requirements.due = due;

  return Object.keys(requirements).length > 0 ? requirements : undefined;
}

/** Debug endpoint — merchant or platform operator only; not wired to checkout. */
export function attachDeliveryOffersRoutes(
  app: Express,
  deps: DeliveryOffersRouteDeps,
): void {
  app.get("/api/delivery/offers", async (req: Request, res: Response) => {
    const correlationId = correlationIdFromRequest(req);

    try {
      const auth = await requireDeliveryOffersAccess(req, res, deps);
      if (!auth) return;

      const pickupAddress = parseStringParam(req.query.pickupAddress);
      const deliveryAddress = parseStringParam(req.query.deliveryAddress);
      const pickupLng = parseFloatParam(req.query.pickupLng);
      const pickupLat = parseFloatParam(req.query.pickupLat);
      const deliveryLng = parseFloatParam(req.query.deliveryLng);
      const deliveryLat = parseFloatParam(req.query.deliveryLat);

      if (!pickupAddress || !deliveryAddress) {
        res.status(400).json({
          ok: false,
          error: "pickupAddress and deliveryAddress are required",
        });
        return;
      }

      if (
        pickupLng == null ||
        pickupLat == null ||
        deliveryLng == null ||
        deliveryLat == null
      ) {
        res.status(400).json({
          ok: false,
          error: "pickupLng, pickupLat, deliveryLng, deliveryLat are required",
        });
        return;
      }

      const weightKg = parseFloatParam(req.query.weight) ?? 1;
      const lengthM = parseFloatParam(req.query.length);
      const widthM = parseFloatParam(req.query.width);
      const heightM = parseFloatParam(req.query.height);

      const size =
        lengthM != null && widthM != null && heightM != null
          ? { lengthM, widthM, heightM }
          : undefined;

      const item: {
        weightKg: number;
        quantity: number;
        size?: { lengthM: number; widthM: number; heightM: number };
      } = {
        weightKg,
        quantity: parseFloatParam(req.query.quantity) ?? 1,
      };
      if (size) item.size = size;

      const requirements = parseRequirements(req.query);
      const calculateInput: Parameters<typeof calculateOffers>[0] = {
        pickup: {
          address: pickupAddress,
          coordinates: { longitude: pickupLng, latitude: pickupLat },
        },
        delivery: {
          address: deliveryAddress,
          coordinates: { longitude: deliveryLng, latitude: deliveryLat },
        },
        item,
      };
      if (requirements) calculateInput.requirements = requirements;

      const result = await calculateOffers(calculateInput, {
        ...(correlationId ? { correlationId } : {}),
      });

      if (!result.ok) {
        const status =
          result.code === "validation_error" || result.code === "not_configured"
            ? 400
            : result.code === "rate_limited"
              ? 429
              : result.code === "timeout"
                ? 504
                : result.code === "tariffs_unavailable" || result.code === "empty_offers"
                  ? 409
                  : 502;
        res.status(status).json(result);
        return;
      }

      res.json({ ok: true, offers: result.offers });
    } catch {
      logYandexDeliveryRouteError({
        path: req.path ?? "/api/delivery/offers",
        errorCode: "internal_error",
        ...(correlationId ? { correlationId } : {}),
      });
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });
}
