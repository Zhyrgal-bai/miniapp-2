import { afterEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import { signFinikOfficialRequest } from "../../src/server/finik/finikRsaSigning.js";
import {
  verifyFinikOfficialWebhookRsa,
  verifyFinikWebhookAdmission,
} from "../../src/server/finik/finikWebhookVerify.js";
import { reloadFinikKeysFromEnv } from "../../src/server/finik/finikKeys.js";

describe("finikWebhookVerify", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    reloadFinikKeysFromEnv();
  });

  it("legacy HMAC still accepted in production mode", async () => {
    const { createHmac } = await import("node:crypto");
    process.env.NODE_ENV = "production";
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = "x-finik-signature";
    delete process.env.FINIK_PUBLIC_KEY;

    const secret = "merchant-secret";
    const rawBody = '{"paymentId":"p1","status":"paid"}';
    const sig = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const req = {
      headers: {
        host: "api.example.com",
        "x-finik-signature": sig,
      },
    } as unknown as Request;

    const out = await verifyFinikWebhookAdmission({
      finikSecret: secret,
      req,
      rawBody,
      body: JSON.parse(rawBody) as Record<string, unknown>,
      webhookPath: "/finik/webhook/7",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.mode).toBe("legacy_hmac");
  });

  it("official RSA roundtrip when FINIK_PUBLIC_KEY is set", async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privatePem = pair.privateKey.export({ type: "pkcs1", format: "pem" }) as string;
    const publicPem = pair.publicKey.export({ type: "spki", format: "pem" }) as string;

    process.env.NODE_ENV = "production";
    process.env.FINIK_PRIVATE_KEY = privatePem;
    process.env.FINIK_PUBLIC_KEY = publicPem;
    process.env.FINIK_API_KEY = "api-key-test";
    reloadFinikKeysFromEnv();

    const body = {
      transactionId: "tx-webhook-1",
      status: "SUCCEEDED",
      amount: 100,
    };
    const path = "/finik/webhook/7";
    const host = "api.example.com";

    const signed = await signFinikOfficialRequest({
      host,
      path,
      apiKey: "api-key-test",
      body,
    });

    const req = {
      headers: {
        host,
        "x-api-key": "api-key-test",
        "x-api-timestamp": signed.timestamp,
        signature: signed.signature,
      },
    } as unknown as Request;

    expect(
      await verifyFinikOfficialWebhookRsa(req, path, body, publicPem),
    ).toBe(true);

    const admission = await verifyFinikWebhookAdmission({
      finikSecret: null,
      req,
      rawBody: signed.bodyJson,
      body,
      webhookPath: path,
    });
    expect(admission.ok).toBe(true);
    if (admission.ok) expect(admission.mode).toBe("official_rsa");
  });
});
