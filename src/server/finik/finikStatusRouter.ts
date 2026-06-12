import { finikUseMockForBusiness } from "../../shared/finikReady.js";
import {
  getFinikCreateApiMode,
  isOfficialAcquiringSigningConfigured,
} from "./finikCreateConfig.js";
import { fetchLegacyFinikPaymentStatus } from "./legacyStatusAdapter.js";
import { fetchOfficialFinikPaymentStatus } from "./officialAcquiringStatusAdapter.js";
import type {
  FinikPaymentStatusResult,
  FinikStatusApiMode,
  FinikStatusBusinessCredentials,
} from "./finikStatusTypes.js";

export type { FinikPaymentStatusResult, FinikStatusBusinessCredentials };

/** Тот же env, что и create: `FINIK_CREATE_API_MODE` = legacy | official | auto. */
export function getFinikStatusApiMode(): ReturnType<typeof getFinikCreateApiMode> {
  return getFinikCreateApiMode();
}

export function isOfficialAcquiringStatusRoutingAllowed(): boolean {
  const mode = getFinikCreateApiMode();
  if (mode === "legacy") return false;
  if (mode === "official") return true;
  return isOfficialAcquiringSigningConfigured();
}

function resolveStatusApiMode(): FinikStatusApiMode {
  return isOfficialAcquiringStatusRoutingAllowed() ? "official" : "legacy";
}

/**
 * Единая точка запроса статуса платежа (Phase 5-B).
 */
export async function fetchFinikPaymentStatusRouted(
  business: FinikStatusBusinessCredentials,
  paymentId: string,
  queryContext?: { businessId?: number; orderId?: number },
): Promise<FinikPaymentStatusResult> {
  if (finikUseMockForBusiness(business)) {
    return {
      ok: false,
      error: "Finik mock: статус только через webhook",
    };
  }

  const mode = resolveStatusApiMode();
  if (mode === "official") {
    return fetchOfficialFinikPaymentStatus(business, paymentId, queryContext);
  }
  return fetchLegacyFinikPaymentStatus(business, paymentId);
}
