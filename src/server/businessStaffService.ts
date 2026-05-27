import { BusinessStaffRole, Prisma } from "@prisma/client";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import {
  defaultPermissionsForStaffRole,
  sanitizeMerchantPermissionInput,
} from "./merchantPermissions.js";
import {
  INVITE_STAFF_ROLES,
  normalizeTelegramUsername,
  parseStaffRole,
  staffDisplayName,
} from "../shared/staffRoles.js";

export type StaffPublicRow = {
  staffId: number;
  userId: number;
  role: BusinessStaffRole;
  permissions: string[];
  name: string;
  username: string | null;
  photoUrl: string | null;
};

export type StaffLookupStatus =
  | "ready"
  | "already_staff"
  | "needs_bot_contact"
  | "bot_not_configured";

export type StaffPreview = {
  name: string;
  username: string;
  photoUrl: string | null;
  alreadyStaff: boolean;
  lookupStatus: StaffLookupStatus;
  canInviteNow: boolean;
  hasPendingInvite: boolean;
  botLink: string | null;
  userId: number | null;
};

type TelegramChat = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

async function merchantBotToken(businessId: number): Promise<string | null> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { botToken: true },
  });
  if (!b?.botToken) return null;
  try {
    const tok = plainBotTokenFromStored(b.botToken).trim();
    return tok === "" ? null : tok;
  } catch {
    return null;
  }
}

async function telegramGetChat(
  botToken: string,
  username: string,
): Promise<TelegramChat | null> {
  const chatId = `@${normalizeTelegramUsername(username)}`;
  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getChat?chat_id=${encodeURIComponent(chatId)}`;
  try {
    const res = await fetch(url);
    const json = (await res.json()) as {
      ok?: boolean;
      result?: TelegramChat;
      description?: string;
    };
    if (!json.ok || !json.result?.id) return null;
    return json.result;
  } catch {
    return null;
  }
}

async function merchantBotUsername(botToken: string): Promise<string | null> {
  try {
    const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getMe`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    const u = json.result?.username;
    if (!json.ok || typeof u !== "string" || u.trim() === "") return null;
    return u.trim();
  } catch {
    return null;
  }
}

async function findUserByTelegramUsername(normalized: string) {
  return prisma.user.findFirst({
    where: { telegramUsername: { equals: normalized, mode: "insensitive" } },
    select: {
      id: true,
      telegramId: true,
      name: true,
      telegramUsername: true,
      photoUrl: true,
    },
  });
}

