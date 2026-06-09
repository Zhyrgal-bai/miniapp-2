/**
 * ARCHA founder configuration (Phase 17.1).
 *
 * Reusable, presentation-only data for the landing founder section. No URLs are
 * hardcoded inside components — they live here and can be overridden via env.
 * Social links are configurable and future-extensible; disabled ones are hidden.
 */

export type FounderSocialId = "instagram" | "telegram" | "github";

export type FounderSocial = {
  id: FounderSocialId;
  label: string;
  href: string;
  enabled: boolean;
};

function envUrl(key: string, fallback: string): string {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : fallback;
}

/** Public assets with non-ASCII names must be referenced URL-encoded. */
const FOUNDER_PHOTO = encodeURI("/Жыргал.jpeg");

const INSTAGRAM_URL = envUrl("VITE_ARCHA_FOUNDER_INSTAGRAM", "https://instagram.com/archa.kg");
const TELEGRAM_URL = envUrl("VITE_ARCHA_FOUNDER_TELEGRAM", "https://t.me/archa_kg_bot");
const GITHUB_URL = envUrl("VITE_ARCHA_FOUNDER_GITHUB", "");

export const ARCHA_FOUNDER = {
  name: "Жыргал",
  badge: "Основатель ARCHA",
  sectionTitle: "Создано в Кыргызстане 🇰🇬",
  sectionSubtitle: "ARCHA — современная платформа для бизнеса в Telegram.",
  description:
    "ARCHA создаётся как единая платформа для малого бизнеса, объединяя Telegram, современные веб-витрины, CRM, маркетинг, аналитику и удобные онлайн-платежи.",
  photo: FOUNDER_PHOTO,
  photoAlt: "Основатель ARCHA — Жыргал",
  socials: [
    { id: "instagram", label: "Instagram", href: INSTAGRAM_URL, enabled: INSTAGRAM_URL !== "" },
    { id: "telegram", label: "Telegram", href: TELEGRAM_URL, enabled: TELEGRAM_URL !== "" },
    { id: "github", label: "GitHub", href: GITHUB_URL, enabled: GITHUB_URL !== "" },
  ] as FounderSocial[],
} as const;

/** Only the social links that are configured/enabled. */
export function enabledFounderSocials(): FounderSocial[] {
  return ARCHA_FOUNDER.socials.filter((s) => s.enabled && s.href.trim() !== "");
}
