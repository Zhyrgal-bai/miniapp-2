import { BusinessStaffRole, MembershipRole } from "@prisma/client";

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

const MANAGER_DEFAULT: MerchantPermissionId[] = [
  MERCHANT_PERM.analyticsView,
  MERCHANT_PERM.ordersManage,
  MERCHANT_PERM.catalogEdit,
  MERCHANT_PERM.designEdit,
];

const SUPPORT_DEFAULT: MerchantPermissionId[] = [MERCHANT_PERM.supportManage];

export function defaultPermissionsForStaffRole(
  role: BusinessStaffRole,
): MerchantPermissionId[] {
  switch (role) {
    case BusinessStaffRole.OWNER:
    case BusinessStaffRole.ADMIN:
      return [...ALL_MERCHANT_PERMISSION_IDS];
    case BusinessStaffRole.MANAGER:
      return [...MANAGER_DEFAULT];
    case BusinessStaffRole.SUPPORT:
      return [...SUPPORT_DEFAULT];
    default:
      return [];
  }
}

export function effectiveMerchantPermissions(
  role: BusinessStaffRole,
  stored: string[],
): MerchantPermissionId[] {
  if (role === BusinessStaffRole.OWNER) {
    return [...ALL_MERCHANT_PERMISSION_IDS];
  }
  const list = Array.isArray(stored) ? stored : [];
  if (list.length > 0) {
    const allowed = new Set<string>(ALL_MERCHANT_PERMISSION_IDS);
    return list.filter((p): p is MerchantPermissionId =>
      allowed.has(p),
    ) as MerchantPermissionId[];
  }
  return defaultPermissionsForStaffRole(role);
}

export function merchantHasPermission(
  effective: MerchantPermissionId[],
  required: MerchantPermissionId | MerchantPermissionId[],
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
