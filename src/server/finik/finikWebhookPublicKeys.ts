/**
 * Finik Acquiring webhook verification keys (Finik signs inbound webhooks).
 * @see https://telegra.ph/Finikkg-09-10 — Payments Status Webhook
 *
 * FINIK_PUBLIC_KEY in ENV is the merchant/platform key pair registered WITH Finik
 * for outbound API signing — NOT the key used to verify inbound webhooks.
 */

/** Production — published by Finik (Telegraph). */
export const FINIK_ACQUIRING_PROD_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF/PUmhMPPidcMxhZBPb
BSGJoSphmCI+h6ru8fG8guAlcPMVlhs+ThTjw2LHABvciwtpj51ebJ4EqhlySPyT
hqSfXI6Jp5dPGJNDguxfocohaz98wvT+WAF86DEglZ8dEsfoumojFUy5sTOBdHEu
g94B4BbrJvjmBa1YIx9Azse4HFlWhzZoYPgyQpArhokeHOHIN2QFzJqeriANO+wV
aUMta2AhRVZHbfyJ36XPhGO6A5FYQWgjzkI65cxZs5LaNFmRx6pjnhjIeVKKgF99
4OoYCzhuR9QmWkPl7tL4Kd68qa/xHLz0Psnuhm0CStWOYUu3J7ZpzRK8GoEXRcr8
tQIDAQAB
-----END PUBLIC KEY-----`;

/** Beta — published by Finik (Telegraph). */
export const FINIK_ACQUIRING_BETA_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwlrlKz/8gLWd1ARWGA/8
o3a3Qy8G+hPifyqiPosiTY6nCHovANMIJXk6DH4qAqqZeLu8pLGxudkPbv8dSyG7
F9PZEAryMPzjoB/9P/F6g0W46K/FHDtwTM3YIVvstbEbL19m8yddv/xCT9JPPJTb
LsSTVZq5zCqvKzpupwlGS3Q3oPyLAYe+ZUn4Bx2J1WQrBu3b08fNaR3E8pAkCK27
JqFnP0eFfa817VCtyVKcFHb5ij/D0eUP519Qr/pgn+gsoG63W4pPHN/pKwQUUiAy
uLSHqL5S2yu1dffyMcMVi9E/Q2HCTcez5OvOllgOtkNYHSv9pnrMRuws3u87+hNT
ZwIDAQAB
-----END PUBLIC KEY-----`;

function normalizeEnvPem(raw: string | undefined): string {
  const v = raw?.trim() ?? "";
  if (v === "") return "";
  return v.replace(/\\n/g, "\n");
}

function resolveAcquiringHostHint(): "prod" | "beta" | "unknown" {
  const raw = (
    process.env.FINIK_WEBHOOK_PUBLIC_KEY_ENV?.trim() ||
    process.env.FINIK_API_URL?.trim() ||
    process.env.FINIK_OFFICIAL_ACQUIRING_BASE_URL?.trim() ||
    ""
  ).toLowerCase();
  if (raw.includes("beta.api.acquiring")) return "beta";
  if (raw.includes("api.acquiring.averspay.kg")) return "prod";
  return "unknown";
}

/** PEM for verifying Finik → merchant webhook signatures. */
export function getFinikWebhookVerifyPublicKey(): string {
  const explicit = normalizeEnvPem(
    process.env.FINIK_WEBHOOK_PUBLIC_KEY ??
      process.env.FINIK_ACQUIRING_WEBHOOK_PUBLIC_KEY,
  );
  if (explicit !== "") return explicit;

  const hint = resolveAcquiringHostHint();
  if (hint === "prod") return FINIK_ACQUIRING_PROD_WEBHOOK_PUBLIC_KEY;
  if (hint === "beta") return FINIK_ACQUIRING_BETA_WEBHOOK_PUBLIC_KEY;

  return "";
}

export function isFinikWebhookVerifyPublicKeyConfigured(): boolean {
  return getFinikWebhookVerifyPublicKey() !== "";
}
