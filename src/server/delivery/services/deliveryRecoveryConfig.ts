const DEFAULT_RECOVERY_INTERVAL_MS = 120_000;
const DEFAULT_RECOVERY_STALE_MS = 300_000;
const DEFAULT_RECOVERY_BATCH_SIZE = 50;
const DEFAULT_RECOVERY_MAX_ATTEMPTS = 8;
const DEFAULT_RECOVERY_RETRY_BASE_MS = 30_000;
const DEFAULT_RECOVERY_RETRY_MAX_MS = 3_600_000;

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envPositiveInt(name: string, fallback: number, max?: number): number {
  const raw = envTrim(name);
  if (raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const rounded = Math.floor(n);
  if (max != null) return Math.min(rounded, max);
  return rounded;
}

export function isDeliveryRecoveryEnabled(): boolean {
  const v = envTrim("DELIVERY_RECOVERY_ENABLED");
  return v === "1" || v === "true" || v === "on";
}

export function getDeliveryRecoveryIntervalMs(): number {
  return envPositiveInt("DELIVERY_RECOVERY_INTERVAL_MS", DEFAULT_RECOVERY_INTERVAL_MS, 3_600_000);
}

export function getDeliveryRecoveryStaleMs(): number {
  return envPositiveInt("DELIVERY_RECOVERY_STALE_MS", DEFAULT_RECOVERY_STALE_MS, 86_400_000);
}

export function getDeliveryRecoveryBatchSize(): number {
  return envPositiveInt("DELIVERY_RECOVERY_BATCH_SIZE", DEFAULT_RECOVERY_BATCH_SIZE, 500);
}

export function getDeliveryRecoveryMaxAttempts(): number {
  return envPositiveInt("DELIVERY_RECOVERY_MAX_ATTEMPTS", DEFAULT_RECOVERY_MAX_ATTEMPTS, 50);
}

export function getDeliveryRecoveryRetryBaseMs(): number {
  return envPositiveInt("DELIVERY_RECOVERY_RETRY_BASE_MS", DEFAULT_RECOVERY_RETRY_BASE_MS, 3_600_000);
}

export function getDeliveryRecoveryRetryMaxMs(): number {
  return envPositiveInt("DELIVERY_RECOVERY_RETRY_MAX_MS", DEFAULT_RECOVERY_RETRY_MAX_MS, 86_400_000);
}
