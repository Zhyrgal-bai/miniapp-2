const DEFAULT_MBANK_PHONE = "0556996312";

/** Номер MBank для подсказки и копирования (можно задать `VITE_MBANK_PHONE` в `.env`). */
export function getMbankPaymentPhone(): string {
  const v = import.meta.env.VITE_MBANK_PHONE;
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return DEFAULT_MBANK_PHONE;
}

/** QR с фиксированной суммой заказа (api.qrserver.com, 250×250). */
export function mbankOrderQrImageUrl(orderTotal: number): string {
  const amount = Math.round(Number(orderTotal)) || 0;
  const data = `MBANK_PAYMENT_${amount}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}`;
}
