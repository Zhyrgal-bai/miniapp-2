/**
 * Верификация Finik webhook: legacy HMAC (secret) + official RSA (Finik public key).
 */
import { Signer } from "@mancho.devs/authorizer";
import type { Request } from "express";
import { verifyFinikWebhookSignature } from "../finikWebhookCrypto.js";
import {
  getFinikWebhookVerifyPublicKey,
  isFinikWebhookVerifyPublicKeyConfigured,
} from "./finikWebhookPublicKeys.js";
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

/** @deprecated use isFinikWebhookVerifyPublicKeyConfigured */
export function isFinikOfficialPublicKeyConfigured(): boolean {
  return isFinikWebhookVerifyPublicKeyConfigured();
}

function resolveWebhookHostCandidates(req: Request): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (h: string) => {
    const v = h.trim();
    if (v === "" || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };

  push(headerString(req, "host"));

  const apiUrl = (process.env.API_URL ?? process.env.RENDER_EXTERNAL_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (apiUrl !== "") {
    try {
      push(new URL(apiUrl).host);
    } catch {
      /* fall through */
    }
  }

  const forwarded = headerString(req, "x-forwarded-host");
  if (forwarded !== "") {
    push(forwarded.split(",")[0]?.trim() ?? "");
  }

  return out;
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

function parseWebhookVerifyBody(
  rawBody: string,
  body: Record<string, unknown>,
): FinikOfficialRequestBody {
  if (rawBody.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as FinikOfficialRequestBody;
      }
    } catch {
      /* fall through */
    }
  }
  return body;
}

async function verifyFinikOfficialWebhookRsaOnce(input: {
  req: Request;
  webhookPath: string;
  body: FinikOfficialRequestBody;
  host: string;
  publicKeyPem: string;
}): Promise<boolean> {
  const signature = headerString(input.req, "signature");
  const timestamp = headerString(input.req, "x-api-timestamp");
  if (signature === "" || timestamp === "") return false;

  const path = input.webhookPath.startsWith("/")
    ? input.webhookPath
    : `/${input.webhookPath}`;

  try {
    return await new Signer({
      httpMethod: "POST",
      path,
      headers: buildOfficialWebhookHeaders(input.req, input.host),
      queryStringParameters: null,
      body: input.body,
    }).verify(input.publicKeyPem, signature);
  } catch {
    return false;
  }
}

/**
 * Official Acquiring: RSA-SHA256 (`signature` + `x-api-timestamp`, @mancho.devs/authorizer).
 * Uses Finik's published webhook public key — not the merchant outbound FINIK_PUBLIC_KEY.
 */
export async function verifyFinikOfficialWebhookRsa(
  req: Request,
  webhookPath: string,
  body: FinikOfficialRequestBody,
  rawBody?: string,
  publicKeyPem?: string,
): Promise<boolean> {
  const publicKey = (publicKeyPem ?? getFinikWebhookVerifyPublicKey()).trim();
  if (publicKey === "") return false;

  const hosts = resolveWebhookHostCandidates(req);
  if (hosts.length === 0) return false;

  const bodies: FinikOfficialRequestBody[] = [];
  const fromRaw =
    rawBody != null && rawBody.trim() !== ""
      ? parseWebhookVerifyBody(rawBody, body)
      : body;
  bodies.push(fromRaw);
  if (fromRaw !== body) bodies.push(body);

  for (const host of hosts) {
    for (const verifyBody of bodies) {
      const ok = await verifyFinikOfficialWebhookRsaOnce({
        req,
        webhookPath,
        body: verifyBody,
        host,
        publicKeyPem: publicKey,
      });
      if (ok) return true;
    }
  }
  return false;
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
  const canOfficial = isFinikWebhookVerifyPublicKeyConfigured();

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
      input.rawBody,
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
