import { finikUseMockForBusiness } from "../../shared/finikReady.js";
import { platformFinikUseMockForCreate } from "../../shared/platformFinik.js";
import {
  getFinikCreateApiMode,
  isOfficialAcquiringRoutingAllowed,
} from "./finikCreateConfig.js";
import {
  logFinikCreateAttempt,
  logFinikCreateResult,
} from "./finikCreateLogging.js";
import { legacyCreateAdapter } from "./legacyCreateAdapter.js";
import { mockCreateAdapter } from "./mockCreateAdapter.js";
import { officialAcquiringCreateAdapter } from "./officialAcquiringCreateAdapter.js";
import type {
  FinikCreateApiModeUsed,
  FinikCreateContext,
  FinikCreatePort,
  FinikCreateResult,
} from "./finikCreateTypes.js";

function businessIdFromContext(ctx: FinikCreateContext): number | undefined {
  return ctx.tenant.kind === "business" ? ctx.tenant.businessId : undefined;
}

function shouldUseMock(ctx: FinikCreateContext): boolean {
  if (ctx.tenant.kind === "business") {
    return finikUseMockForBusiness({
      finikApiKey: ctx.tenant.finikApiKey,
      finikAccountId: ctx.tenant.finikAccountId,
    });
  }
  return platformFinikUseMockForCreate();
}

function resolveCreateAdapter(ctx: FinikCreateContext): FinikCreatePort {
  const mode = getFinikCreateApiMode();
  if (shouldUseMock(ctx)) {
    return mockCreateAdapter;
  }
  if (isOfficialAcquiringRoutingAllowed()) {
    return officialAcquiringCreateAdapter;
  }
  return legacyCreateAdapter;
}

/**
 * Единая точка create payment (Phase 3 scaffold).
 * Production checkout пока вызывает `finikMerchant` напрямую — этот router для тестов и будущей миграции.
 */
export async function createFinikPaymentSession(
  ctx: FinikCreateContext,
): Promise<FinikCreateResult> {
  const configuredMode = getFinikCreateApiMode();
  const adapter = resolveCreateAdapter(ctx);
  const selectedAdapter: FinikCreateApiModeUsed = adapter.apiMode;
  const businessId = businessIdFromContext(ctx);

  logFinikCreateAttempt({
    configuredMode,
    selectedAdapter,
    flow: ctx.flow,
    ...(businessId != null ? { businessId } : {}),
    ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
  });

  const result = await adapter.createPaymentSession(ctx);

  logFinikCreateResult({
    configuredMode,
    apiMode: result.ok ? result.apiMode : (result.apiMode ?? selectedAdapter),
    flow: ctx.flow,
    ok: result.ok,
    ...(businessId != null ? { businessId } : {}),
    ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
    ...(!result.ok && result.code ? { errorCode: result.code } : {}),
  });

  return result;
}

export { getFinikCreateApiMode } from "./finikCreateConfig.js";
export {
  isOfficialAcquiringRoutingAllowed,
  isOfficialAcquiringSigningConfigured,
} from "./finikCreateConfig.js";
