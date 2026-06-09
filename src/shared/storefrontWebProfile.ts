/**
 * Storefront web profile (Phase 17.7) — pure, additive merchant branding for
 * the public showcase website. Stored inside the existing `merchantConfig` JSON
 * (`merchantConfig.webProfile`) so there is no new column / no duplicate profile
 * system. Presentation-only — never affects checkout/orders/CRM.
 */

export type WebProfileSocialLinks = {
  instagram: string | null;
  telegram: string | null;
  whatsapp: string | null;
  website: string | null;
};

export type WebProfile = {
  coverUrl: string | null;
  slogan: string | null;
  story: string | null;
  /** Accent color hex (#rrggbb) for showcase header; falls back to theme. */
  accentColor: string | null;
  social: WebProfileSocialLinks;
};

const MAX_SLOGAN = 160;
const MAX_STORY = 2000;
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  if (t === "") return null;
  return t.slice(0, maxLen);
}

function cleanMultiline(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t === "") return null;
  return t.slice(0, maxLen);
}

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t === "" || !URL_RE.test(t)) return null;
  return t.slice(0, 500);
}

function cleanAccent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return HEX_RE.test(t) ? t : null;
}

/** Strip a leading @ and whitespace from a social handle. */
function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().replace(/^@+/, "");
  if (t === "") return null;
  return t.slice(0, 120);
}

export function emptyWebProfile(): WebProfile {
  return {
    coverUrl: null,
    slogan: null,
    story: null,
    accentColor: null,
    social: { instagram: null, telegram: null, whatsapp: null, website: null },
  };
}

/** Normalize arbitrary input into a safe WebProfile. */
export function normalizeWebProfile(input: unknown): WebProfile {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return emptyWebProfile();
  }
  const obj = input as Record<string, unknown>;
  const socialRaw =
    obj.social != null && typeof obj.social === "object" && !Array.isArray(obj.social)
      ? (obj.social as Record<string, unknown>)
      : {};
  return {
    coverUrl: cleanUrl(obj.coverUrl),
    slogan: cleanText(obj.slogan, MAX_SLOGAN),
    story: cleanMultiline(obj.story, MAX_STORY),
    accentColor: cleanAccent(obj.accentColor),
    social: {
      instagram: cleanHandle(socialRaw.instagram),
      telegram: cleanHandle(socialRaw.telegram),
      whatsapp: cleanHandle(socialRaw.whatsapp),
      website: cleanUrl(socialRaw.website),
    },
  };
}

/** Extract the web profile from a merchantConfig JSON object. */
export function extractWebProfile(
  merchantConfig: Record<string, unknown> | null | undefined,
): WebProfile {
  if (merchantConfig == null || typeof merchantConfig !== "object") {
    return emptyWebProfile();
  }
  return normalizeWebProfile((merchantConfig as Record<string, unknown>).webProfile);
}

/** Merge a normalized web profile back into a merchantConfig object (immutably). */
export function mergeWebProfileIntoMerchantConfig(
  merchantConfig: Record<string, unknown> | null | undefined,
  profile: WebProfile,
): Record<string, unknown> {
  const base =
    merchantConfig != null && typeof merchantConfig === "object" && !Array.isArray(merchantConfig)
      ? { ...(merchantConfig as Record<string, unknown>) }
      : {};
  base.webProfile = profile;
  return base;
}

/** True when the profile carries any merchant-provided branding. */
export function webProfileHasContent(profile: WebProfile): boolean {
  return (
    profile.coverUrl != null ||
    profile.slogan != null ||
    profile.story != null ||
    profile.accentColor != null ||
    profile.social.instagram != null ||
    profile.social.telegram != null ||
    profile.social.whatsapp != null ||
    profile.social.website != null
  );
}
