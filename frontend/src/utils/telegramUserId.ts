/** Telegram Mini App: числовой id пользователя из `initDataUnsafe` (без React / store). */
export function getWebAppUserId(): number {
  if (typeof window === "undefined") return 0;

  const rawId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

  return Number(rawId);
}
