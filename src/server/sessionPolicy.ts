/**
 * Session / auth policy constants — documentation + structured reject reasons.
 * Operator session storage unchanged; see platformOperatorAuth.ts.
 */

export const OPERATOR_SESSION_TTL_MIN_DEFAULT = 20;
export const OPERATOR_REAUTH_WINDOW_MIN_DEFAULT = 5;

export type AuthRejectReason =
  | "expired_initdata"
  | "invalid_signature"
  | "replay"
  | "no_staff"
  | "missing_init_data"
  | "invalid_auth_date"
  | "tenant_access_denied";

export function operatorSessionTtlMinutes(): number {
  const raw = process.env.OPERATOR_SESSION_TTL_MIN?.trim();
  const n = raw ? Number(raw) : OPERATOR_SESSION_TTL_MIN_DEFAULT;
  if (!Number.isFinite(n)) return OPERATOR_SESSION_TTL_MIN_DEFAULT;
  return Math.min(30, Math.max(15, Math.floor(n)));
}

export function operatorReauthWindowMinutes(): number {
  const raw = process.env.OPERATOR_REAUTH_WINDOW_MIN?.trim();
  const n = raw ? Number(raw) : OPERATOR_REAUTH_WINDOW_MIN_DEFAULT;
  if (!Number.isFinite(n)) return OPERATOR_REAUTH_WINDOW_MIN_DEFAULT;
  return Math.max(1, Math.floor(n));
}
