import type { ProviderHealthMetrics, ProviderHealthState } from "./types/deliveryEngineTypes.js";

type ProviderStats = {
  totalRequests: number;
  successes: number;
  failures: number;
  timeouts: number;
  rateLimits: number;
  serverErrors: number;
  webhookSuccess: number;
  recoveryEvents: number;
  responseTimeSumMs: number;
  responseTimeCount: number;
};

const statsByProvider = new Map<string, ProviderStats>();

function emptyStats(): ProviderStats {
  return {
    totalRequests: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    rateLimits: 0,
    serverErrors: 0,
    webhookSuccess: 0,
    recoveryEvents: 0,
    responseTimeSumMs: 0,
    responseTimeCount: 0,
  };
}

function getStats(providerId: string): ProviderStats {
  let s = statsByProvider.get(providerId);
  if (!s) {
    s = emptyStats();
    statsByProvider.set(providerId, s);
  }
  return s;
}

export type ProviderHealthEvent =
  | { type: "success"; responseTimeMs?: number }
  | { type: "failure" }
  | { type: "timeout" }
  | { type: "rate_limit" }
  | { type: "server_error" }
  | { type: "webhook" }
  | { type: "recovery" };

export function recordProviderHealthEvent(
  providerId: string,
  event: ProviderHealthEvent,
): void {
  const s = getStats(providerId);
  s.totalRequests += 1;

  switch (event.type) {
    case "success":
      s.successes += 1;
      if (event.responseTimeMs != null) {
        s.responseTimeSumMs += event.responseTimeMs;
        s.responseTimeCount += 1;
      }
      break;
    case "failure":
      s.failures += 1;
      break;
    case "timeout":
      s.timeouts += 1;
      s.failures += 1;
      break;
    case "rate_limit":
      s.rateLimits += 1;
      s.failures += 1;
      break;
    case "server_error":
      s.serverErrors += 1;
      s.failures += 1;
      break;
    case "webhook":
      s.webhookSuccess += 1;
      break;
    case "recovery":
      s.recoveryEvents += 1;
      break;
  }
}

function computeState(metrics: Omit<ProviderHealthMetrics, "state">): ProviderHealthState {
  if (metrics.totalRequests === 0) return "HEALTHY";
  if (metrics.failureRate >= 0.5 || metrics.timeoutPercent >= 40) return "UNAVAILABLE";
  if (metrics.failureRate >= 0.2 || metrics.timeoutPercent >= 15 || metrics.rateLimit429Percent >= 20) {
    return "DEGRADED";
  }
  return "HEALTHY";
}

export function getProviderHealthMetrics(providerId: string): ProviderHealthMetrics {
  const s = getStats(providerId);
  const total = Math.max(s.totalRequests, 1);
  const successRate = s.successes / total;
  const failureRate = s.failures / total;

  const base = {
    providerId,
    successRate: Math.round(successRate * 1000) / 1000,
    failureRate: Math.round(failureRate * 1000) / 1000,
    averageResponseTimeMs:
      s.responseTimeCount > 0
        ? Math.round(s.responseTimeSumMs / s.responseTimeCount)
        : null,
    timeoutPercent: Math.round((s.timeouts / total) * 1000) / 10,
    recoveryPercent: Math.round((s.recoveryEvents / total) * 1000) / 10,
    webhookPercent: Math.round((s.webhookSuccess / total) * 1000) / 10,
    rateLimit429Percent: Math.round((s.rateLimits / total) * 1000) / 10,
    serverError503Percent: Math.round((s.serverErrors / total) * 1000) / 10,
    totalRequests: s.totalRequests,
  };

  return {
    ...base,
    state: computeState(base),
  };
}

export function resetProviderHealthForTests(): void {
  statsByProvider.clear();
}

export class ProviderHealthService {
  record(providerId: string, event: ProviderHealthEvent): void {
    recordProviderHealthEvent(providerId, event);
  }

  getMetrics(providerId: string): ProviderHealthMetrics {
    return getProviderHealthMetrics(providerId);
  }

  getAllMetrics(): ProviderHealthMetrics[] {
    return [...statsByProvider.keys()].map(getProviderHealthMetrics);
  }
}

export const defaultProviderHealthService = new ProviderHealthService();
