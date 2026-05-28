/** Синхрон с `src/server/merchantPermissions.ts` (id прав). */
export const MERCHANT_PERM = {
  analyticsView: "analytics.view",
  ordersManage: "orders.manage",
  catalogEdit: "catalog.edit",
  designEdit: "design.edit",
  settingsManage: "settings.manage",
  supportManage: "support.manage",
  floorManage: "floor.manage",
  kitchenView: "kitchen.view",
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
  MERCHANT_PERM.floorManage,
  MERCHANT_PERM.kitchenView,
];

/** Waiter role: floor + table orders only in UI (server still uses permissions). */
export function isWaiterRole(merchantRole: string | null | undefined): boolean {
  return String(merchantRole ?? "").toUpperCase() === "WAITER";
}

export function hasMerchantPermission(
  effective: string[] | null | undefined,
  required: MerchantPermissionId | undefined,
  merchantRole?: string | null,
): boolean {
  if (required == null) return true;
  if (merchantRole === "OWNER" || merchantRole === "ADMIN") return true;
  return Boolean(effective?.includes(required));
}
