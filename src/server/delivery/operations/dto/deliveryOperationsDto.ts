/** Safe DTO helpers — redact secrets and PII for logs/responses. */

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function sanitizeExportRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  delete out.providerPayload;
  delete out.courierPhone;
  delete out.courierLat;
  delete out.courierLng;
  delete out.address;
  if (typeof out.phone === "string") {
    out.phone = maskPhone(out.phone);
  }
  return out;
}
