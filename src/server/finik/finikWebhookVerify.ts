/**
 * Верификация Finik webhook: legacy HMAC (secret) + official RSA (public key).
 */
import { Signer } from "@mancho.devs/authorizer";
import type { Request } from "express";
import { verifyFinikWebhookSignature } from "../finikWebhookCrypto.js";
import { getFinikPublicKey } from "./finikKeys.js";
import {
  isFinikPlatformManagedMerchantsEnabled,
  isMerchantFinikPlatformManaged,
} from "./resolveFinikTenantCredentials.js";
import type { FinikOfficialRequestBody } from "./finikRsaSigning.js";

export type FinikWebhookVerifyMode = "legacy_hmac" | "official_rsa" | "dev_skip";

export type FinikWebhookVerifyResult =
  | { ok: true; mode: FinikWebhookVerifyMode }
  | { ok: false; reason: string };

function headerString(req: Request, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

export function isFinikOfficialPublicKeyConfigured(): boolean {
  return getFinikPublicKey() !== "";
}

function resolveWebhookHost(req: Request): string {
  const hostHeader = headerString(req, "host");
  if (hostHeader !== "") return hostHeader;

  const apiUrl = (process.env.API_URL ?? process.env.RENDER_EXTERNAL_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (apiUrl !== "") {
    try {
      return new URL(apiUrl).host;
    } catch {
      /* fall through */
    }
  }
  return "";
}

function buildOfficialWebhookHeaders(
  req: Request,
  host: string,
): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = { Host: host };
  const timestamp = headerString(req, "x-api-timestamp");
  if (timestamp !== "") headers["x-api-timestamp"] = timestamp;
  const apiKey = headerString(req, "x-api-key");
  if (apiKey !== "") headers["x-api-key"] = apiKey;
  return headers;
}

/**
 * Official Acquiring: RSA-SHA256 (`signature` + `x-api-timestamp`, @mancho.devs/authorizer).
 */
export async function verifyFinikOfficialWebhookRsa(
  req: Request,
  webhookPath: string,
  body: FinikOfficialRequestBody,
  publicKeyPem?: string,
): Promise<boolean> {
  const publicKey = (publicKeyPem ?? getFinikPublicKey()).trim();
  if (publicKey === "") return false;

  const signature = headerString(req, "signature");
  const timestamp = headerString(req, "x-api-timestamp");
  if (signature === "" || timestamp === "") return false;

  const host = resolveWebhookHost(req);
  if (host === "") return false;

  const path = webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`;

  try {
    return await new Signer({
      httpMethod: "POST",
      path,
      headers: buildOfficialWebhookHeaders(req, host),
      queryStringParameters: null,
      body,
    }).verify(publicKey, signature);
  } catch {
    return false;
  }
}

function hasLegacyHmacMaterial(
  finikSecret: string | null | undefined,
  req: Request,
): boolean {
  if (!finikSecret?.trim()) return false;
  const legacyHeader = (
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER || "x-finik-signature"
  )
    .trim()
    .toLowerCase();
  return headerString(req, legacyHeader) !== "";
}

function hasOfficialRsaMaterial(req: Request): boolean {
  return (
    headerString(req, "signature") !== "" &&
    headerString(req, "x-api-timestamp") !== ""
  );
}

/**
 * Допуск webhook: legacy HMAC если есть secret; иначе official RSA если есть public key.
 * Legacy магазины не ломаются — HMAC проверяется первым.
 */
export async function verifyFinikWebhookAdmission(input: {
  finikSecret: string | null | undefined;
  finikApiKey?: string | null | undefined;
  finikAccountId?: string | null | undefined;
  req: Request;
  rawBody: string;
  body: Record<string, unknown>;
  webhookPath: string;
}): Promise<FinikWebhookVerifyResult> {
  const isProd = process.env.NODE_ENV === "production";
  const platformManaged =
    isFinikPlatformManagedMerchantsEnabled() &&
    isMerchantFinikPlatformManaged({
      finikApiKey: input.finikApiKey,
      finikAccountId: input.finikAccountId,
      finikSecret: input.finikSecret,
    });
  const canLegacy = !platformManaged && !!input.finikSecret?.trim();
  const canOfficial = isFinikOfficialPublicKeyConfigured();

  if (isProd && !canLegacy && !canOfficial) {
    return { ok: false, reason: "no_verify_credentials" };
  }

  if (canLegacy && hasLegacyHmacMaterial(input.finikSecret, input.req)) {
    if (
      verifyFinikWebhookSignature(
        input.finikSecret ?? null,
        input.req,
        input.rawBody,
      )
    ) {
      return { ok: true, mode: "legacy_hmac" };
    }
  }

  if (canOfficial && hasOfficialRsaMaterial(input.req)) {
    const ok = await verifyFinikOfficialWebhookRsa(
      input.req,
      input.webhookPath,
      input.body,
    );
    if (ok) return { ok: true, mode: "official_rsa" };
  }

  if (!isProd) {
    if (!canLegacy && !canOfficial) {
      return { ok: true, mode: "dev_skip" };
    }
    if (!hasLegacyHmacMaterial(input.finikSecret, input.req) && !hasOfficialRsaMaterial(input.req)) {
      return { ok: true, mode: "dev_skip" };
    }
  }

  return { ok: false, reason: "invalid_signature" };
}
