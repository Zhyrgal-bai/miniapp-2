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

export type StaffPreview = {
  name: string;
  username: string;
  photoUrl: string | null;
  alreadyStaff: boolean;
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
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { ok?: boolean; result?: TelegramChat };
  if (!json.ok || !json.result?.id) return null;
  return json.result;
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
  | { ok: false; error: string; pendingInvite?: boolean }
> {
  const normalized = normalizeTelegramUsername(input.username);
  if (normalized === "") {
    return { ok: false, error: "Укажите @username Telegram" };
  }

  const existingStaff = await prisma.businessStaff.findFirst({
    where: {
      businessId: input.businessId,
      user: { telegramUsername: { equals: normalized, mode: "insensitive" } },
    },
    select: { id: true },
  });
  if (existingStaff) {
    return {
      ok: true,
      preview: {
        name: `@${normalized}`,
        username: `@${normalized}`,
        photoUrl: null,
        alreadyStaff: true,
      },
    };
  }

  const botToken = await merchantBotToken(input.businessId);
  if (!botToken) {
    return {
      ok: false,
      error: "Бот магазина не настроен — нельзя найти пользователя",
    };
  }

  const chat = await telegramGetChat(botToken, normalized);
  if (!chat?.id) {
    return {
      ok: false,
      error:
        "Пользователь не найден. Он должен хотя бы раз написать боту магазина или открыть витрину.",
      pendingInvite: true,
    };
  }

  const tgUsername =
    typeof chat.username === "string" && chat.username.trim() !== ""
      ? normalizeTelegramUsername(chat.username)
      : normalized;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(chat.id) },
    select: { id: true },
  });
  let alreadyStaff = false;
  if (user) {
    const staff = await prisma.businessStaff.findUnique({
      where: {
        userId_businessId: { userId: user.id, businessId: input.businessId },
      },
    });
    alreadyStaff = staff != null;
  }

  return {
    ok: true,
    preview: {
      name: chatDisplayName(chat),
      username: `@${tgUsername}`,
      photoUrl: null,
      alreadyStaff,
    },
  };
}

export async function inviteStaffMember(input: {
  businessId: number;
  invitedByUserId: number;
  username: string;
  role: BusinessStaffRole;
}): Promise<
  | { ok: true; staff: StaffPublicRow }
  | { ok: false; error: string; statusCode: number }
> {
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

  const chat = await telegramGetChat(botToken, normalized);
  if (!chat?.id) {
    await prisma.staffInvite.create({
      data: {
        businessId: input.businessId,
        telegramUsername: normalized,
        role: input.role,
        status: "PENDING",
        invitedByUserId: input.invitedByUserId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return {
      ok: false,
      error:
        "Пользователь ещё не писал боту. Приглашение сохранено — попросите его открыть витрину и написать /start боту.",
      statusCode: 404,
    };
  }

  const tgUsername =
    typeof chat.username === "string" && chat.username.trim() !== ""
      ? normalizeTelegramUsername(chat.username)
      : normalized;
  const displayName = chatDisplayName(chat);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
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

    const existing = await tx.businessStaff.findUnique({
      where: {
        userId_businessId: { userId: user.id, businessId: input.businessId },
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
        userId: user.id,
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
        telegramUsername: normalized,
        status: "PENDING",
      },
      data: { status: "ACCEPTED" },
    });

    return staff;
  });

  return {
    ok: true,
    staff: {
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
    },
  };
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
