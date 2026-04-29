/** QR с payload `MBANK_<сумма>` (api.qrserver.com). */
export function mbankOrderQrImageUrl(orderTotal: number): string {
  const data = `MBANK_${orderTotal}`;
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}`;
}

export function mbankPaymentQrCaption(orderId: number, orderTotal: number): string {
  return (
    `💳 Оплата заказа #${orderId}\n\n` +
    `Сумма: ${orderTotal} сом\n\n` +
    `Сканируйте QR`
  );
}
