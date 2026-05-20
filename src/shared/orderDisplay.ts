/** Human-facing order label; legacy orders fall back to internal id. */
export function orderDisplayLabel(order: {
  id: number;
  orderNumber?: string | null;
}): string {
  const raw = order.orderNumber?.trim();
  if (raw) return raw.startsWith("#") ? raw : `#${raw}`;
  return `#${order.id}`;
}
