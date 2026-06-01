/**
 * Нормализация ответа create payment (legacy + official field aliases).
 * Phase 3 scaffold: legacy paths активны; official paths — заготовка под beta API.
 */

export type FinikCreateResponseFieldMap = {
  paymentId: readonly string[];
  paymentUrl: readonly string[];
};

/** Legacy HTTP `/payments` (текущий finikMerchant). */
export const LEGACY_FINIK_CREATE_RESPONSE_MAP: FinikCreateResponseFieldMap = {
  paymentId: ["payment_id", "id", "paymentId"],
  paymentUrl: ["payment_url", "url", "checkout_url"],
};

/**
 * Official Acquiring beta — уточнить у Finik; пока гипотеза + legacy fallback.
 * @see docs/integrations/finik-acquiring.md
 */
export const OFFICIAL_FINIK_CREATE_RESPONSE_MAP: FinikCreateResponseFieldMap = {
  paymentId: [
    "transactionId",
    "transaction_id",
    "itemId",
    "item_id",
    "paymentId",
    "payment_id",
    "id",
  ],
  paymentUrl: [
    "paymentUrl",
    "payment_url",
    "shortUrl",
    "short_url",
    "checkoutUrl",
    "checkout_url",
    "url",
  ],
};

function pickStringField(
  json: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const v = json[key];
    if (typeof v === "string" && v.trim() !== "") {
      return v.trim();
    }
  }
  return "";
}

export type NormalizedFinikCreateResponse =
  | { ok: true; paymentId: string; paymentUrl: string }
  | { ok: false; error: string };

export function normalizeFinikCreateResponse(
  json: Record<string, unknown>,
  map: FinikCreateResponseFieldMap,
): NormalizedFinikCreateResponse {
  const paymentId = pickStringField(json, map.paymentId);
  const paymentUrl = pickStringField(json, map.paymentUrl);
  if (!paymentId || !paymentUrl) {
    return {
      ok: false,
      error: "Finik: неверный ответ API (ожидаются payment id и url)",
    };
  }
  return { ok: true, paymentId, paymentUrl };
}

export function normalizeLegacyFinikCreateResponse(
  json: Record<string, unknown>,
): NormalizedFinikCreateResponse {
  return normalizeFinikCreateResponse(json, LEGACY_FINIK_CREATE_RESPONSE_MAP);
}

export function normalizeOfficialFinikCreateResponse(
  json: Record<string, unknown>,
): NormalizedFinikCreateResponse {
  return normalizeFinikCreateResponse(json, OFFICIAL_FINIK_CREATE_RESPONSE_MAP);
}
