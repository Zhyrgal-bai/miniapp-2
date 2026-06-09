/**
 * Web showcase presenters (Phase 17) — pure helpers for the public business
 * website built over the existing storefront payload + merchant web profile.
 */

export type WebProfileView = {
  coverUrl: string | null;
  slogan: string | null;
  story: string | null;
  accentColor: string | null;
  social: {
    instagram: string | null;
    telegram: string | null;
    whatsapp: string | null;
    website: string | null;
  };
};

export type SocialLink = {
  id: "instagram" | "telegram" | "whatsapp" | "website";
  label: string;
  href: string;
};

function instagramHref(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@+/, "")}`;
}

function telegramHref(handle: string): string {
  return `https://t.me/${handle.replace(/^@+/, "")}`;
}

function whatsappHref(value: string): string {
  const digits = value.replace(/\D+/g, "");
  return `https://wa.me/${digits}`;
}

/** Build clickable social links from a web profile. */
export function resolveSocialLinks(
  profile: WebProfileView | null | undefined,
): SocialLink[] {
  if (profile == null) return [];
  const out: SocialLink[] = [];
  const s = profile.social;
  if (s.instagram) out.push({ id: "instagram", label: "Instagram", href: instagramHref(s.instagram) });
  if (s.telegram) out.push({ id: "telegram", label: "Telegram", href: telegramHref(s.telegram) });
  if (s.whatsapp) out.push({ id: "whatsapp", label: "WhatsApp", href: whatsappHref(s.whatsapp) });
  if (s.website) out.push({ id: "website", label: "Сайт", href: s.website });
  return out;
}

/** CSS custom properties for the showcase accent color (falls back to theme). */
export function showcaseAccentVars(
  profile: WebProfileView | null | undefined,
): Record<string, string> {
  if (profile?.accentColor == null) return {};
  return { ["--sf-showcase-accent" as string]: profile.accentColor };
}

export function hasShowcaseContent(profile: WebProfileView | null | undefined): boolean {
  if (profile == null) return false;
  return (
    profile.coverUrl != null ||
    profile.slogan != null ||
    profile.story != null ||
    resolveSocialLinks(profile).length > 0
  );
}
