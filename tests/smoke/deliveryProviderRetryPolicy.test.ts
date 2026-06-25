import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeNextRetryAt,
  isRetryableProviderError,
  shouldMoveToDeadLetter,
} from "../../src/server/delivery/providers/deliveryProviderRetryPolicy.js";

describe("deliveryProviderRetryPolicy", () => {
  beforeEach(() => {
    vi.stubEnv("DELIVERY_RECOVERY_MAX_ATTEMPTS", "8");
    vi.stubEnv("DELIVERY_RECOVERY_RETRY_BASE_MS", "30000");
    vi.stubEnv("DELIVERY_RECOVERY_RETRY_MAX_MS", "3600000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats 429 and 503 as retryable", () => {
    expect(isRetryableProviderError("api_error", 429)).toBe(true);
    expect(isRetryableProviderError("api_error", 503)).toBe(true);
    expect(isRetryableProviderError("rate_limited")).toBe(true);
    expect(isRetryableProviderError("timeout")).toBe(true);
  });

  it("treats 400/401/404 as non-retryable", () => {
    expect(isRetryableProviderError("validation_error", 400)).toBe(false);
    expect(isRetryableProviderError("api_error", 401)).toBe(false);
    expect(isRetryableProviderError("api_error", 404)).toBe(false);
    expect(isRetryableProviderError("not_configured")).toBe(false);
  });

  it("computes backoff within bounds", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const next = computeNextRetryAt(3, now);
    const delayMs = next.getTime() - now.getTime();
    expect(delayMs).toBeGreaterThanOrEqual(30_000);
    expect(delayMs).toBeLessThanOrEqual(3_600_000);
  });

  it("moves to dead letter at max attempts", () => {
    expect(shouldMoveToDeadLetter(7)).toBe(false);
    expect(shouldMoveToDeadLetter(8)).toBe(true);
  });
});
