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
        name: true,
        slug: true,
        isActive: true,
        isBlocked: true,
        businessType: true,
        templateId: true,
        themeConfig: true,
        storefrontConfig: true,
        storefrontPublishedConfig: true,
        storefrontConfigVersion: true,
        featureFlags: true,
      } as any,
    });
    if (!b) {
      res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
      return;
    }
    if (!(b as any).isActive || (b as any).isBlocked) {
      res.status(403).json({ error: API_ERR_STORE_UNAVAILABLE });
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
