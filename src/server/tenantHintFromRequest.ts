import type { Request } from "express";

function parseTenantHintInt(raw: unknown): number | null {
  const s =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0].trim()
        : "";
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function trimmedHeader(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s === "" ? undefined : s;
}

/** Tenant hint from request (not initData): query → header → JSON body. */
export function tenantBusinessIdFromRequest(req: Request): number | null {
  const fromBid = parseTenantHintInt(req.query.businessId);
  if (fromBid != null) return fromBid;

  const fromShop = parseTenantHintInt(req.query.shop);
  if (fromShop != null) return fromShop;

  const hRaw = trimmedHeader(req, "x-business-id");
  const fromHeader = hRaw ? parseTenantHintInt(hRaw) : null;
  if (fromHeader != null) return fromHeader;

  const body = req.body as { businessId?: unknown; shop?: unknown } | undefined;
  if (body != null && typeof body === "object") {
    const b = body.businessId;
    if (typeof b === "number" && Number.isInteger(b)) {
      const fb = parseTenantHintInt(String(b));
      if (fb != null) return fb;
    }
    if (typeof b === "string") {
      const fb = parseTenantHintInt(b.trim());
      if (fb != null) return fb;
    }
    const shopB = body.shop;
    if (typeof shopB === "string") {
      const fs = parseTenantHintInt(shopB.trim());
      if (fs != null) return fs;
    }
  }

  return null;
}
