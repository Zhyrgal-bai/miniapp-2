import type { TelegramMiniAppUser } from "./telegram";

export function telegramDisplayInitial(user: TelegramMiniAppUser | null): string {
  if (!user) return "?";
  const a = user.first_name?.trim()?.charAt(0);
  const b = user.username?.trim()?.charAt(0);
  return (a || b || "?").toUpperCase();
}

export function telegramDisplayName(user: TelegramMiniAppUser | null): string {
  if (!user) return "Гость";
  return (
    user.first_name?.trim() ||
    (user.username ? `@${user.username}` : "Гость")
  );
}
