import { timingSafeEqual } from "node:crypto";
import {
  createDeliveryRefreshService,
  type DeliveryRefreshService,
} from "../../../services/DeliveryRefreshService.js";
import {
  hashClaimId,
  logDeliveryWebhookFailed,
  logDeliveryWebhookReceived,
} from "../utils/yandexWebhookLogging.js";
import { incrementDeliveryMetric } from "../../../utils/deliveryMetrics.js";

export type YandexWebhookInput = {
  claimId: string;
  updatedTs: string;
};

export type YandexWebhookProcessResult =
  | { ok: true; duplicate: boolean; orderId?: number }
  | { ok: false; code: string; httpStatus: number };

export type YandexWebhookServiceDeps = {
  refreshService?: DeliveryRefreshService;
};

function parseWebhookUpdatedAt(updatedTs: string): Date {
  const trimmed = updatedTs.trim();
  if (trimmed === "") return new Date();
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum > 1_000_000_000) {
    const ms = asNum > 1_000_000_000_000 ? asNum : asNum * 1000;
    return new Date(ms);
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed) : new Date();
}

export class YandexWebhookService {
  private readonly refreshService: DeliveryRefreshService;

  constructor(deps: YandexWebhookServiceDeps = {}) {
    this.refreshService = deps.refreshService ?? createDeliveryRefreshService();
  }

  async processWebhook(input: YandexWebhookInput): Promise<YandexWebhookProcessResult> {
    const started = Date.now();
    const claimId = input.claimId.trim();
    const updatedTs = input.updatedTs.trim();

    incrementDeliveryMetric("provider_webhook_total");

    if (claimId === "") {
      logDeliveryWebhookFailed({ code: "missing_claim_id", httpStatus: 400 });
      return { ok: false, code: "missing_claim_id", httpStatus: 400 };
    }

    logDeliveryWebhookReceived({
      claimIdHash: hashClaimId(claimId),
      updatedTs,
      durationMs: Date.now() - started,
    });

    const webhookKey =
      updatedTs !== "" ? `${claimId}:${updatedTs}` : `${claimId}:${Date.now()}`;
    const fallbackUpdatedAt = parseWebhookUpdatedAt(updatedTs);

    const result = await this.refreshService.refreshClaim(claimId, {
      fallbackUpdatedAt,
      idempotencyKey: webhookKey,
      source: "webhook",
    }).catch(() => ({
      ok: false as const,
      code: "persist_failed",
      error: "persist_failed",
      retryable: false,
    }));

    if (!result.ok) {
      if (result.code === "persist_failed") {
        logDeliveryWebhookFailed({ code: "persist_failed", claimId, httpStatus: 500 });
        return { ok: false, code: "persist_failed", httpStatus: 500 };
      }
      if (result.code === "claim_not_found") {
        logDeliveryWebhookFailed({ code: "claim_not_found", claimId, httpStatus: 200 });
        return { ok: true, duplicate: false };
      }
      if (result.code === "unknown_status") {
        logDeliveryWebhookFailed({ code: "unknown_status", claimId, httpStatus: 200 });
        return {
          ok: true,
          duplicate: false,
          ...("orderId" in result && result.orderId != null
            ? { orderId: result.orderId }
            : {}),
        };
      }
      logDeliveryWebhookFailed({ code: result.code, claimId, httpStatus: 200 });
      return {
        ok: true,
        duplicate: false,
        ...("orderId" in result && result.orderId != null
          ? { orderId: result.orderId }
          : {}),
      };
    }

    return {
      ok: true,
      duplicate: result.duplicate,
      orderId: result.orderId,
    };
  }
}

export const defaultYandexWebhookService = new YandexWebhookService();

export function verifyYandexWebhookSecret(
  provided: string | undefined,
  expected: string,
): boolean {
  if (expected === "") return true;
  const token = (provided ?? "").trim();
  if (token === "") return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
