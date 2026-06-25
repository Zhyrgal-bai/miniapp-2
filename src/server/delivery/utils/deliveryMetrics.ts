const counters = {
  delivery_created_total: 0,
  delivery_completed_total: 0,
  delivery_failed_total: 0,
  delivery_retry_total: 0,
  delivery_recovered_total: 0,
  provider_timeout_total: 0,
  provider_rate_limit_total: 0,
  provider_webhook_total: 0,
  delivery_manual_refresh_total: 0,
  delivery_recovery_total: 0,
  delivery_export_total: 0,
  delivery_search_total: 0,
  delivery_timeline_total: 0,
  checkout_delivery_live_total: 0,
  checkout_delivery_merchant_fallback_total: 0,
  checkout_delivery_unavailable_total: 0,
  checkout_delivery_provider_selected: 0,
};

export type DeliveryMetricName = keyof typeof counters;

export function incrementDeliveryMetric(name: DeliveryMetricName, by = 1): void {
  counters[name] += by;
}

export function getDeliveryMetricsSnapshot(): Readonly<typeof counters> {
  return { ...counters };
}

export function resetDeliveryMetricsForTests(): void {
  for (const key of Object.keys(counters) as DeliveryMetricName[]) {
    counters[key] = 0;
  }
}