async function hasPendingStaffInvite(
  businessId: number,
  normalized: string,
): Promise<boolean> {
  const row = await prisma.staffInvite.findFirst({
    where: {
      businessId,
      telegramUsername: normalized,
      status: "PENDING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  return row != null;
}

function previewFromUser(
  user: {
    id: number;
    name: string | null;
    telegramUsername: string | null;
    photoUrl: string | null;
  },
  alreadyStaff: boolean,
  lookupStatus: StaffLookupStatus,
  botLink: string | null,
  hasPendingInvite = false,
): StaffPreview {
  const handle = user.telegramUsername
    ? `@${normalizeTelegramUsername(user.telegramUsername)}`
    : "";
  return {
    name: staffDisplayName({
      name: user.name,
      telegramUsername: user.telegramUsername,
    }),
    username: handle !== "" ? handle : `@${normalizeTelegramUsername(user.telegramUsername ?? "")}`,
    photoUrl: user.photoUrl ?? null,
    alreadyStaff,
    lookupStatus,
    canInviteNow: !alreadyStaff && lookupStatus === "ready",
    hasPendingInvite,
    botLink,
    userId: user.id,
  };
}

export async function acceptPendingStaffInvitesForUser(input: {
  businessId: number;
  userId: number;
  telegramUsername: string | null;
}): Promise<number> {
  const normalized = normalizeTelegramUsername(input.telegramUsername ?? "");
  if (normalized === "") return 0;

  const pending = await prisma.staffInvite.findMany({
    where: {
      businessId: input.businessId,
      telegramUsername: normalized,
      status: "PENDING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { id: "desc" },
  });
  if (pending.length === 0) return 0;

  let accepted = 0;
  for (const inv of pending) {
    if (inv.role === BusinessStaffRole.OWNER) continue;
    if (!INVITE_STAFF_ROLES.includes(inv.role)) continue;

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.businessStaff.findUnique({
          where: {
            userId_businessId: {
              userId: input.userId,
              businessId: input.businessId,
            },
          },
        });
        if (existing) {
          await tx.staffInvite.update({
            where: { id: inv.id },
            data: { status: "ACCEPTED" },
          });
          return;
        }

        await tx.businessStaff.create({
          data: {
            businessId: input.businessId,
            userId: input.userId,
            role: inv.role,
            permissions: defaultPermissionsForStaffRole(inv.role),
            invitedByUserId: inv.invitedByUserId,
          },
        });
        await tx.staffInvite.update({
          where: { id: inv.id },
          data: { status: "ACCEPTED" },
        });
      });
      accepted += 1;
    } catch {
      /* skip conflicting row */
    }
  }
  return accepted;
}

export async function createPendingStaffInvite(input: {
  businessId: number;
  invitedByUserId: number;
  username: string;
  role: BusinessStaffRole;
}): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
  if (input.role === BusinessStaffRole.OWNER) {
    return { ok: false, error: "Нельзя назначить роль владельца", statusCode: 400 };
  }
  if (!INVITE_STAFF_ROLES.includes(input.role)) {
    return { ok: false, error: "Недопустимая роль", statusCode: 400 };
  }

  const normalized = normalizeTelegramUsername(input.username);
  if (normalized === "") {
    return { ok: false, error: "Укажите @username", statusCode: 400 };
  }

  const existingStaff = await prisma.businessStaff.findFirst({
    where: {
      businessId: input.businessId,
      user: { telegramUsername: { equals: normalized, mode: "insensitive" } },
    },
    select: { id: true },
  });
  if (existingStaff) {
    return { ok: false, error: "Пользователь уже в команде", statusCode: 409 };
  }

  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const existingPending = await prisma.staffInvite.findFirst({
    where: {
      businessId: input.businessId,
      telegramUsername: normalized,
      status: "PENDING",
    },
    orderBy: { id: "desc" },
  });

  if (existingPending) {
    await prisma.staffInvite.update({
      where: { id: existingPending.id },
      data: {
        role: input.role,
        invitedByUserId: input.invitedByUserId,
        expiresAt,
      },
    });
  } else {
    await prisma.staffInvite.create({
      data: {
        businessId: input.businessId,
        telegramUsername: normalized,
        role: input.role,
        status: "PENDING",
        invitedByUserId: input.invitedByUserId,
        expiresAt,
      },
    });
  }

  return { ok: true };
}

function chatDisplayName(chat: TelegramChat): string {
  const parts = [chat.first_name, chat.last_name]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.join(" ").trim() || "Telegram user";
}

export async function listStaffPublicRows(
  businessId: number,
): Promise<StaffPublicRow[]> {
  const rows = await prisma.businessStaff.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          telegramUsername: true,
          photoUrl: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { userId: "asc" }],
  });

  return rows.map((r) => ({
    staffId: r.id,
    userId: r.userId,
    role: r.role,
    permissions: r.permissions ?? [],
    name: staffDisplayName({
      name: r.user.name,
      telegramUsername: r.user.telegramUsername,
    }),
    username: r.user.telegramUsername
      ? `@${normalizeTelegramUsername(r.user.telegramUsername)}`
      : null,
    photoUrl: r.user.photoUrl ?? null,
  }));
}

export async function previewStaffInvite(input: {
  businessId: number;
  username: string;
}): Promise<
  | { ok: true; preview: StaffPreview }
  | { ok: false; error: string; statusCode?: number }
