/** Уведомления платформе о заявках на оплату подписки (через первый BOT_TOKEN из .env). */

function rawAdminTelegramIds(): string[] {
  const raw = process.env.ADMIN_IDS ?? "";
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function primaryBotToken(): string | null {
  const multi = process.env.BOT_TOKENS?.split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (multi && multi.length > 0) return multi[0]!;
  const one = process.env.BOT_TOKEN?.trim();
  return one && one.length > 0 ? one : null;
}

export async function notifyPlatformAdminsNewPaymentRequest(input: {
  businessId: number;
  businessName: string;
  paymentRequestId: number;
}): Promise<void> {
  const token = primaryBotToken();
  if (!token) {
    console.warn(
      "[saasBillingNotify] BOT_TOKEN(s) не задан — пропуск уведомления о PaymentRequest",
    );
    return;
  }
  const ids = rawAdminTelegramIds();
  if (ids.length === 0) {
    console.warn(
      "[saasBillingNotify] ADMIN_IDS пуст — некому отправить новую заявку на оплату",
    );
    return;
  }

  const text =
    `📥 Новый платёж подписки\n` +
    `Бизнес: ${input.businessName}\n` +
    `ID: ${input.businessId}\n` +
    `Заявка: ${input.paymentRequestId}`;

  for (const rawId of ids) {
    const chatId = Number(rawId);
    if (!Number.isFinite(chatId) || chatId <= 0) continue;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || json.ok === false) {
        console.error(
          "[saasBillingNotify] sendMessage failed",
          chatId,
          res.status,
          json,
        );
      }
    } catch (e) {
      console.error("[saasBillingNotify] sendMessage", chatId, e);
    }
  }
}
