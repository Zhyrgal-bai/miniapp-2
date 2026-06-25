import { calculateOffers } from "../adapters/yandexOffersAdapter.js";
import type { YandexHttpFetch } from "../client/yandexHttpClient.js";
import type {
  ArchaDeliveryOffer,
  YandexOffersCalculateResult,
} from "../types/yandexDeliveryTypes.js";
import { logYandexDeliveryPriceCalculate } from "../utils/yandexPriceLogging.js";
import type { DeliveryMerchantResolver } from "../../../services/deliveryMerchantResolver.js";
import { defaultDeliveryMerchantResolver } from "../../../services/deliveryMerchantResolver.js";
import { defaultDeliveryOfferCache } from "../../../services/deliveryOfferCache.js";
import type {
  DeliveryPriceCalculateInput,
  DeliveryPriceErrorCode,
  DeliveryPriceFailure,
  DeliveryPriceResult,
} from "../../../types/deliveryPriceTypes.js";
import { DELIVERY_PRICE_HTTP_STATUS } from "../../../types/deliveryPriceTypes.js";

const TAXI_CLASS_PRIORITY: Record<string, number> = {
  express: 0,
  courier: 1,
};

function isValidDestinationCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function validateDestination(input: DeliveryPriceCalculateInput): DeliveryPriceFailure | null {
  const { latitude, longitude } = input.destination;
  if (!isValidDestinationCoordinate(latitude, longitude)) {
    return {
      ok: false,
      code: "invalid_coordinates",
      message: "Некорректные координаты пункта доставки.",
    };
  }
  return null;
}

function destinationLabel(): string {
  return "Delivery point";
}

function mapAdapterCode(
  code: Extract<YandexOffersCalculateResult, { ok: false }>["code"],
): DeliveryPriceErrorCode {
  switch (code) {
    case "validation_error":
      return "invalid_coordinates";
    case "timeout":
      return "provider_timeout";
    case "rate_limited":
      return "provider_rate_limit";
    case "tariffs_unavailable":
    case "empty_offers":
      return "tariff_unavailable";
    case "network_error":
    case "not_configured":
      return "provider_unavailable";
    default:
      return "unknown_provider_error";
  }
}

const ADAPTER_ERROR_MESSAGES: Record<
  Extract<YandexOffersCalculateResult, { ok: false }>["code"],
  string
> = {
  validation_error: "Некорректные координаты пункта доставки.",
  timeout: "Сервис доставки не ответил вовремя. Попробуйте позже.",
  rate_limited: "Сервис доставки временно перегружен. Попробуйте позже.",
  tariffs_unavailable: "Доставка по этому маршруту сейчас недоступна.",
  empty_offers: "Доставка по этому маршруту сейчас недоступна.",
  network_error: "Сервис доставки временно недоступен.",
  not_configured: "Сервис доставки не настроен.",
  bad_request: "Не удалось рассчитать доставку.",
  api_error: "Не удалось рассчитать доставку.",
};

function mapAdapterFailure(result: Extract<YandexOffersCalculateResult, { ok: false }>): DeliveryPriceResult {
  const code = mapAdapterCode(result.code);
  const message =
    ADAPTER_ERROR_MESSAGES[result.code] ?? "Не удалось рассчитать доставку.";
  return { ok: false, code, message };
}

function taxiClassRank(offerId: string): number {
  const taxiClass = offerId.split(":")[0]?.toLowerCase() ?? "";
  return TAXI_CLASS_PRIORITY[taxiClass] ?? 99;
}

function pickBestOffer(offers: ArchaDeliveryOffer[]): ArchaDeliveryOffer {
  return [...offers].sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price;
    return taxiClassRank(a.id) - taxiClassRank(b.id);
  })[0]!;
}

