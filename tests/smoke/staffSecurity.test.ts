import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BusinessStaffRole } from "@prisma/client";
import {
  defaultPermissionsForStaffRole,
  effectiveMerchantPermissions,
  merchantHasPermission,
  MERCHANT_PERM,
} from "../../src/server/merchantPermissions.js";

describe("staff security boundary", () => {
  it("SUPPORT role only has support permission by default", () => {
    const perms = defaultPermissionsForStaffRole(BusinessStaffRole.SUPPORT);
    expect(perms).toEqual([MERCHANT_PERM.supportManage]);
    expect(merchantHasPermission(perms, MERCHANT_PERM.ordersManage)).toBe(false);
  });

  it("MANAGER cannot manage settings by default", () => {
    const perms = defaultPermissionsForStaffRole(BusinessStaffRole.MANAGER);
    expect(merchantHasPermission(perms, MERCHANT_PERM.settingsManage)).toBe(
      false,
    );
    expect(merchantHasPermission(perms, MERCHANT_PERM.ordersManage)).toBe(true);
  });

  it("OWNER always has full permissions", () => {
    const perms = effectiveMerchantPermissions(BusinessStaffRole.OWNER, []);
    expect(merchantHasPermission(perms, MERCHANT_PERM.settingsManage)).toBe(
      true,
    );
  });

  it("SUPPORT lacks notification-related permissions by default", () => {
    const perms = defaultPermissionsForStaffRole(BusinessStaffRole.SUPPORT);
    expect(merchantHasPermission(perms, MERCHANT_PERM.ordersManage)).toBe(
      false,
    );
    expect(merchantHasPermission(perms, MERCHANT_PERM.analyticsView)).toBe(
      false,
    );
  });

  it("Finik integration routes align with settingsManage permission", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/server/finikMerchant.ts"),
      "utf8",
    );
    expect(src.includes("MERCHANT_PERM.settingsManage")).toBe(true);
    expect(src.includes("merchantStaffHasFinikSettingsAccess")).toBe(true);
  });
});
