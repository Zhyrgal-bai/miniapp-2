import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { fetchReservationPreorderContext } from "../services/tableBookingApi";
import {
  clearPreorderContext,
  readPreorderContext,
  readReservationIdFromLocation,
  stripReservationIdFromLocation,
  writePreorderContext,
  type StoredPreorderContext,
} from "../utils/reservationPreorderStorage";
import { useCartStore } from "../store/useCartStore";

type PreorderContextValue = {
  context: StoredPreorderContext | null;
  error: string | null;
  loading: boolean;
  clear: () => void;
  refresh: () => Promise<void>;
};

const PreorderCtx = createContext<PreorderContextValue | null>(null);

export function PreorderProvider(props: {
  businessId: number | null;
  children: ReactNode;
}): ReactElement {
  const [context, setContext] = useState<StoredPreorderContext | null>(() =>
    readPreorderContext(),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setReservationId = useCartStore((s) => s.setReservationId);

  const applyContext = useCallback(
    (next: StoredPreorderContext | null) => {
      setContext(next);
      setReservationId(next?.reservationId ?? null);
      if (next) writePreorderContext(next);
      else clearPreorderContext();
    },
    [setReservationId],
  );

  const refresh = useCallback(async () => {
    if (props.businessId == null) return;
    const stored = readPreorderContext();
    const fromUrl = readReservationIdFromLocation();
    const reservationId = fromUrl ?? stored?.reservationId ?? null;
    if (reservationId == null) {
      if (stored && stored.businessId !== props.businessId) {
        applyContext(null);
        setError(null);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchReservationPreorderContext(props.businessId, reservationId);
      applyContext({
        businessId: props.businessId,
        reservationId: data.reservation.id,
        tableName: data.reservation.tableName,
        reservedAt: data.reservation.reservedAt,
        partySize: data.reservation.partySize,
        hasPreorder: data.reservation.hasPreorder,
      });
      stripReservationIdFromLocation();
    } catch (e: unknown) {
      applyContext(null);
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "")
          : "";
      setError(msg || (e instanceof Error ? e.message : "Бронь недоступна для предзаказа"));
    } finally {
      setLoading(false);
    }
  }, [applyContext, props.businessId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onDone = () => void refresh();
    window.addEventListener("sf:preorderCompleted", onDone);
    return () => window.removeEventListener("sf:preorderCompleted", onDone);
  }, [refresh]);

  const clear = useCallback(() => {
    applyContext(null);
    setError(null);
  }, [applyContext]);

  const value = useMemo(
    () => ({ context, error, loading, clear, refresh }),
    [context, error, loading, clear, refresh],
  );

  return <PreorderCtx.Provider value={value}>{props.children}</PreorderCtx.Provider>;
}

export function usePreorderMode(): PreorderContextValue {
  const ctx = useContext(PreorderCtx);
  if (!ctx) {
    return {
      context: readPreorderContext(),
      error: null,
      loading: false,
      clear: clearPreorderContext,
      refresh: async () => {},
    };
  }
  return ctx;
}