> {
  const normalized = normalizeTelegramUsername(input.username);
  if (normalized === "") {
    return { ok: false, error: "Укажите @username Telegram", statusCode: 400 };
  }

  const botToken = await merchantBotToken(input.businessId);
  let resolvedBotLink: string | null = null;
  if (botToken) {
    const botUser = await merchantBotUsername(botToken);
    if (botUser) resolvedBotLink = `https://t.me/${botUser}`;
  }

  if (!botToken) {
    return {
      ok: false,
      error: "Бот магазина не настроен. Подключите токен бота в настройках.",
      statusCode: 400,
    };
  }

  const pending = await hasPendingStaffInvite(input.businessId, normalized);

  const localUser = await findUserByTelegramUsername(normalized);
  if (localUser) {
    const staff = await prisma.businessStaff.findUnique({
      where: {
        userId_businessId: { userId: localUser.id, businessId: input.businessId },
      },
    });
    const alreadyStaff = staff != null;
    return {
      ok: true,
      preview: previewFromUser(
        localUser,
        alreadyStaff,
        alreadyStaff ? "already_staff" : "ready",
        resolvedBotLink,
        pending,
      ),
    };
  }

  const chat = await telegramGetChat(botToken, normalized);
  if (chat?.id) {
    const tgUsername =
      typeof chat.username === "string" && chat.username.trim() !== ""
        ? normalizeTelegramUsername(chat.username)
        : normalized;

    const user = await prisma.user.findUnique({
      where: { telegramId: String(chat.id) },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        photoUrl: true,
      },
    });

    if (user) {
      const staff = await prisma.businessStaff.findUnique({
        where: {
          userId_businessId: { userId: user.id, businessId: input.businessId },
        },
      });
      const alreadyStaff = staff != null;
      return {
        ok: true,
        preview: previewFromUser(
          {
            ...user,
            telegramUsername: user.telegramUsername ?? tgUsername,
          },
          alreadyStaff,
          alreadyStaff ? "already_staff" : "ready",
          resolvedBotLink,
        ),
      };
    }

    return {
      ok: true,
      preview: {
        name: chatDisplayName(chat),
        username: `@${tgUsername}`,
        photoUrl: null,
        alreadyStaff: false,
        lookupStatus: "ready",
        canInviteNow: true,
        hasPendingInvite: pending,
        botLink: resolvedBotLink,
        userId: null,
      },
    };
  }

  return {
    ok: true,
    preview: {
      name: `@${normalized}`,
      username: `@${normalized}`,
      photoUrl: null,
      alreadyStaff: false,
      lookupStatus: "needs_bot_contact",
      canInviteNow: false,
      hasPendingInvite: pending,
      botLink: resolvedBotLink,
      userId: null,
    },
  };
}

export type InviteStaffResult =
  | { ok: true; staff: StaffPublicRow; pending?: false }
  | { ok: true; pending: true; message: string }
  | { ok: false; error: string; statusCode: number };

async function addStaffForUser(input: {
  businessId: number;
  invitedByUserId: number;
  userId: number;
  role: BusinessStaffRole;
  normalizedUsername: string;
}): Promise<StaffPublicRow> {
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.businessStaff.findUnique({
      where: {
        userId_businessId: {
          userId: input.userId,
          businessId: input.businessId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            telegramUsername: true,
            photoUrl: true,
          },
        },
      },
    });
    if (existing?.role === BusinessStaffRole.OWNER) {
      throw new Error("OWNER_IMMUTABLE");
    }
    if (existing) {
      throw new Error("ALREADY_STAFF");
    }

    const staff = await tx.businessStaff.create({
      data: {
        businessId: input.businessId,
        userId: input.userId,
        role: input.role,
        permissions: defaultPermissionsForStaffRole(input.role),
        invitedByUserId: input.invitedByUserId,
      },
      include: {
        user: {
          select: {
            name: true,
            telegramUsername: true,
            photoUrl: true,
          },
        },
      },
    });

    await tx.staffInvite.updateMany({
      where: {
        businessId: input.businessId,
        telegramUsername: input.normalizedUsername,
        status: "PENDING",
      },
      data: { status: "ACCEPTED" },
    });

    return staff;
  });

  return {
    staffId: created.id,
    userId: created.userId,
    role: created.role,
    permissions: created.permissions ?? [],
    name: staffDisplayName({
      name: created.user.name,
      telegramUsername: created.user.telegramUsername,
    }),
    username: created.user.telegramUsername
      ? `@${normalizeTelegramUsername(created.user.telegramUsername)}`
      : null,
    photoUrl: created.user.photoUrl ?? null,
  };
}

