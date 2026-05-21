import { BusinessStaffRole } from "@prisma/client";

export const STAFF_ROLE_RU: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  SUPPORT: "Поддержка",
};

export const INVITE_STAFF_ROLES: BusinessStaffRole[] = [
  BusinessStaffRole.ADMIN,
  BusinessStaffRole.MANAGER,
  BusinessStaffRole.SUPPORT,
];

export function normalizeTelegramUsername(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

export function displayTelegramUsername(
  username: string | null | undefined,
): string | null {
  const u = normalizeTelegramUsername(username ?? "");
  return u === "" ? null : `@${u}`;
}

export function staffDisplayName(input: {
  name?: string | null;
  telegramUsername?: string | null;
}): string {
  const name = input.name?.trim();
  if (name) return name;
  const handle = displayTelegramUsername(input.telegramUsername);
  if (handle) return handle;
  return "Сотрудник";
}

export function parseStaffRole(raw: unknown): BusinessStaffRole | null {
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "OWNER") return BusinessStaffRole.OWNER;
  if (u === "ADMIN") return BusinessStaffRole.ADMIN;
  if (u === "MANAGER") return BusinessStaffRole.MANAGER;
  if (u === "SUPPORT") return BusinessStaffRole.SUPPORT;
  return null;
}

export function isStaffRole(role: string | null | undefined): boolean {
  return parseStaffRole(role) != null;
}
