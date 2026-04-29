import type { PaymentSettings, PrismaClient } from "@prisma/client";

export type PaymentDetailRecord = {
  id: number;
  type: string;
  value: string;
};

const ORDER = ["mbank", "optima", "obank", "card", "qr"] as const;
type PayField = (typeof ORDER)[number];

const TYPE_TO_ID: Record<PayField, number> = {
  mbank: 1,
  optima: 2,
  obank: 3,
  card: 4,
  qr: 5,
};

const ID_TO_TYPE = new Map<number, PayField>(
  ORDER.map((t) => [TYPE_TO_ID[t], t])
);

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function fieldValue(
  row: { mbank: string | null; optima: string | null; obank: string | null; card: string | null; qr: string | null },
  type: PayField
): string | null {
  switch (type) {
    case "mbank":
      return row.mbank;
    case "optima":
      return row.optima;
    case "obank":
      return row.obank;
    case "card":
      return row.card;
    case "qr":
      return row.qr;
    default:
      return null;
  }
}

export async function listPaymentDetailsFromDb(
  client: PrismaClient,
  ownerId: number
): Promise<PaymentDetailRecord[]> {
  const row = await client.paymentSettings.findUnique({ where: { ownerId } });
  if (!row) return [];
  const out: PaymentDetailRecord[] = [];
  for (const type of ORDER) {
    const raw = fieldValue(row, type);
    const v = raw?.trim();
    if (v) out.push({ id: TYPE_TO_ID[type], type, value: v });
  }
  return out;
}

export async function upsertPaymentSettings(
  client: PrismaClient,
  ownerId: number,
  body: Record<string, unknown>
): Promise<PaymentSettings> {
  const data = {
    mbank: strOrNull(body.mbank),
    optima: strOrNull(body.optima),
    obank: strOrNull(body.obank),
    card: strOrNull(body.card),
    qr: strOrNull(body.qr),
  };
  return client.paymentSettings.upsert({
    where: { ownerId },
    create: { ownerId, ...data },
    update: data,
  });
}

/** Синтетический id строки списка → очистить поле в настройках. */
export async function clearPaymentFieldByRowId(
  client: PrismaClient,
  ownerId: number,
  rowId: number
): Promise<boolean> {
  const type = ID_TO_TYPE.get(rowId);
  if (!type) return false;
  const exists = await client.paymentSettings.findUnique({ where: { ownerId } });
  if (!exists) return false;
  await client.paymentSettings.update({
    where: { ownerId },
    data: { [type]: null },
  });
  return true;
}
