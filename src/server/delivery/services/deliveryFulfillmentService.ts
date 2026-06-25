import { DeliveryMode } from "@prisma/client";
import { prisma } from "../../db.js";
import { requiresProviderDeliveryFulfillment } from "../../../shared/hybridDeliveryCheckout.js";
import { isYandexDeliveryClaimsEnabled } from "../providers/yandex/services/yandexDeliveryConfig.js";
import { createDeliveryWithFailover } from "../engine/DeliveryEngine.js";
import "../engine/deliveryEngineBootstrap.js";
import {
  createDeliveryMerchantResolver,
  type DeliveryMerchantResolver,
} from "./deliveryMerchantResolver.js";
import {
  createDeliveryOfferCache,
  type DeliveryOfferCache,
} from "./deliveryOfferCache.js";
import {
  createProviderDeliveryRepository,
  type ProviderDeliveryRepository,
} from "../repositories/providerDeliveryRepository.js";
import { logDeliveryClaimFailed } from "../providers/yandex/utils/yandexClaimsLogging.js";
import { incrementDeliveryMetric } from "../utils/deliveryMetrics.js";
import { recordDeliveryTimeline } from "../operations/services/deliveryTimelineRecorder.js";

export type FulfillDeliveryOptions = {
  correlationId?: string;
  requestId?: string;
};

export type FulfillDeliveryDeps = {
  claimsEnabled?: () => boolean;
  repository?: ProviderDeliveryRepository;
  offerCache?: DeliveryOfferCache;
  resolveMerchant?: DeliveryMerchantResolver;
  fulfillWithFailover?: typeof createDeliveryWithFailover;
  loadOrder?: (orderId: number) => Promise<{
    id: number;
    businessId: number;
    buyerUserId: number | null;
    status: string;
    deliveryMode: DeliveryMode;
    deliveryOfferId: string | null;
    deliveryProvider: string | null;
    deliveryFee: number;
    address: string;
    phone: string;
    name: string;
    lat: number | null;
    lng: number | null;
  } | null>;
};