export async function inviteStaffMember(input: {
  businessId: number;
  invitedByUserId: number;
  username: string;
  role: BusinessStaffRole;
}): Promise<InviteStaffResult> {
  if (input.role === BusinessStaffRole.OWNER) {
    return { ok: false, error: "Нельзя назначить роль владельца", statusCode: 400 };
  }
  if (!INVITE_STAFF_ROLES.includes(input.role)) {
    return { ok: false, error: "Недопустимая роль", statusCode: 400 };
  }

  const normalized = normalizeTelegramUsername(input.username);
  if (normalized === "") {
    return { ok: false, error: "Укажите @username", statusCode: 400 };
  }

  const botToken = await merchantBotToken(input.businessId);
  if (!botToken) {
    return {
      ok: false,
      error: "Бот магазина не настроен",
      statusCode: 400,
    };
  }

  const localUser = await findUserByTelegramUsername(normalized);
  if (localUser?.telegramId) {
    try {
      const staff = await addStaffForUser({
        businessId: input.businessId,
        invitedByUserId: input.invitedByUserId,
        userId: localUser.id,
        role: input.role,
        normalizedUsername: normalized,
      });
      return { ok: true, staff };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "ALREADY_STAFF") {
        return { ok: false, error: "Пользователь уже в команде", statusCode: 409 };
      }
      if (msg === "OWNER_IMMUTABLE") {
        return { ok: false, error: "Нельзя менять владельца", statusCode: 403 };
      }
      throw e;
    }
  }

  const chat = await telegramGetChat(botToken, normalized);
  if (!chat?.id) {
    const pending = await createPendingStaffInvite({
      businessId: input.businessId,
      invitedByUserId: input.invitedByUserId,
      username: normalized,
      role: input.role,
    });
    if (!pending.ok) {
      return { ok: false, error: pending.error, statusCode: pending.statusCode };
    }
    return {
      ok: true,
      pending: true,
      message:
        "Приглашение сохранено. Попросите сотрудника открыть бота магазина и нажать «Старт» — доступ появится автоматически.",
    };
  }

  const tgUsername =
    typeof chat.username === "string" && chat.username.trim() !== ""
      ? normalizeTelegramUsername(chat.username)
      : normalized;
  const displayName = chatDisplayName(chat);

  const user = await prisma.user.upsert({
    where: { telegramId: String(chat.id) },
    create: {
      telegramId: String(chat.id),
      name: displayName,
      telegramUsername: tgUsername,
    },
    update: {
      name: displayName,
      telegramUsername: tgUsername,
    },
  });

  try {
    const staff = await addStaffForUser({
      businessId: input.businessId,
      invitedByUserId: input.invitedByUserId,
      userId: user.id,
      role: input.role,
      normalizedUsername: normalized,
    });
    return { ok: true, staff };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ALREADY_STAFF") {
      return { ok: false, error: "Пользователь уже в команде", statusCode: 409 };
    }
    if (msg === "OWNER_IMMUTABLE") {
      return { ok: false, error: "Нельзя менять владельца", statusCode: 403 };
    }
    throw e;
  }
}

export async function updateStaffRole(input: {
  businessId: number;
  targetUserId: number;
  role: BusinessStaffRole;
}): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
  if (input.role === BusinessStaffRole.OWNER) {
    return { ok: false, error: "Передача владения отдельным flow", statusCode: 400 };
  }

  const existing = await prisma.businessStaff.findUnique({
    where: {
      userId_businessId: {
        userId: input.targetUserId,
        businessId: input.businessId,
      },
    },
  });
  if (!existing) {
    return { ok: false, error: "Сотрудник не найден", statusCode: 404 };
  }
  if (existing.role === BusinessStaffRole.OWNER) {
    return { ok: false, error: "Нельзя менять роль владельца", statusCode: 403 };
  }

  await prisma.businessStaff.update({
    where: {
      userId_businessId: {
        userId: input.targetUserId,
        businessId: input.businessId,
      },
    },
    data: {
      role: input.role,
      permissions: defaultPermissionsForStaffRole(input.role),
    },
  });
  return { ok: true };
}

export async function updateStaffPermissions(input: {
  businessId: number;
  targetUserId: number;
  permissions: unknown;
}): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
  const existing = await prisma.businessStaff.findUnique({
    where: {
      userId_businessId: {
        userId: input.targetUserId,
        businessId: input.businessId,
      },
    },
  });
  if (!existing) {
    return { ok: false, error: "Сотрудник не найден", statusCode: 404 };
  }
  if (existing.role === BusinessStaffRole.OWNER) {
    return { ok: false, error: "Права владельца не настраиваются", statusCode: 403 };
  }
  if (existing.role === BusinessStaffRole.SUPPORT) {
    return {
      ok: false,
      error: "Для роли «Поддержка» права фиксированы",
      statusCode: 400,
    };
  }

  const perms = sanitizeMerchantPermissionInput(input.permissions);
  await prisma.businessStaff.update({
    where: {
      userId_businessId: {
        userId: input.targetUserId,
        businessId: input.businessId,
      },
    },
    data: { permissions: perms },
  });
  return { ok: true };
}

export async function removeStaffMember(input: {
  businessId: number;
  targetUserId: number;
}): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
  const existing = await prisma.businessStaff.findUnique({
    where: {
      userId_businessId: {
        userId: input.targetUserId,
        businessId: input.businessId,
      },
    },
  });
  if (!existing) {
    return { ok: false, error: "Сотрудник не найден", statusCode: 404 };
  }
  if (existing.role === BusinessStaffRole.OWNER) {
    return { ok: false, error: "Нельзя удалить владельца", statusCode: 403 };
  }

  await prisma.businessStaff.delete({
    where: {
      userId_businessId: {
        userId: input.targetUserId,
        businessId: input.businessId,
      },
    },
  });
  return { ok: true };
}

export { parseStaffRole };
