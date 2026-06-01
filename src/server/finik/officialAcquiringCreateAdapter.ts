import { getOfficialAcquiringCreateUrl } from "./finikCreateConfig.js";
import { emitStructuredLog } from "../structuredLog.js";
import type {
  FinikCreateContext,
  FinikCreatePort,
  FinikCreateResult,
} from "./finikCreateTypes.js";

/**
 * Official Acquiring API (`POST …/payment`) — Phase 3 scaffold only.
 * RSA signing и тело запроса — в следующем релизе после спецификации Finik.
 */
export const officialAcquiringCreateAdapter: FinikCreatePort = {
  apiMode: "official",

  async createPaymentSession(ctx: FinikCreateContext): Promise<FinikCreateResult> {
    emitStructuredLog("warn", "finik_official_create_skipped", {
      reason: "scaffold_not_implemented",
      flow: ctx.flow,
      targetUrl: getOfficialAcquiringCreateUrl(),
      ...(ctx.tenant.kind === "business"
        ? { businessId: ctx.tenant.businessId }
        : {}),
      ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
    });

    return {
      ok: false,
      error:
        "Official Finik Acquiring create не реализован (Phase 3 scaffold). Используйте FINIK_CREATE_API_MODE=legacy.",
      code: "finik_official_not_implemented",
      apiMode: "official",
    };
  },
};
