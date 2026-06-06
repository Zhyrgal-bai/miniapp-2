import type { Response } from "express";
import { prisma } from "./db.js";
import { resolveStorefrontConfig } from "../storefront/schema.js";
import {
  getCachedStorefrontPayload,
  setCachedStorefrontPayload,
} from "./storefrontCache.js";
import { safeParseStorefrontPublicApiResponse } from "../storefront/storefrontPublicApiResponseSchema.js";
import { templateForBusinessType } from "../templates/index.js";
import type { BusinessType } from "@prisma/client";
import {
  API_ERR_BUSINESS_NOT_FOUND,
  API_ERR_INVALID_BUSINESS_ID,
  API_ERR_SERVER,
  API_ERR_STORE_UNAVAILABLE,
  API_ERR_STOREFRONT_INVALID,
} from "../shared/apiClientMessages.js";
import { toPublicProduct } from "../shared/productDto.js";
import { loadStockRowsByProductIds } from "./inventoryService.js";
import { getFeaturedPromoForStorefront } from "./promoRepo.js";
import { rejectUnlessCanAcceptCustomerOrders } from "./subscriptionCustomerGate.js";
import { businessAddressRowToPublic } from "../shared/businessAddress.js";
import { buildMerchantTelegramOpenUrl } from "./merchantTelegramOpenUrl.js";
import {
  merchantDeliverySettingsToPublic,
  parseMerchantDeliverySettings,
  defaultMerchantDeliverySettings,
} from "../shared/merchantDeliverySettings.js";
import {
  parseStoreAvailabilitySettings,
  storeAvailabilityToPublic,
  defaultStoreAvailabilitySettings,
} from "../shared/storeAvailabilitySettings.js";

