import type { Prisma } from "@prisma/client";
import { orderDisplayLabel } from "../shared/orderDisplay.js";

const DEFAULT_TZ = "Asia/Bishkek";

/** DDMM in tenant-local calendar (e.g. 2105 = 21 May). */
export function formatOrderDayKey(
  date: Date = new Date(),
  timeZone = process.env.ORDER_DAY_TZ?.trim() || DEFAULT_TZ,
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${day}${month}`;
}

export function formatHumanOrderNumber(dayKey: string, seq: number): string {
  return `${dayKey}-${String(seq).padStart(3, "0")}`;
}

type Tx = Pick<Prisma.TransactionClient, "businessDailyOrderCounter">;

/** Allocate next daily sequence for a business (must run inside order transaction). */
export async function allocateHumanOrderNumber(
  tx: Tx,
  businessId: number,
  at: Date = new Date(),
): Promise<string> {
  const dayKey = formatOrderDayKey(at);
  await tx.businessDailyOrderCounter.upsert({
    where: { businessId_dayKey: { businessId, dayKey } },
    create: { businessId, dayKey, lastSeq: 0 },
    update: {},
  });
  const row = await tx.businessDailyOrderCounter.update({
    where: { businessId_dayKey: { businessId, dayKey } },
    data: { lastSeq: { increment: 1 } },
  });
  return formatHumanOrderNumber(dayKey, row.lastSeq);
}

export { orderDisplayLabel };

export function formatNewOrderTelegramMessage(input: {
  orderNumber: string;
  customerName: string;
  phone: string;
  total: number;
  itemCount: number;
}): string {
  const label = input.orderNumber.startsWith("#")
    ? input.orderNumber
    : `#${input.orderNumber}`;
  return (
    `🛒 Новый заказ\n\n` +
    `${label}\n\n` +
    `👤 ${input.customerName}\n` +
    `📞 ${input.phone}\n` +
    `💰 ${input.total} сом\n\n` +
    `Товаров: ${input.itemCount}`
  );
}
