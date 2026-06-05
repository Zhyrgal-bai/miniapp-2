/** ARCHA platform branding — static assets in `/public`. */
export const ARCHA_BRAND = {
  name: "ARCHA",
  title: "ARCHA — Telegram Commerce Platform",
  tagline: "Сделано в Кыргызстане 🇰🇬",
  /** Icon + wordmark (registration, headers). */
  logoMark: "/лого.png",
  /** Horizontal lockup (wide placements). */
  logoText: "/text.png",
  /** Hero / splash art with tagline. */
  splashArt: "/image.png",
  /** Decorative background. */
  background: "/фон.png",
  /** Favicon + PWA icons (icon-only, from brand sheet). */
  favicon: "/favicon2.png",
  icon192: "/archa-icon-192.png",
  icon512: "/archa-icon-512.png",
  themeColor: "#0a120a",
  backgroundColor: "#050805",
  heroTagline: "Платформа для интернет-магазинов внутри Telegram",
  /** Официальный бот платформы ARCHA (не канал @archa_kg). */
  telegramBotUsername: "archa_kg_bot",
  telegramBotHandle: "@archa_kg_bot",
  /** Deep link для входа / Mini App с веб-лендинга и FAQ. */
  telegramLoginUrl:
    typeof import.meta.env.VITE_ARCHA_TELEGRAM_BOT_URL === "string" &&
    import.meta.env.VITE_ARCHA_TELEGRAM_BOT_URL.trim() !== ""
      ? import.meta.env.VITE_ARCHA_TELEGRAM_BOT_URL.trim()
      : "https://t.me/archa_kg_bot",
} as const;

/** @deprecated Use ARCHA_BRAND.telegramLoginUrl */
export const ARCHA_PLATFORM_TELEGRAM_URL = ARCHA_BRAND.telegramLoginUrl;
export const ARCHA_PLATFORM_TELEGRAM_HANDLE = ARCHA_BRAND.telegramBotHandle;
