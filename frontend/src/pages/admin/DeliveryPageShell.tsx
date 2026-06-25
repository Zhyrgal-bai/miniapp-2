import { lazy, Suspense } from "react";
import { useShop } from "../../context/ShopContext";
import { useAdminGateStore } from "../../store/adminGate.store";
import {
  MERCHANT_PERM,
  hasMerchantPermission,
} from "../../permissions/merchantPermissions";
import { LoadingSkeleton } from "../../components/delivery/LoadingSkeleton";
import type { DeliveryAdminMode } from "../../types/deliveryAdmin.types";

const DeliveryPageInner = lazy(() => import("./DeliveryPage"));

export type DeliveryPageShellProps = {
  mode?: DeliveryAdminMode;
  operatorToken?: string | null;
};

export default function DeliveryPageShell({
  mode = "merchant",
  operatorToken = null,
}: DeliveryPageShellProps) {
  const { businessId } = useShop();
  const merchantRole = useAdminGateStore((s) => s.merchantRole);
  const merchantPermissions = useAdminGateStore((s) => s.merchantPermissions);

  const canManageSettings = hasMerchantPermission(
    merchantPermissions,
    MERCHANT_PERM.settingsManage,
    merchantRole,
  );

  return (
    <Suspense fallback={<LoadingSkeleton variant="page" />}>
      <DeliveryPageInner
        mode={mode}
        businessId={businessId}
        operatorToken={operatorToken}
        canManageSettings={canManageSettings}
      />
    </Suspense>
  );
}
