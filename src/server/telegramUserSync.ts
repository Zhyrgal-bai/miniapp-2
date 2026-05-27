import type { User } from "@prisma/client";
import { prisma } from "./db.js";

export async function syncTelegramUserProfile(input: {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
}): Promise<User> {
  const telegramId = String(input.telegramId ?? "").trim();
  if (!/^\d+$/.test(telegramId)) {
    throw new Error("BAD_TELEGRAM_ID");
  }

  const usernameRaw =
    typeof input.username === "string" ? input.username.trim().replace(/^@+/, "") : "";
  const username = usernameRaw !== "" ? usernameRaw.toLowerCase() : null;

  const nameParts = [input.firstName, input.lastName]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  const displayName = nameParts.join(" ").trim();

  const photoUrl =
    typeof input.photoUrl === "string" && input.photoUrl.trim() !== ""
      ? input.photoUrl.trim()
      : null;

  return prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      name: displayName !== "" ? displayName : null,
      telegramUsername: username,
      photoUrl,
    },
    update: {
      ...(displayName !== "" ? { name: displayName } : {}),
      ...(username != null ? { telegramUsername: username } : {}),
      ...(photoUrl != null ? { photoUrl } : {}),
    },
  });
}
