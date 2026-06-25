import type { Request, Response } from "express";
import { getYandexDeliveryWebhookSecret } from "../services/yandexDeliveryConfig.js";
import {
  defaultYandexWebhookService,
  verifyYandexWebhookSecret,
  type YandexWebhookService,
} from "../services/YandexWebhookService.js";
import { logDeliveryWebhookFailed } from "../utils/yandexWebhookLogging.js";

function parseClaimId(req: Request): string {
  const fromQuery = req.query.claim_id;
  if (typeof fromQuery === "string" && fromQuery.trim() !== "") {
    return fromQuery.trim();
  }
  const body = req.body as { claim_id?: unknown } | undefined;
  if (body && typeof body.claim_id === "string" && body.claim_id.trim() !== "") {
    return body.claim_id.trim();
  }
  return "";
}

function parseUpdatedTs(req: Request): string {
  const fromQuery = req.query.updated_ts;
  if (typeof fromQuery === "string") return fromQuery.trim();
  const body = req.body as { updated_ts?: unknown } | undefined;
  if (body && typeof body.updated_ts === "string") return body.updated_ts.trim();
  return "";
}

function extractBearerToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const token = req.query.token;
  if (typeof token === "string") return token.trim();
  return undefined;
}

function isAcceptableContentType(req: Request): boolean {
  const ct = req.headers["content-type"];
  if (!ct) return true;
  const lower = ct.toLowerCase();
  return (
    lower.includes("application/json") ||
    lower.includes("application/x-www-form-urlencoded") ||
    lower === ""
  );
}

export type YandexWebhookControllerDeps = {
  webhookService?: YandexWebhookService;
  webhookSecret?: () => string;
};

export function createYandexWebhookController(deps: YandexWebhookControllerDeps = {}) {
  const webhookService = deps.webhookService ?? defaultYandexWebhookService;
  const webhookSecret = deps.webhookSecret ?? getYandexDeliveryWebhookSecret;

  return async function handleYandexDeliveryWebhook(
    req: Request,
    res: Response,
  ): Promise<void> {
    if (!isAcceptableContentType(req)) {
      logDeliveryWebhookFailed({ code: "invalid_content_type", httpStatus: 415 });
      res.status(415).json({ ok: false, code: "invalid_content_type" });
      return;
    }

    const secret = webhookSecret();
    const token = extractBearerToken(req);
    if (!verifyYandexWebhookSecret(token, secret)) {
      logDeliveryWebhookFailed({ code: "unauthorized", httpStatus: 401 });
      res.status(401).json({ ok: false, code: "unauthorized" });
      return;
    }

    const claimId = parseClaimId(req);
    const updatedTs = parseUpdatedTs(req);

    if (claimId === "") {
      logDeliveryWebhookFailed({ code: "missing_claim_id", httpStatus: 400 });
      res.status(400).json({ ok: false, code: "missing_claim_id" });
      return;
    }

    const result = await webhookService.processWebhook({ claimId, updatedTs });

    if (!result.ok) {
      res.status(result.httpStatus).json({ ok: false, code: result.code });
      return;
    }

    res.status(200).json({
      ok: true,
      duplicate: result.duplicate,
      ...(result.orderId != null ? { orderId: result.orderId } : {}),
    });
  };
}

export const handleYandexDeliveryWebhook = createYandexWebhookController();
