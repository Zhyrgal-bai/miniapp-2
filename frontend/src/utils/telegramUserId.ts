/** Разбор `user` из подписанной строки `initData` (официальный WebApp.initData). */
export function parseTelegramUserIdFromInitData(initData?: string): number {
  if (typeof initData !== "string" || initData.trim() === "") return NaN;
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw?.trim()) return NaN;
    const parsed = JSON.parse(raw) as { id?: unknown };
    const idRaw = parsed?.id;
    const id =
      typeof idRaw === "number"
        ? idRaw
        : typeof idRaw === "string"
          ? Number(idRaw.trim())
          : NaN;
    return Number.isFinite(id) && id > 0 ? Math.trunc(id) : NaN;
  } catch {
    return NaN;
  }
}

/** Только подписанный `initData` (без initDataUnsafe). */
export function resolveMerchantTelegramUserId(
  tg?: TelegramWebApp | null,
): number {
  if (tg == null) return NaN;
  return parseTelegramUserIdFromInitData(tg.initData);
}

/** Telegram Mini App: числовой user.id из строки `initData`. */
export function getWebAppUserId(): number {
  if (typeof window === "undefined") return 0;

  const v = resolveMerchantTelegramUserId(window.Telegram?.WebApp);
  return Number.isFinite(v) && v > 0 ? v : 0;
}