function isValidCoord(lat: number | null, lng: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function createDeliveryFulfillmentService(deps: FulfillDeliveryDeps = {}) {
  const claimsEnabled = deps.claimsEnabled ?? isYandexDeliveryClaimsEnabled;
  const repository = deps.repository ?? createProviderDeliveryRepository();
  const offerCache = deps.offerCache ?? createDeliveryOfferCache();
  const resolveMerchant = deps.resolveMerchant ?? createDeliveryMerchantResolver();
  const fulfillWithFailover = deps.fulfillWithFailover ?? createDeliveryWithFailover;
  const loadOrder =
    deps.loadOrder ??
    (async (orderId: number) =>
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          businessId: true,
          buyerUserId: true,
          status: true,
          deliveryMode: true,
          deliveryOfferId: true,
          deliveryProvider: true,
          deliveryFee: true,
          address: true,
          phone: true,
          name: true,
          lat: true,
          lng: true,
        },
      }));

  async function fulfillDeliveryForPaidOrder(
    orderId: number,
    options?: FulfillDeliveryOptions,
  ): Promise<void> {
    if (!claimsEnabled()) return;

    const order = await loadOrder(orderId);
    if (!order) return;

    if (order.status !== "CONFIRMED") return;
    if (
      !requiresProviderDeliveryFulfillment({
        deliveryMode: order.deliveryMode,
        deliveryProvider: order.deliveryProvider,
        deliveryOfferId: order.deliveryOfferId,
      })
    ) {
      return;
    }

    const deliveryOfferId = order.deliveryOfferId!.trim();

    const existing = await repository.findByOrderId(orderId);
    if (existing) return;

    const logCtx = {
      merchantId: order.businessId,
      orderId: order.id,
      provider: "yandex" as const,
      ...(options?.requestId ? { requestId: options.requestId } : {}),
      ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
    };

    if (!isValidCoord(order.lat, order.lng)) {
      await repository.create({
        orderId: order.id,
        businessId: order.businessId,
        buyerUserId: order.buyerUserId,
        provider: "yandex",
        providerOfferId: deliveryOfferId,
        status: "FAILED",
        lastErrorCode: "invalid_order",
        lastErrorMessage: "Некорректные координаты доставки в заказе.",
      });
      logDeliveryClaimFailed({ ...logCtx, code: "invalid_order", phase: "fulfillment" });
      return;
    }

    const merchantResult = await resolveMerchant.resolve(order.businessId);
    if (!merchantResult.ok) {
      await repository.create({
        orderId: order.id,
        businessId: order.businessId,
        buyerUserId: order.buyerUserId,
        provider: "yandex",
        providerOfferId: deliveryOfferId,
        status: "FAILED",
        lastErrorCode: merchantResult.code,
        lastErrorMessage: merchantResult.message,
      });
      logDeliveryClaimFailed({ ...logCtx, code: merchantResult.code, phase: "fulfillment" });
      return;
    }

    const cachedOffer = offerCache.consume(deliveryOfferId);
    if (!cachedOffer || cachedOffer.merchantId !== order.businessId) {
      await repository.create({
        orderId: order.id,
        businessId: order.businessId,
        buyerUserId: order.buyerUserId,
        provider: "yandex",
        providerOfferId: deliveryOfferId,
        status: "FAILED",
        lastErrorCode: "offer_not_found",
        lastErrorMessage: "Предложение доставки устарело или не найдено.",
      });
      logDeliveryClaimFailed({ ...logCtx, code: "offer_not_found", phase: "fulfillment" });
      return;
    }

    const selectedProvider = cachedOffer.provider?.trim() || "yandex";

    const record = await repository.create({
      orderId: order.id,
      businessId: order.businessId,
      buyerUserId: order.buyerUserId,
      provider: selectedProvider,
      providerOfferId: deliveryOfferId,
      price: cachedOffer.price,
      currency: cachedOffer.currency,
      status: "NEW",
    });

    const providerResult = await fulfillWithFailover(
      {
        orderId: order.id,
        merchantId: order.businessId,
        buyerUserId: order.buyerUserId,
        offerPayload: cachedOffer.payload,
        price: cachedOffer.price,
        currency: cachedOffer.currency,
        pickup: {
          address: merchantResult.pickup.address,
          coordinates: merchantResult.pickup.coordinates,
        },
        delivery: {
          address: order.address.trim() || "Delivery point",
          coordinates: { latitude: order.lat!, longitude: order.lng! },
          contactName: order.name.trim() || "Customer",
          contactPhone: order.phone.trim(),
        },
        weightKg: 1,
        ...(options?.requestId ? { requestId: options.requestId } : {}),
        ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
      },
      selectedProvider,
    );

    if (!providerResult.ok) {
      await repository.update(record.id, {
        status: "FAILED",
        lastErrorCode: providerResult.code,
        lastErrorMessage: providerResult.message,
      });
      logDeliveryClaimFailed({
        ...logCtx,
        code: providerResult.code,
        phase: providerResult.code === "provider_rate_limit" ? "accept" : "create",
      });
      return;
    }

    await repository.update(record.id, {
      status: "CREATED",
      providerClaimId: providerResult.providerClaimId,
      providerPayload: providerResult.internalPayload,
      price: providerResult.price,
      currency: providerResult.currency,
    });

    await repository.update(record.id, {
      status: "ACCEPTED",
    });

    await repository.update(record.id, {
      status: "SEARCHING_COURIER",
    });

    incrementDeliveryMetric("delivery_created_total");

    void recordDeliveryTimeline({
      providerDeliveryId: record.id,
      orderId: record.orderId,
      businessId: record.businessId,
      provider: record.provider,
      kind: "CLAIM_CREATED",
      title: "Claim created",
      actor: "SYSTEM",
    });
    void recordDeliveryTimeline({
      providerDeliveryId: record.id,
      orderId: record.orderId,
      businessId: record.businessId,
      provider: record.provider,
      kind: "CLAIM_ACCEPTED",
      title: "Claim accepted",
      actor: "SYSTEM",
    });
  }

  return { fulfillDeliveryForPaidOrder };
}

const defaultService = createDeliveryFulfillmentService();

export async function fulfillDeliveryForPaidOrder(
  orderId: number,
  options?: FulfillDeliveryOptions,
): Promise<void> {
  return defaultService.fulfillDeliveryForPaidOrder(orderId, options);
}
