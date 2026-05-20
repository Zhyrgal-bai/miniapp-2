import { useEffect, useState } from "react";

const EVENT = "sf:commerceSessionChanged";

/** Bumps when sessionStorage commerce session changes for this tenant. */
export function useCommerceSessionRevision(businessId: number): number {
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const onChange = (ev: Event) => {
      const detail = (ev as CustomEvent<{ businessId?: number }>).detail;
      if (detail?.businessId === businessId) {
        setRev((r) => r + 1);
      }
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [businessId]);

  return rev;
}
