import { useCallback, useEffect, useState } from "react";
import {
  isLatitudeInKgRange,
  isLongitudeInKgRange,
} from "@repo-shared/businessAddress";
import { reverseGeocodeKg } from "../utils/nominatimGeocode";
import { isStorefrontCommerceEnabled } from "../hooks/useStorefrontCommerceMode";
import {
  hasCustomerLocationConsentDecision,
  hydrateCustomerLocationFromTelegramCloud,
  loadCustomerLocation,
  markCustomerLocationDenied,
  markCustomerLocationGranted,
  type CustomerLocationRecord,
} from "../storefront/customerLocationStorage";

export type CustomerLocationPromptState = {
  promptVisible: boolean;
  requesting: boolean;
  requestError: string | null;
  record: CustomerLocationRecord | null;
  onAllow: () => void;
  onDismiss: () => void;
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 120_000,
};

function roundCoord(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function houseFromAddressLine(line: string): string | null {
  const m = line.match(/\b(\d+[a-zA-Zа-яА-ЯёЁ/-]*)\s*$/);
  return m?.[1] ?? null;
}

export function useCustomerLocationPrompt(
  businessId: number | null,
): CustomerLocationPromptState {
  const commerceEnabled = isStorefrontCommerceEnabled();
  const [promptVisible, setPromptVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [record, setRecord] = useState<CustomerLocationRecord | null>(null);

  const syncFromStorage = useCallback(() => {
    if (businessId == null || businessId <= 0) {
      setRecord(null);
      setPromptVisible(false);
      return;
    }
    const loaded = loadCustomerLocation(businessId);
    setRecord(loaded);
    if (
      commerceEnabled &&
      !hasCustomerLocationConsentDecision(businessId)
    ) {
      setPromptVisible(true);
    } else {
      setPromptVisible(false);
    }
  }, [businessId, commerceEnabled]);

  useEffect(() => {
    if (businessId == null || businessId <= 0) return;
    void hydrateCustomerLocationFromTelegramCloud(businessId).then((record) => {
      if (record != null) syncFromStorage();
    });
  }, [businessId, syncFromStorage]);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ businessId?: number }>).detail;
      if (detail?.businessId === businessId) syncFromStorage();
    };
    window.addEventListener("sf:customerLocationChanged", onChanged as EventListener);
    return () =>
      window.removeEventListener("sf:customerLocationChanged", onChanged as EventListener);
  }, [businessId, syncFromStorage]);

  const onDismiss = useCallback(() => {
    if (businessId == null || businessId <= 0) return;
    const next = markCustomerLocationDenied(businessId);
    setRecord(next);
    setPromptVisible(false);
    setRequestError(null);
  }, [businessId]);

  const onAllow = useCallback(() => {
    if (businessId == null || businessId <= 0) return;
    setRequestError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setRequestError("Геолокация недоступна в этом браузере.");
      return;
    }

    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const lat = roundCoord(pos.coords.latitude);
          const lng = roundCoord(pos.coords.longitude);
          if (!isLatitudeInKgRange(lat) || !isLongitudeInKgRange(lng)) {
            setRequesting(false);
            setRequestError(
              "Координаты вне Кыргызстана. Проверьте GPS или выберите «Позже».",
            );
            return;
          }

          const geo = await reverseGeocodeKg(lat, lng);
          const address = geo.ok
            ? {
                formattedAddress: geo.value.displayAddress,
                city: geo.value.city,
                country: "Кыргызстан",
                street: geo.value.addressLine,
                houseNumber: houseFromAddressLine(geo.value.addressLine),
              }
            : null;

          const next = markCustomerLocationGranted(businessId, {
            latitude: lat,
            longitude: lng,
            accuracyM: Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
            address,
          });
          setRecord(next);
          setPromptVisible(false);
          setRequesting(false);
          setRequestError(null);
        })();
      },
      (err) => {
        setRequesting(false);
        if (err.code === err.PERMISSION_DENIED) {
          const next = markCustomerLocationDenied(businessId);
          setRecord(next);
          setPromptVisible(false);
          setRequestError(null);
          return;
        }
        setRequestError(
          err.code === err.TIMEOUT
            ? "Не удалось определить местоположение. Попробуйте ещё раз."
            : "Не удалось получить координаты.",
        );
      },
      GEO_OPTIONS,
    );
  }, [businessId]);

  return {
    promptVisible,
    requesting,
    requestError,
    record,
    onAllow,
    onDismiss,
  };
}
