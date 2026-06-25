import { memo } from "react";

type RecoveryBadgeProps = {
  inRecovery: boolean;
  retryCount?: number;
};

export const RecoveryBadge = memo(function RecoveryBadge({
  inRecovery,
  retryCount = 0,
}: RecoveryBadgeProps) {
  if (!inRecovery) return null;
  return (
    <span className="dlv-badge dlv-badge--danger" title="Требуется восстановление">
      🔧 Recovery{retryCount > 0 ? ` · ${retryCount}` : ""}
    </span>
  );
});
