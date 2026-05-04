/** Разбор `user` из подписанной строки `initData` (если initDataUnsafe.user ещё недоступен). */
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

export function resolveMerchantTelegramUserId(
  tg?: TelegramWebApp | null,
): number {
  if (tg == null) return NaN;
  const unsafe = tg.initDataUnsafe?.user?.id;
  if (typeof unsafe === "number" && Number.isFinite(unsafe) && unsafe > 0) {
    return unsafe;
  }
  const fromInit = parseTelegramUserIdFromInitData(tg.initData);
  return fromInit;
}

/** Telegram Mini App: числовой user id из `initDataUnsafe` или из `initData`. */
export function getWebAppUserId(): number {
  if (typeof window === "undefined") return 0;

  const v = resolveMerchantTelegramUserId(window.Telegram?.WebApp);
  return Number.isFinite(v) && v > 0 ? v : 0;
}
