/**
 * Нормализация статуса платежа Finik (legacy JSON + official acquiring + webhook aliases).
 */

const STATUS_FIELD_KEYS = [
  "status",
  "payment_status",
  "state",
  "paymentStatus",
  "Status",
] as const;

const AMOUNT_FIELD_KEYS = [
  "amount",
  "total",
  "sum",
  "payment_amount",
  "Amount",
] as const;

function pickString(json: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const v = json[key];
    if (typeof v === "string" && v.trim() !== "") {
      return v.trim();
    }
  }
  return "";
}

function pickAmountFromRecord(json: Record<string, unknown>): number | null {
  for (const key of AMOUNT_FIELD_KEYS) {
    const raw = json[key];
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.round(n);
  }
  const fields =
    typeof json.fields === "object" && json.fields !== null
      ? (json.fields as Record<string, unknown>)
      : null;
  if (fields != null) {
    const fromFields = fields.amount ?? fields.Amount;
    if (fromFields != null) {
      const n = Number(fromFields);
      if (Number.isFinite(n)) return Math.round(n);
    }
  }
  return null;
}

function nestedPayloadRecords(
  json: Record<string, unknown>,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [json];
  for (const key of ["data", "Data", "result", "payment", "Payment"] as const) {
    const raw = json[key];
    if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
      out.push(raw as Record<string, unknown>);
    }
  }
  return out;
}

export function normalizeFinikPaymentStatusResponse(
  json: Record<string, unknown>,
): { status: string; amount: number | null } {
  for (const record of nestedPayloadRecords(json)) {
    const statusRaw = pickString(record, STATUS_FIELD_KEYS);
    if (statusRaw !== "") {
      return {
        status: statusRaw.toLowerCase(),
        amount: pickAmountFromRecord(record) ?? pickAmountFromRecord(json),
      };
    }
  }
  return { status: "", amount: pickAmountFromRecord(json) };
}

/** Diagnostic-only: fields inspected when status parse fails (no logic change). */
export function diagnoseFinikPaymentStatusParse(json: Record<string, unknown>): {
  candidateStatusFields: Record<string, unknown>;
  extractedStatus: string;
} {
  const candidateStatusFields: Record<string, unknown> = {};
  for (const record of nestedPayloadRecords(json)) {
    for (const key of STATUS_FIELD_KEYS) {
      if (key in record) {
        candidateStatusFields[key] = record[key];
      }
    }
    for (const nestKey of ["data", "Data", "result", "payment", "Payment"] as const) {
      const nested = record[nestKey];
      if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
        for (const key of STATUS_FIELD_KEYS) {
          const nk = `${nestKey}.${key}`;
          if (key in (nested as Record<string, unknown>)) {
            candidateStatusFields[nk] = (nested as Record<string, unknown>)[key];
          }
        }
      }
    }
  }
  const normalized = normalizeFinikPaymentStatusResponse(json);
  return {
    candidateStatusFields,
    extractedStatus: normalized.status,
  };
}
