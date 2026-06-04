/**
 * RSA-SHA256 подпись Finik Official Acquiring (@mancho.devs/authorizer).
 * @see https://telegra.ph/Finikkg-09-10/index
 */
import { readFileSync } from "node:fs";
import { Signer } from "@mancho.devs/authorizer";
import { isFinikOfficialPrivateKeyConfigured } from "../../shared/finikReady.js";
import { getFinikPrivateKey } from "./finikKeys.js";

/** Тело запроса Finik (совместимо с @mancho.devs/authorizer RequestData.body). */
export type FinikOfficialRequestBody = Record<string, unknown>;

type FinikSignerRequestData = {
  httpMethod: string;
  path: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: null;
  body: FinikOfficialRequestBody;
};

function normalizePem(raw: string): string {
  const v = raw.trim();
  if (v === "") return "";
  return v.replace(/\\n/g, "\n");
}

/** PEM private key: FINIK_RSA_* → FINIK_PRIVATE_KEY (platform test). */
export function loadFinikRsaPrivateKeyPem(): string {
  const rsaInline = process.env.FINIK_RSA_PRIVATE_KEY?.trim() ?? "";
  if (rsaInline !== "") return normalizePem(rsaInline);

  const fromPlatform = getFinikPrivateKey();
  if (fromPlatform !== "") return fromPlatform;

  const path = process.env.FINIK_RSA_PRIVATE_KEY_PATH?.trim() ?? "";
  if (path !== "") {
    return readFileSync(path, "utf8");
  }
  return "";
}

/** Алиас для finikCreateConfig / router (см. shared/finikReady). */
export function isFinikRsaPrivateKeyConfigured(): boolean {
  return isFinikOfficialPrivateKeyConfigured();
}

/** Тело запроса в том же виде, что подписывает Signer (top-level key sort). */
export function canonicalFinikRequestBody(
  body: FinikOfficialRequestBody,
): string {
  const sortedBody = Object.entries(body)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<FinikOfficialRequestBody>((result, [key, value]) => {
      result[key] = value;
      return result;
    }, {});
  return JSON.stringify(sortedBody);
}

export type FinikOfficialSignInput = {
  host: string;
  path: string;
  apiKey: string;
  body: FinikOfficialRequestBody;
};

export type FinikOfficialSignGetInput = {
  host: string;
  path: string;
  apiKey: string;
};

export type FinikOfficialSignedRequest = {
  signature: string;
  timestamp: string;
  bodyJson: string;
};

/**
 * Подпись POST official create (как в Node-примере Finik / authorizer).
 */
export async function signFinikOfficialRequest(
  input: FinikOfficialSignInput,
): Promise<FinikOfficialSignedRequest> {
  const privateKey = loadFinikRsaPrivateKeyPem();
  if (privateKey === "") {
    throw new Error("Finik RSA private key is not configured");
  }

  const timestamp = Date.now().toString();
  const requestData: FinikSignerRequestData = {
    httpMethod: "POST",
    path: input.path,
    headers: {
      Host: input.host,
      "x-api-key": input.apiKey,
      "x-api-timestamp": timestamp,
    },
    queryStringParameters: null,
    body: input.body,
  };

  const signature = await new Signer(requestData).sign(privateKey);
  const bodyJson = canonicalFinikRequestBody(input.body);

  return { signature, timestamp, bodyJson };
}

/**
 * Подпись GET official status (пустое тело `{}` в canonical string).
 */
export async function signFinikOfficialGetRequest(
  input: FinikOfficialSignGetInput,
): Promise<{ signature: string; timestamp: string }> {
  const privateKey = loadFinikRsaPrivateKeyPem();
  if (privateKey === "") {
    throw new Error("Finik RSA private key is not configured");
  }

  const timestamp = Date.now().toString();
  const requestData: FinikSignerRequestData = {
    httpMethod: "GET",
    path: input.path,
    headers: {
      Host: input.host,
      "x-api-key": input.apiKey,
      "x-api-timestamp": timestamp,
    },
    queryStringParameters: null,
    body: {},
  };

  const signature = await new Signer(requestData).sign(privateKey);
  return { signature, timestamp };
}
