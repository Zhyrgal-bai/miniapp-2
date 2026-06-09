/**
 * SPA HTML meta injection (Phase 17.5).
 *
 * Reads the built Vite index.html once, and for crawlable routes (/s/:slug,
 * /merchant) injects per-store SEO/OG/canonical tags built from existing data.
 * Fully additive: any failure falls back to the unmodified index.html.
 */

import fs from "node:fs";
import type { Request } from "express";
import { prisma } from "./db.js";
import {
  buildLandingSeoMeta,
  buildStoreSeoMeta,
  renderSeoMetaTags,
  type SeoMeta,
} from "../shared/storefrontSeoMeta.js";
import { extractWebProfile } from "../shared/storefrontWebProfile.js";
import { normalizePublicStoreSlug } from "./storefrontPublicPayload.js";
import { resolveSlugOrAlias } from "./merchantSlugService.js";

let cachedBaseHtml: string | null = null;
let cachedBaseHtmlPath: string | null = null;

function loadBaseHtml(indexPath: string): string | null {
  if (cachedBaseHtml != null && cachedBaseHtmlPath === indexPath) {
    return cachedBaseHtml;
  }
  try {
    const html = fs.readFileSync(indexPath, "utf8");
    cachedBaseHtml = html;
    cachedBaseHtmlPath = indexPath;
    return html;
  } catch {
    return null;
  }
}

function injectMeta(baseHtml: string, meta: SeoMeta): string {
  const tags = renderSeoMetaTags(meta);
  // Drop the static <title> so ours wins, then insert before </head>.
  const withoutTitle = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, "");
  if (withoutTitle.includes("</head>")) {
    return withoutTitle.replace("</head>", `    ${tags}\n  </head>`);
  }
  return withoutTitle;
}

function requestOrigin(req: Request): string {
  const envOrigin = String(process.env.PUBLIC_WEB_ORIGIN ?? "").trim();
  if (envOrigin !== "") return envOrigin.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers.host ?? "";
  return host ? `${proto}://${host}` : "";
}

function parseSlugFromPath(pathname: string): string | null {
  const m = /^\/(?:s|store)\/([^/?#]+)/i.exec(pathname);
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * Build enriched HTML for a request, or null to fall back to the static SPA.
 * Never throws.
 */
export async function renderSpaHtmlWithMeta(
  req: Request,
  indexPath: string,
): Promise<string | null> {
  try {
    const baseHtml = loadBaseHtml(indexPath);
    if (baseHtml == null) return null;
    const origin = requestOrigin(req);

    const rawSlug = parseSlugFromPath(req.path);
    if (rawSlug != null) {
      const slug = normalizePublicStoreSlug(rawSlug);
      if (slug == null) return null;
      const businessId = await resolveSlugOrAlias(slug);
      if (businessId == null) return null;

      const biz = await prisma.business.findUnique({
        where: { id: businessId },
        select: {
          name: true,
          slug: true,
          city: true,
          themeConfig: true,
          merchantConfig: true,
        },
      });
      if (biz == null) return null;

      const webProfile = extractWebProfile(
        (biz.merchantConfig as Record<string, unknown> | null) ?? null,
      );
      const theme = (biz.themeConfig as Record<string, unknown> | null) ?? {};
      const logoUrl =
        webProfile.coverUrl ??
        (typeof theme.logoUrl === "string" && theme.logoUrl.trim() !== ""
          ? String(theme.logoUrl)
          : null);
      const canonicalSlug = (biz.slug ?? slug).toLowerCase();
      const canonicalUrl = origin ? `${origin}/s/${canonicalSlug}` : null;

      const meta = buildStoreSeoMeta({
        storeName: biz.name ?? null,
        slogan: webProfile.slogan,
        description: webProfile.story ?? webProfile.slogan,
        city: biz.city ?? null,
        imageUrl: logoUrl,
        canonicalUrl,
        telegramUrl: null,
      });
      return injectMeta(baseHtml, meta);
    }

    if (req.path === "/merchant" || req.path === "/") {
      const canonicalUrl = origin ? `${origin}/merchant` : null;
      return injectMeta(baseHtml, buildLandingSeoMeta(canonicalUrl));
    }

    return null;
  } catch (e) {
    console.error("[storefrontHtmlMeta] inject failed:", e);
    return null;
  }
}

/** Routes eligible for meta injection. */
export function isMetaInjectablePath(pathname: string): boolean {
  return (
    /^\/(?:s|store)\/[^/?#]+/i.test(pathname) ||
    pathname === "/merchant" ||
    pathname === "/"
  );
}
