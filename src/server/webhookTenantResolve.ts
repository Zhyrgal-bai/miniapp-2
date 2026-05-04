import { prisma } from "./db.js";
import {
  isHexWebhookSlug,
  legacyNumericWebhookPathEnabled,
} from "./telegramWebhookSecurity.js";

/**
 * По сегменту пути находит tenant (business id): сначала уникальный токен, опционально — legacy числовой id.
 */
export async function resolveBusinessIdFromWebhookSlug(
  slugRaw: string,
): Promise<number | null> {
  const slug = String(slugRaw ?? "").trim();
  if (slug === "") return null;

  if (isHexWebhookSlug(slug)) {
    const row = await prisma.business.findUnique({
      where: { webhookRouteToken: slug },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  if (legacyNumericWebhookPathEnabled() && /^\d+$/.test(slug)) {
    const id = Number(slug);
    if (!Number.isInteger(id) || id <= 0) return null;
    return id;
  }

  return null;
}