function etaMinutesFromInterval(
  interval: { from: string; to: string } | null,
): number | null {
  if (!interval) return null;
  const fromMs = Date.parse(interval.from);
  const toMs = Date.parse(interval.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  const midMs = (fromMs + toMs) / 2;
  const minutes = Math.round((midMs - Date.now()) / 60_000);
  return minutes > 0 ? minutes : null;
}

export type YandexDeliveryPriceServiceDeps = {
  resolveMerchant?: DeliveryMerchantResolver;
  calculateOffersFn?: typeof calculateOffers;
  fetchImpl?: YandexHttpFetch;
};

export class YandexDeliveryPriceService {
  private readonly resolveMerchant: DeliveryMerchantResolver;
  private readonly calculateOffersFn: typeof calculateOffers;
  private readonly fetchImpl: YandexHttpFetch | undefined;

  constructor(deps: YandexDeliveryPriceServiceDeps = {}) {
    this.resolveMerchant = deps.resolveMerchant ?? defaultDeliveryMerchantResolver;
    this.calculateOffersFn = deps.calculateOffersFn ?? calculateOffers;
    this.fetchImpl = deps.fetchImpl;
  }

  async calculate(input: DeliveryPriceCalculateInput): Promise<DeliveryPriceResult> {
    const started = Date.now();
    const requestId = input.requestId;
    const correlationId = input.correlationId;

    const destinationError = validateDestination(input);
    if (destinationError != null) {
      logYandexDeliveryPriceCalculate({
        merchantId: input.merchantId,
        provider: "yandex",
        durationMs: Date.now() - started,
        ok: false,
        code: destinationError.code,
        httpStatus: DELIVERY_PRICE_HTTP_STATUS[destinationError.code],
        ...(requestId ? { requestId } : {}),
        ...(correlationId ? { correlationId } : {}),
      });
      return destinationError;
    }

    const merchantResult = await this.resolveMerchant.resolve(input.merchantId);
    if (!merchantResult.ok) {
      logYandexDeliveryPriceCalculate({
        merchantId: input.merchantId,
        provider: "yandex",
        durationMs: Date.now() - started,
        ok: false,
        code: merchantResult.code,
        httpStatus: DELIVERY_PRICE_HTTP_STATUS[merchantResult.code],
        ...(requestId ? { requestId } : {}),
        ...(correlationId ? { correlationId } : {}),
      });
      return {
        ok: false,
        code: merchantResult.code,
        message: merchantResult.message,
      };
    }

    const { pickup } = merchantResult;
    const weightKg = input.weightKg != null && input.weightKg > 0 ? input.weightKg : 1;

    const adapterResult = await this.calculateOffersFn(
      {
        pickup: {
          address: pickup.address,
          coordinates: {
            latitude: pickup.coordinates.latitude,
            longitude: pickup.coordinates.longitude,
          },
        },
        delivery: {
          address: destinationLabel(),
          coordinates: {
            latitude: input.destination.latitude,
            longitude: input.destination.longitude,
          },
        },
        item: { weightKg, quantity: 1 },
      },
      {
        ...(requestId ? { requestId } : {}),
        ...(correlationId ? { correlationId } : {}),
        ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
      },
    );

    if (!adapterResult.ok) {
      const failure: DeliveryPriceResult = mapAdapterFailure(adapterResult);
      if (!failure.ok) {
        logYandexDeliveryPriceCalculate({
          merchantId: input.merchantId,
          provider: "yandex",
          durationMs: Date.now() - started,
          ok: false,
          code: failure.code,
          httpStatus: DELIVERY_PRICE_HTTP_STATUS[failure.code],
          ...(requestId ? { requestId } : {}),
          ...(correlationId ? { correlationId } : {}),
        });
      }
      return failure;
    }

    const best = pickBestOffer(adapterResult.offers);
    defaultDeliveryOfferCache.put(best.id, {
      payload: best.payload,
      merchantId: input.merchantId,
      price: best.price,
      currency: best.currency,
      expiresAt: best.expiresAt,
    });
    const quote = {
      provider: "yandex" as const,
      available: true as const,
      price: best.price,
      currency: best.currency,
      etaMinutes: etaMinutesFromInterval(best.deliveryEta),
      providerOfferId: best.id,
      expiresAt: best.expiresAt,
    };

    logYandexDeliveryPriceCalculate({
      merchantId: input.merchantId,
      provider: "yandex",
      durationMs: Date.now() - started,
      ok: true,
      ...(requestId ? { requestId } : {}),
      ...(correlationId ? { correlationId } : {}),
    });

    return { ok: true, quote };
  }
}

export const defaultYandexDeliveryPriceService = new YandexDeliveryPriceService();
