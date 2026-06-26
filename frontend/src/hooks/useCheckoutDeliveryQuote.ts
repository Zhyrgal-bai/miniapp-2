import { useEffect, useMemo, useRef, useState } from "react";
import { apiAbsoluteUrl } from "../services/api";
import { privilegedFetch } from "../services/privilegedFetch";
import type { CheckoutDeliveryQuote } from "@repo-shared/hybridDeliveryCheckout";
import type { DeliveryDestinationLocality } from "@repo-shared/merchantDeliveryLocality";

export type CheckoutFulfillmentMode = "DELIVERY" | "PICKUP";

export type UseCheckoutDeliveryQuoteParams = {
  merchantId: number | null;
  fulfillmentMode: CheckoutFulfillmentMode;
  subtotalSom: number;
  latitude: number | null;
  longitude: number | null;
  /** @deprecated Phase 9.1 substring fallback */
  destinationLabel?: string | null;
  destinationLocality?: DeliveryDestinationLocality | null;
  debounceMs?: number;
};

export type CheckoutDeliveryQuoteView = {
  quote: CheckoutDeliveryQuote | null;
  loading: boolean;
  ok: boolean;
  deliveryFeeSom: number;
  providerOfferId: string | null;
  displayLabel: string;
  errorMessage: string | null;
  manualConfirmation: boolean;
  manualMessage: string | null;
  distanceKm: number | null;
};

const LOCATION_REQUIRED_MESSAGE = "Укажите местоположение на карте";

export function useCheckoutDeliveryQuote(
  params: UseCheckoutDeliveryQuoteParams,
): CheckoutDeliveryQuoteView {
  const {
    merchantId,
    fulfillmentMode,
    subtotalSom,
    latitude,
    longitude,
    destinationLabel,
    destinationLocality,
    debounceMs = 300,
  } = params;

  const [quote, setQuote] = useState<CheckoutDeliveryQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);

  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  useEffect(() => {
    if (fulfillmentMode === "PICKUP") {
      setQuote({
        ok: true,
        provider: null,
        calculationSource: null,
        deliveryFeeSom: 0,
        etaMinutes: null,
        etaLabel: null,
        providerOfferId: null,
        manualConfirmation: false,
        message: null,
        displayLabel: "Самовывоз",
        distanceKm: null,
        fallbackUsed: false,
      });
      setLoading(false);
      return;
    }

    if (merchantId == null || merchantId <= 0 || !hasCoords) {
      setQuote({
        ok: false,
        code: "DISTANCE_UNKNOWN",
        message: LOCATION_REQUIRED_MESSAGE,
      });
      setLoading(false);
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const localityPayload = (() => {
            const loc = destinationLocality ?? {};
            const out: Record<string, string> = {};
            if (loc.city?.trim()) out.city = loc.city.trim().slice(0, 200);
            if (loc.district?.trim()) out.district = loc.district.trim().slice(0, 200);
            if (loc.region?.trim()) out.region = loc.region.trim().slice(0, 200);
            if (loc.country?.trim()) out.country = loc.country.trim().slice(0, 200);
            return Object.keys(out).length > 0 ? out : undefined;
          })();

          const url = apiAbsoluteUrl("/api/delivery/checkout-quote");
          const res = await privilegedFetch(url, {
            method: "POST",
            businessId: merchantId,
            body: JSON.stringify({
              merchantId,
              destination: { latitude, longitude },
              subtotalSom,
              fulfillmentMode: "DELIVERY",
              ...(destinationLabel?.trim()
                ? { destinationLabel: destinationLabel.trim().slice(0, 2000) }
                : {}),
              ...(localityPayload ? { destinationLocality: localityPayload } : {}),
            }),
          });
          const text = await res.text();
          if (!text.trim()) {
            throw new Error("empty checkout quote response");
          }
          const data = JSON.parse(text) as CheckoutDeliveryQuote;
          if (typeof data !== "object" || data == null || !("ok" in data)) {
            throw new Error("invalid checkout quote response");
          }
          if (requestSeq.current !== seq) return;
          setQuote(data);
        } catch {
          if (requestSeq.current !== seq) return;
          setQuote({
            ok: false,
            code: "DELIVERY_UNAVAILABLE",
            message: "Не удалось рассчитать доставку.",
          });
        } finally {
          if (requestSeq.current === seq) {
            setLoading(false);
          }
        }
      })();
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    merchantId,
    fulfillmentMode,
    subtotalSom,
    latitude,
    longitude,
    destinationLabel,
    destinationLocality,
    hasCoords,
    debounceMs,
  ]);

  return useMemo((): CheckoutDeliveryQuoteView => {
    if (fulfillmentMode === "PICKUP") {
      return {
        quote,
        loading: false,
        ok: true,
        deliveryFeeSom: 0,
        providerOfferId: null,
        displayLabel: "Самовывоз",
        errorMessage: null,
        manualConfirmation: false,
        manualMessage: null,
        distanceKm: null,
      };
    }

    if (!quote) {
      return {
        quote: null,
        loading,
        ok: false,
        deliveryFeeSom: 0,
        providerOfferId: null,
        displayLabel: loading ? "Расчёт доставки…" : LOCATION_REQUIRED_MESSAGE,
        errorMessage: hasCoords ? null : LOCATION_REQUIRED_MESSAGE,
        manualConfirmation: false,
        manualMessage: null,
        distanceKm: null,
      };
    }

    if (!quote.ok) {
      return {
        quote,
        loading,
        ok: false,
        deliveryFeeSom: 0,
        providerOfferId: null,
        displayLabel: quote.message,
        errorMessage: quote.message,
        manualConfirmation: false,
        manualMessage: null,
        distanceKm: null,
      };
    }

    return {
      quote,
      loading,
      ok: true,
      deliveryFeeSom: quote.deliveryFeeSom,
      providerOfferId: quote.providerOfferId,
      displayLabel: quote.displayLabel,
      errorMessage: null,
      manualConfirmation: quote.manualConfirmation,
      manualMessage: quote.manualConfirmation ? quote.message : null,
      distanceKm: quote.distanceKm,
    };
  }, [quote, loading, fulfillmentMode, hasCoords]);
}
