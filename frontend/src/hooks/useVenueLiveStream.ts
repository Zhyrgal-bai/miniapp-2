import { useEffect, useRef } from "react";

/** Live floor refresh — 3s interval (Telegram Mini App cannot use EventSource + auth headers). */
export function useVenueLiveStream(
  businessId: number | null | undefined,
  onTick: () => void,
  intervalMs = 3000,
): void {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (businessId == null) return;
    onTickRef.current();
    const id = window.setInterval(() => onTickRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [businessId, intervalMs]);
}
