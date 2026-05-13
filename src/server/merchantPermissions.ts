import { MembershipRole } from "@prisma/client";

export const MERCHANT_PERM = {
  analyticsView: "analytics.view",
  ordersManage: "orders.manage",
  catalogEdit: "catalog.edit",
  designEdit: "design.edit",
  settingsManage: "settings.manage",
  supportManage: "support.manage",
} as const;

export type MerchantPermissionId =
  (typeof MERCHANT_PERM)[keyof typeof MERCHANT_PERM];

export const ALL_MERCHANT_PERMISSION_IDS: MerchantPermissionId[] = [
  MERCHANT_PERM.analyticsView,
  MERCHANT_PERM.ordersManage,
  MERCHANT_PERM.catalogEdit,
  MERCHANT_PERM.designEdit,
  MERCHANT_PERM.settingsManage,
  MERCHANT_PERM.supportManage,
];

export function effectiveMerchantPermissions(
  role: MembershipRole,
  stored: string[]
): MerchantPermissionId[] {
  if (role === MembershipRole.OWNER) return [...ALL_MERCHANT_PERMISSION_IDS];
  if (role === MembershipRole.ADMIN) {
    const list = Array.isArray(stored) ? stored : [];
    if (list.length === 0) return [...ALL_MERCHANT_PERMISSION_IDS];
    const allowed = new Set<string>(ALL_MERCHANT_PERMISSION_IDS);
    return list.filter((p): p is MerchantPermissionId =>
      allowed.has(p)
    ) as MerchantPermissionId[];
  }
  return [];
}

export function merchantHasPermission(
  effective: MerchantPermissionId[],
  required: MerchantPermissionId | MerchantPermissionId[]
): boolean {
  const req = Array.isArray(required) ? required : [required];
  return req.some((p) => effective.includes(p));
}

export function sanitizeMerchantPermissionInput(
  input: unknown,
): MerchantPermissionId[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(ALL_MERCHANT_PERMISSION_IDS);
  const out = new Set<string>();
  for (const x of input) {
    if (typeof x === "string" && allowed.has(x)) out.add(x);
  }
  return [...out] as MerchantPermissionId[];
}