/** Public GET /api/storefront payload (shared by numeric id and slug routes). */
export async function sendStorefrontPublicPayload(
  res: Response,
  businessId: number,
): Promise<void> {
  try {
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: API_ERR_INVALID_BUSINESS_ID });
      return;
    }

    const cached = getCachedStorefrontPayload(businessId);
    if (cached) {
      const cachedOk = safeParseStorefrontPublicApiResponse(cached);
      if (cachedOk.ok) {
        res.json(cachedOk.data);
        return;
      }
      console.warn(
        `GET /api/storefront/${businessId}: cached payload failed validation, rebuilding:`,
        cachedOk.error,
      );
    }

    const b = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        name: true,
        slug: true,
        businessType: true,
        templateId: true,
        themeConfig: true,
        storefrontConfig: true,
        storefrontPublishedConfig: true,
        storefrontConfigVersion: true,
        featureFlags: true,
        addressLine: true,
        city: true,
        latitude: true,
        longitude: true,
        botToken: true,
        deliverySettings: true,
        storeAvailabilitySettings: true,
      },
    });
    if (rejectUnlessCanAcceptCustomerOrders(res, b)) {
      return;
    }

    const sf = await prisma.storefront.findFirst({
      where: { businessId },
      orderBy: { id: "asc" },
      select: { publishedConfig: true } as any,
    });
    const publishedRaw =
      sf && (sf as any).publishedConfig != null && typeof (sf as any).publishedConfig === "object"
        ? (sf as any).publishedConfig
        : (b as any).storefrontPublishedConfig != null &&
            typeof (b as any).storefrontPublishedConfig === "object"
          ? (b as any).storefrontPublishedConfig
          : {};
    const legacyRaw =
      (b as any).storefrontConfig != null && typeof (b as any).storefrontConfig === "object"
        ? (b as any).storefrontConfig
        : {};
    const rawConfig = publishedRaw && JSON.stringify(publishedRaw) !== "{}" ? publishedRaw : legacyRaw;

    const payload = resolveStorefrontConfig({
      businessId,
      businessType: String((b as any).businessType ?? ""),
      templateId: (b as any).templateId ?? null,
      storefrontConfigVersion: Number((b as any).storefrontConfigVersion ?? 1),
      rawStorefrontConfig: rawConfig ?? {},
      rawThemeConfig: (b as any).themeConfig ?? {},
      rawFeatureFlags: (b as any).featureFlags ?? {},
    });
    (payload as any).storeName = String((b as any).name ?? "").slice(0, 80);
    const slugVal = (b as any).slug;
    (payload as any).storefrontSlug =
      typeof slugVal === "string" && slugVal.trim() !== "" ? String(slugVal).trim() : null;

    if (b != null) {
      const storeAddress = businessAddressRowToPublic(b);
      if (storeAddress != null) {
        (payload as any).storeAddress = storeAddress;
      }
      const telegramOpenUrl = await buildMerchantTelegramOpenUrl({
        id: b.id,
        slug: b.slug,
        botToken: b.botToken,
      });
      if (telegramOpenUrl != null) {
        (payload as any).telegramOpenUrl = telegramOpenUrl;
      }
      const deliveryParsed = parseMerchantDeliverySettings(b.deliverySettings);
      (payload as any).deliveryPolicy = merchantDeliverySettingsToPublic(
        deliveryParsed.ok ? deliveryParsed.value : defaultMerchantDeliverySettings(),
      );
      const availParsed = parseStoreAvailabilitySettings(
        b.storeAvailabilitySettings,
        String(b.businessType ?? ""),
      );
      const availSettings = availParsed.ok
        ? availParsed.value
        : defaultStoreAvailabilitySettings();
      const storeAvailability = storeAvailabilityToPublic(availSettings);
      (payload as any).storeAvailability = storeAvailability;
      (payload as any).deliveryEta = storeAvailability.deliveryEta;
      (payload as any).pickupEta = storeAvailability.pickupEta;
      (payload as any).deliveryZones = storeAvailability.deliveryZones;
    }

    const bt = String((b as any).businessType ?? "").trim() as BusinessType;
    if (bt) {
      const tpl = templateForBusinessType(bt);
      (payload as any).orderOptionsSchema = tpl.orderOptionsSchema ?? {};
    }

    const enabledTypes = new Set(payload.sections.map((s) => s.type));
    if (enabledTypes.has("categories")) {
      const categories = await prisma.category.findMany({
        where: { businessId },
        orderBy: { id: "asc" },
      });
      const nodeById = new Map<number, any>();
      for (const c of categories) {
        nodeById.set(c.id, {
          id: c.id,
          name: c.name,
          parentId: (c as any).parentId ?? null,
          children: [],
        });
      }
      const roots: any[] = [];
      for (const c of categories) {
        const node = nodeById.get(c.id)!;
        const pid = (c as any).parentId ?? null;
        if (pid == null) roots.push(node);
        else {
          const parent = nodeById.get(pid);
          if (parent) parent.children.push(node);
          else roots.push(node);
        }
      }
      (payload as any).categories = roots;
    }

    const featuredPromo = await getFeaturedPromoForStorefront(prisma, businessId);
    if (featuredPromo) {
      (payload as any).featuredPromo = featuredPromo;
    }

    if (enabledTypes.has("featuredProducts")) {
      const sec = payload.sections.find((s) => s.type === "featuredProducts");
      const lim = Number((sec?.config as any)?.limit ?? 8);
      const take = Number.isFinite(lim) && lim > 0 ? Math.min(lim, 24) : 8;
      const products = await prisma.product.findMany({
        where: { businessId },
        orderBy: { id: "desc" },
        take,
      });
      const ids = products.map((p) => p.id);
      const stockMap = await loadStockRowsByProductIds(businessId, ids);
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const soldRows =
        ids.length > 0
          ? await prisma.orderItem.groupBy({
              by: ["productId"],
              where: {
                businessId,
                productId: { in: ids },
                order: { createdAt: { gte: since30d } },
              },
              _sum: { quantity: true },
            })
          : [];
      const soldById = new Map<number, number>();
      for (const r of soldRows) {
        const pid = r.productId;
        if (typeof pid === "number") soldById.set(pid, Number(r._sum.quantity ?? 0) || 0);
      }
      (payload as any).featuredProducts = products.map((p) => {
        const publicProduct = toPublicProduct(p, {
          businessType: bt,
          stockRows: stockMap.get(p.id) ?? [],
        });
        return {
          ...publicProduct,
          sold30d: soldById.get(p.id) ?? 0,
          sold: soldById.get(p.id) ?? 0,
        };
      });
    }

    const payloadOk = safeParseStorefrontPublicApiResponse(payload);
    if (!payloadOk.ok) {
      console.error(
        `GET /api/storefront/${businessId}: payload failed validation:`,
        payloadOk.error,
      );
      res.status(500).json({ error: API_ERR_STOREFRONT_INVALID });
      return;
    }

    setCachedStorefrontPayload({
      businessId,
      payload: payloadOk.data as any,
    });
    res.json(payloadOk.data);
  } catch (e) {
    console.error("GET /api/storefront payload:", e);
    res.status(500).json({ error: API_ERR_SERVER });
  }
}

export function normalizePublicStoreSlug(raw: string): string | null {
  const input = String(raw ?? "").trim();
  if (input === "") return null;
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }
  const normalized = decoded.trim().toLowerCase();
  if (normalized.length < 2 || normalized.length > 80) return null;
  return normalized;
}
