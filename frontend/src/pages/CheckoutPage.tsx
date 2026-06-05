import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useCartStore } from "../store/useCartStore";
import { api } from "../services/api";
import { fetchMyOrders } from "../services/myOrdersApi";
import { useShop } from "../context/ShopContext";
import { getTelegramUser, getTelegramWebAppUserId } from "../utils/telegram";
import { cleanInput, validateKgPhone } from "../utils/orderInputSanitize";
import MapPicker from "../components/checkout/MapPicker";
import "../components/ui/CheckoutPage.css";
import { buildCatalogRequestParams } from "../utils/storeParams";
import { setPendingFinikOrder } from "../utils/pendingFinikOrder";
import { openTelegramExternalLink } from "../utils/telegramWebAppBootstrap";
import { t } from "../i18n";
import { trackCheckoutStart } from "../services/storefrontAnalytics";
import type { Product } from "../types";
import { getMaxOrderQty } from "../commerce/quantityPolicy";
import { isOutOfStock } from "../utils/product";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { formatOrderLineSummary } from "@repo-shared/businessCommerce";
import { cartLineIdentityKey } from "../commerce/cartLineIdentity";
import { readTableSession } from "../utils/tableSessionStorage";
import { readPreorderContext, clearPreorderContext } from "../utils/reservationPreorderStorage";
import {
  computeDeliveryQuote,
  defaultMerchantDeliverySettings,
  haversineDistanceKm,
  type MerchantDeliverySettings,
} from "@repo-shared/merchantDeliverySettings";
import { readCustomerLocationCoords } from "../storefront/customerLocationStorage";
import { checkoutLocationLabel } from "../utils/checkoutLocationLabel";

type Props = {
  onBack?: () => void;
};

type NominatimSearchItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type FieldErrors = {
  name?: string;
  phone?: string;
};

const ADDRESS_SEARCH_DEBOUNCE_MS = 450;

function formatSom(n: number): string {
  return `${Math.round(n)} сом`;
}

function orderErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response || err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") {
      return t("common.networkError");
    }
    const data = err.response?.data as
      | {
          error?: string;
          failedStep?: string;
          details?: Record<string, string>;
        }
      | undefined;
    if (
      data?.error === "Есть неизвестные поля" ||
      data?.error === "Некорректные значения"
    ) {
      return "Не удалось оформить заказ. Обновите корзину и попробуйте снова.";
    }
    if (data?.details && typeof data.details === "object") {
      const first = Object.values(data.details).find(
        (v) => typeof v === "string" && v.trim() !== "",
      );
      if (first) return first;
    }
    if (data?.error) {
      const step = typeof data.failedStep === "string" ? data.failedStep : "";
      if (step === "stock_reserved") {
        return "Не удалось зарезервировать товар на складе. Обновите корзину и попробуйте снова.";
      }
      if (step === "delivery_init") {
        return "Не удалось настроить доставку для заказа. Попробуйте ещё раз.";
      }
      if (step === "order_created") {
        return "Не удалось сохранить заказ. Обновите корзину и попробуйте снова.";
      }
      if (step === "pricing") {
        return "Не удалось проверить цену товара. Обновите корзину и попробуйте снова.";
      }
      return data.error;
    }
  }
  return t("checkout.errorGeneric");
}

export default function CheckoutPage({ onBack }: Props) {
  const tableSession = readTableSession();
  const { businessId } = useShop();
  const { payload } = useStorefrontPayload();
  const businessType = payload?.businessType ?? null;
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const reservationId = useCartStore((state) => state.reservationId);
  const setReservationId = useCartStore((state) => state.setReservationId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<
    NominatimSearchItem[]
  >([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const addressSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const addressSearchSeqRef = useRef(0);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [deliveryType, setDeliveryType] = useState("delivery");
  const pickupOnly = Boolean(payload?.deliveryPolicy?.pickupOnly);
  const [promo, setPromo] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phoneFromSavedOrder, setPhoneFromSavedOrder] = useState(false);
  const [promoPreview, setPromoPreview] = useState<{
    newTotal: number;
    discount: number;
  } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [finikRedirectMessage, setFinikRedirectMessage] = useState<
    string | null
  >(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [catalogById, setCatalogById] = useState<Map<number, Product>>(
    () => new Map(),
  );

  useEffect(() => {
    if (businessId == null || !Number.isInteger(businessId) || businessId <= 0) {
      setCatalogById(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<Product[]>("/products");
        if (cancelled) return;
        const m = new Map<number, Product>();
        for (const p of res.data ?? []) {
          if (typeof p.id === "number") m.set(p.id, p);
        }
        setCatalogById(m);
      } catch {
        if (!cancelled) setCatalogById(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const cartStockIssue = useMemo(() => {
    for (const item of items) {
      const p = catalogById.get(item.productId);
      if (!p) continue;
      if (isOutOfStock(p)) {
        return "Некоторые товары закончились. Вернитесь в корзину и обновите состав.";
      }
      const max = getMaxOrderQty(p, item.size, item.color);
      if (max <= 0 || (item.quantity ?? 1) > max) {
        return "Недостаточно товара на складе. Обновите корзину.";
      }
    }
    return null;
  }, [items, catalogById]);

  useEffect(() => {
    if (businessId != null && businessId > 0) {
      trackCheckoutStart(businessId);
    }
  }, [businessId]);

  useEffect(() => {
    if (pickupOnly) setDeliveryType("pickup");
  }, [pickupOnly]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0),
    [items],
  );

  const deliverySettings = useMemo((): MerchantDeliverySettings => {
    const p = payload?.deliveryPolicy;
    if (p == null) return defaultMerchantDeliverySettings();
    return {
      version: 1,
      pricingMode: p.pricingMode,
      minOrderAmountSom: p.minOrderAmountSom,
      fixedPriceSom: p.fixedPriceSom,
      distanceTiers: p.distanceTiers,
    };
  }, [payload?.deliveryPolicy]);

  const distanceKm = useMemo(() => {
    if (deliveryType === "pickup") return null;
    const store = payload?.storeAddress;
    if (store == null) return null;
    const saved = businessId != null ? readCustomerLocationCoords(businessId) : null;
    const customerLat = lat ?? saved?.latitude ?? null;
    const customerLng = lng ?? saved?.longitude ?? null;
    if (customerLat == null || customerLng == null) return null;
    return (
      Math.round(
        haversineDistanceKm(
          { latitude: store.latitude, longitude: store.longitude },
          { latitude: customerLat, longitude: customerLng },
        ) * 100,
      ) / 100
    );
  }, [deliveryType, payload?.storeAddress, lat, lng, businessId]);

  const deliveryQuote = useMemo(() => {
    const fulfillmentMode = deliveryType === "pickup" ? "PICKUP" : "DELIVERY";
    return computeDeliveryQuote({
      settings: deliverySettings,
      fulfillmentMode,
      subtotalSom: subtotal,
      distanceKm,
    });
  }, [deliverySettings, deliveryType, subtotal, distanceKm]);

  const deliveryFeeSom = deliveryQuote.ok ? deliveryQuote.deliveryFeeSom : 0;
  const manualDeliveryNotice =
    deliveryQuote.ok && deliveryQuote.manualConfirmation
      ? deliveryQuote.message
      : null;

  const deliverySummaryLabel = useMemo(() => {
    if (deliveryType === "pickup") {
      return t("checkout.deliveryFree");
    }
    if (!deliveryQuote.ok) {
      return deliveryQuote.error;
    }
    if (manualDeliveryNotice != null) {
      return "Уточняется";
    }
    const dist =
      deliveryQuote.distanceKm != null
        ? ` · ≈ ${deliveryQuote.distanceKm} км`
        : "";
    if (deliverySettings.pricingMode === "DISTANCE_BASED") {
      if (deliveryQuote.distanceKm == null) {
        return "Укажите местоположение на карте";
      }
      if (deliveryFeeSom === 0) {
        return `${t("checkout.deliveryFree")}${dist}`;
      }
      return `${formatSom(deliveryFeeSom)}${dist}`;
    }
    if (deliveryFeeSom === 0) {
      return t("checkout.deliveryFree");
    }
    return formatSom(deliveryFeeSom);
  }, [
    deliveryType,
    deliveryQuote,
    manualDeliveryNotice,
    deliveryFeeSom,
    deliverySettings.pricingMode,
  ]);

  const discountAmount = useMemo(() => {
    if (!promoPreview) return 0;
    return Math.max(0, subtotal - promoPreview.newTotal);
  }, [promoPreview, subtotal]);

  const goodsAfterPromo = promoPreview?.newTotal ?? subtotal;
  const totalPrice = goodsAfterPromo + deliveryFeeSom;

  useEffect(() => {
    setPromoPreview(null);
    setPromoError(null);
  }, [subtotal]);

  useEffect(() => {
    return () => {
      if (addressSearchTimerRef.current) {
        clearTimeout(addressSearchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const uid = getTelegramWebAppUserId();
    if (!Number.isFinite(uid) || uid <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchMyOrders(uid, buildCatalogRequestParams().shop);
        const prev = rows.find((o) => {
          const raw = o.phone ?? o.customerPhone;
          return raw != null && String(raw).trim() !== "";
        });
        const saved =
          prev != null
            ? String(prev.phone ?? prev.customerPhone ?? "").trim()
            : "";
        if (!cancelled && saved !== "") {
          setPhone(saved);
          setPhoneFromSavedOrder(true);
        }
      } catch {
        /* не блокируем оформление */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPromoCode = async (): Promise<number | null> => {
    const code = cleanInput(promo);
    if (!code) {
      setPromoPreview(null);
      setPromoError(null);
      return subtotal;
    }
    const shop = buildCatalogRequestParams().shop;
    const promoBusinessId = shop ? Number(shop) : NaN;
    if (!Number.isInteger(promoBusinessId) || promoBusinessId <= 0) {
      setPromoError(t("checkout.promoNeedShop"));
      setPromoPreview(null);
      return null;
    }
    try {
      const applyRes = await api.post<{ newTotal?: number; discount?: number }>(
        "/promo/apply",
        { code, total: subtotal, businessId: promoBusinessId },
      );
      const data = applyRes.data;
      if (
        data.newTotal == null ||
        data.discount == null ||
        !Number.isFinite(data.newTotal)
      ) {
        setPromoError(t("checkout.promoInvalid"));
        setPromoPreview(null);
        return null;
      }
      setPromoPreview({ newTotal: data.newTotal, discount: data.discount });
      setPromoError(null);
      return data.newTotal;
    } catch {
      setPromoError(t("checkout.promoInvalid"));
      setPromoPreview(null);
      return null;
    }
  };

  const runAddressSearch = useCallback(async (q: string) => {
    const seq = ++addressSearchSeqRef.current;
    setAddressSearchLoading(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("q", q);
      url.searchParams.set("accept-language", "ru");
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "kg");

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      const raw = (await res.json().catch(() => [])) as unknown;
      if (seq !== addressSearchSeqRef.current) return;
      const rows = Array.isArray(raw) ? raw : [];
      const next: NominatimSearchItem[] = [];
      for (const row of rows) {
        if (next.length >= 5) break;
        if (
          row != null &&
          typeof row === "object" &&
          typeof (row as { place_id?: unknown }).place_id === "number" &&
          typeof (row as { display_name?: unknown }).display_name === "string" &&
          typeof (row as { lat?: unknown }).lat === "string" &&
          typeof (row as { lon?: unknown }).lon === "string"
        ) {
          next.push(row as NominatimSearchItem);
        }
      }
      setAddressSuggestions(next);
    } catch {
      if (seq === addressSearchSeqRef.current) {
        setAddressSuggestions([]);
      }
    } finally {
      if (seq === addressSearchSeqRef.current) {
        setAddressSearchLoading(false);
      }
    }
  }, []);

  const handleAddressChange = useCallback(
    (value: string) => {
      setAddress(value);
      const trimmed = value.trim();
      if (trimmed.length < 3) {
        if (addressSearchTimerRef.current) {
          clearTimeout(addressSearchTimerRef.current);
          addressSearchTimerRef.current = null;
        }
        addressSearchSeqRef.current += 1;
        setAddressSuggestions([]);
        setAddressSearchLoading(false);
        return;
      }
      if (addressSearchTimerRef.current) {
        clearTimeout(addressSearchTimerRef.current);
      }
      addressSearchTimerRef.current = setTimeout(() => {
        addressSearchTimerRef.current = null;
        void runAddressSearch(trimmed);
      }, ADDRESS_SEARCH_DEBOUNCE_MS);
    },
    [runAddressSearch],
  );

  const selectAddress = useCallback((item: NominatimSearchItem) => {
    if (addressSearchTimerRef.current) {
      clearTimeout(addressSearchTimerRef.current);
      addressSearchTimerRef.current = null;
    }
    addressSearchSeqRef.current += 1;
    setAddressSearchLoading(false);
    setAddress(item.display_name.trim().slice(0, 2000));
    setLat(Number(item.lat));
    setLng(Number(item.lon));
    setAddressSuggestions([]);
  }, []);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setCheckoutError(t("checkout.geoUnsupported"));
      return;
    }
    if (addressSearchTimerRef.current) {
      clearTimeout(addressSearchTimerRef.current);
      addressSearchTimerRef.current = null;
    }
    addressSearchSeqRef.current += 1;
    setAddressSuggestions([]);
    setAddressSearchLoading(false);
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setLat(nextLat);
        setLng(nextLng);

        void (async () => {
          try {
            const url = new URL("https://nominatim.openstreetmap.org/reverse");
            url.searchParams.set("format", "jsonv2");
            url.searchParams.set("lat", String(nextLat));
            url.searchParams.set("lon", String(nextLng));
            url.searchParams.set("accept-language", "ru");

            const res = await fetch(url.toString(), {
              headers: { Accept: "application/json" },
            });
            const data = (await res.json().catch(() => ({}))) as {
              display_name?: string;
            };
            if (
              typeof data.display_name === "string" &&
              data.display_name.trim()
            ) {
              setAddress(data.display_name.trim().slice(0, 2000));
            }
          } catch {
            setCheckoutError(t("checkout.geoAddressFail"));
          } finally {
            setLoadingLocation(false);
          }
        })();
      },
      () => {
        setCheckoutError(t("checkout.geoDenied"));
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  }, []);

  const handleCheckPromo = async () => {
    if (!promo.trim()) return;
    setPromoChecking(true);
    try {
      await applyPromoCode();
    } finally {
      setPromoChecking(false);
    }
  };

  const validateForm = (): boolean => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t("checkout.nameRequired");
    if (!phone.trim()) next.phone = t("checkout.phoneRequired");
    else if (!validateKgPhone(phone.trim())) {
      next.phone = t("checkout.phoneInvalid");
      if (phoneFromSavedOrder) setPhoneFromSavedOrder(false);
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (cartStockIssue) {
      setCheckoutError(cartStockIssue);
      return;
    }
    if (!validateForm()) return;
    if (!deliveryQuote.ok) {
      setCheckoutError(deliveryQuote.error);
      return;
    }

    const tg = getTelegramUser();
    const uid = getTelegramWebAppUserId();
    const userId = Number.isFinite(uid) ? uid : Number(tg?.id);
    const promoCode = cleanInput(promo);
    const phoneTrimmed = phone.trim();

    let payTotal = goodsAfterPromo + deliveryFeeSom;
    if (promoCode) {
      const applied = await applyPromoCode();
      if (applied == null) return;
      payTotal = applied + deliveryFeeSom;
    } else {
      setPromoPreview(null);
    }

    const nameClean = cleanInput(name);
    const addressClean = cleanInput(address);
    const commentClean = cleanInput(comment);
    const displayName =
      nameClean ||
      (tg?.first_name ? cleanInput(tg.first_name) : "") ||
      "Гость";

    setSubmitting(true);
    setCheckoutError(null);
    let redirecting = false;
    try {
      const tenantParams =
        businessId != null ? { businessId, shop: String(businessId) } : {};
      const preorderCtx = readPreorderContext();
      const checkoutReservationId =
        reservationId ?? preorderCtx?.reservationId ?? null;

      const { data } = await api.post<{
        id: number;
        businessId?: number;
        paymentUrl?: string | null;
      }>("/orders", {
        ...tenantParams,
        ...(readTableSession()?.tableSessionId != null
          ? { tableSessionId: readTableSession()!.tableSessionId }
          : {}),
        ...(checkoutReservationId != null
          ? { reservationId: checkoutReservationId }
          : {}),
        ...(Number.isFinite(userId) ? { userId } : {}),
        user: {
          telegramId: Number.isFinite(Number(tg?.id)) ? Number(tg?.id) : 0,
          name: displayName,
        },
        phone: phoneTrimmed,
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          price: i.price,
          options: i.options ?? {},
        })),
        subtotal,
        total: payTotal,
        deliveryType,
        address: addressClean,
        ...(lat != null && lng != null ? { lat, lng } : {}),
        promo: promoCode,
        comment: commentClean,
        paymentMethod: "finik",
      });

      const payUrl =
        typeof data.paymentUrl === "string" && data.paymentUrl.trim() !== ""
          ? data.paymentUrl.trim()
          : null;

      if (payUrl) {
        redirecting = true;
        const resolvedBusinessId =
          businessId != null && businessId > 0
            ? businessId
            : typeof data.businessId === "number" && data.businessId > 0
              ? data.businessId
              : null;
        if (resolvedBusinessId != null) {
          setPendingFinikOrder({
            orderId: data.id,
            businessId: resolvedBusinessId,
            paymentUrl: payUrl,
          });
        }
        setFinikRedirectMessage(t("checkout.redirecting"));
        window.setTimeout(() => {
          openTelegramExternalLink(payUrl);
          setFinikRedirectMessage(null);
          setSubmitting(false);
        }, 400);
        return;
      }

      setCheckoutError(t("checkout.payLinkMissing"));
    } catch (err) {
      setCheckoutError(orderErrorMessage(err));
    } finally {
      if (!redirecting) {
        setSubmitting(false);
      }
    }
  };

  submitRef.current = () => {
    void handleSubmit();
  };

  useEffect(() => {
    const onPaid = () => {
      clearCart();
      clearPreorderContext();
      setReservationId(null);
      window.dispatchEvent(new CustomEvent("sf:preorderCompleted"));
      setName("");
      setPhone("");
      setPhoneFromSavedOrder(false);
      setAddress("");
      setLat(null);
      setLng(null);
      setPromo("");
      setComment("");
      setPromoPreview(null);
      setFieldErrors({});
      setFinikRedirectMessage(null);
      setSubmitting(false);
    };
    window.addEventListener("sf:finikPaymentPaid", onPaid as EventListener);
    return () =>
      window.removeEventListener("sf:finikPaymentPaid", onPaid as EventListener);
  }, [clearCart, setReservationId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setFinikRedirectMessage(null);
        setSubmitting(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (items.length === 0) {
    return (
      <div className="checkout checkout--empty">
        <button type="button" className="checkout-back" onClick={onBack}>
          {t("checkout.backToCart")}
        </button>
        <h2>{t("checkout.title")}</h2>
        <p className="checkout-empty-text">{t("checkout.emptyCart")}</p>
        {onBack && (
          <button type="button" className="order-btn" onClick={onBack}>
            {t("checkout.backToCart")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="checkout checkout--flow">
      {finikRedirectMessage != null && (
        <div className="checkout-finik-overlay" role="status" aria-live="polite">
          <div className="checkout-finik-overlay__spinner" aria-hidden />
          <p className="checkout-finik-overlay__text">{finikRedirectMessage}</p>
        </div>
      )}
      {onBack && (
        <button type="button" className="checkout-back" onClick={onBack}>
          {t("checkout.backToCart")}
        </button>
      )}

      {tableSession ? (
        <p className="checkout-table-banner" role="status">
          🍽 Заказ к столу: <strong>{tableSession.tableName}</strong>
        </p>
      ) : null}
      <h2 className="checkout-page-title">{t("checkout.title")}</h2>

      {checkoutError != null && (
        <div className="checkout-error-banner" role="alert">
          <p>{checkoutError}</p>
          <button
            type="button"
            className="checkout-error-banner__retry"
            onClick={() => {
              setCheckoutError(null);
              submitRef.current();
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      <section className="checkout-summary" aria-label={t("checkout.summary")}>
        <h3 className="checkout-summary__title">{t("checkout.summary")}</h3>
        <ul className="checkout-summary__items">
          {items.map((item) => {
            const variant = formatOrderLineSummary({
              businessType,
              size: item.size,
              color: item.color,
              options: item.options,
            });
            const key = cartLineIdentityKey(item);
            return (
              <li key={key} className="checkout-summary__row">
                <div className="checkout-summary__item-main">
                  <span className="checkout-summary__name">{item.name}</span>
                  {variant && (
                    <span className="checkout-summary__variant">{variant}</span>
                  )}
                  <span className="checkout-summary__qty">
                    {item.quantity} {t("checkout.qty")}
                  </span>
                </div>
                <span className="checkout-summary__price">
                  {formatSom(item.price * item.quantity)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="checkout-summary__totals">
          <div className="checkout-summary__line">
            <span>{t("checkout.subtotal")}</span>
            <span>{formatSom(subtotal)}</span>
          </div>
          <div className="checkout-summary__line">
            <span>
              {deliveryType === "pickup"
                ? t("checkout.pickup")
                : t("checkout.delivery")}
            </span>
            <span>{deliverySummaryLabel}</span>
          </div>
          {manualDeliveryNotice != null ? (
            <p className="checkout-summary__hint">{manualDeliveryNotice}</p>
          ) : null}
          {promoPreview && discountAmount > 0 && (
            <div className="checkout-summary__line checkout-summary__line--discount">
              <span>
                {t("checkout.discount")} ({promoPreview.discount}%)
              </span>
              <span>−{formatSom(discountAmount)}</span>
            </div>
          )}
        </div>
      </section>

      <div className="checkout-form-scroll">
        <div className="checkout-form">
          <div className="checkout-field">
            <label className="checkout-field__label" htmlFor="checkout-name">
              {t("checkout.name")}
            </label>
            <input
              id="checkout-name"
              className={fieldErrors.name ? "checkout-field--error" : ""}
              placeholder={t("checkout.name")}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              autoComplete="name"
            />
            {fieldErrors.name && (
              <p className="checkout-field__error">{fieldErrors.name}</p>
            )}
          </div>

          {!phoneFromSavedOrder && (
            <div className="checkout-field">
              <label className="checkout-field__label" htmlFor="checkout-phone">
                {t("checkout.phone")}
              </label>
              <input
                id="checkout-phone"
                className={fieldErrors.phone ? "checkout-field--error" : ""}
                placeholder="+996 XXX XXX XXX"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) {
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                inputMode="tel"
                autoComplete="tel"
              />
              {fieldErrors.phone && (
                <p className="checkout-field__error">{fieldErrors.phone}</p>
              )}
            </div>
          )}

          {deliveryType !== "pickup" && !pickupOnly ? (
          <div className="checkout-field">
            <label className="checkout-field__label" htmlFor="checkout-address">
              {t("checkout.address")}
            </label>
            <div className="checkout-address-block">
              <div className="checkout-address-suggest">
                <input
                  id="checkout-address"
                  placeholder={t("checkout.address")}
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  autoComplete="street-address"
                  aria-autocomplete="list"
                  aria-expanded={
                    addressSuggestions.length > 0 || addressSearchLoading
                  }
                />
                {addressSearchLoading && (
                  <p
                    className="checkout-address-suggest__loading"
                    role="status"
                    aria-live="polite"
                  >
                    {t("checkout.addressSearch")}
                  </p>
                )}
                {addressSuggestions.length > 0 && (
                  <div
                    className="checkout-address-suggest__list"
                    role="listbox"
                    aria-label={t("checkout.address")}
                  >
                    {addressSuggestions.map((item) => (
                      <button
                        key={item.place_id}
                        type="button"
                        role="option"
                        className="checkout-address-suggest__item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectAddress(item);
                        }}
                      >
                        {item.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="checkout-loc-actions">
                <button
                  type="button"
                  className="checkout-loc-btn"
                  onClick={() => getLocation()}
                  disabled={loadingLocation || submitting}
                >
                  {loadingLocation
                    ? t("checkout.geoLoading")
                    : t("checkout.geoBtn")}
                </button>
                <button
                  type="button"
                  className="checkout-loc-btn checkout-loc-btn--map"
                  onClick={() => setShowMapPicker((v) => !v)}
                  disabled={submitting}
                  aria-expanded={showMapPicker}
                >
                  {showMapPicker ? t("checkout.mapHide") : t("checkout.mapShow")}
                </button>
              </div>
              {showMapPicker && (
                <div className="checkout-map-wrap">
                  <MapPicker
                    lat={lat}
                    lng={lng}
                    setLat={(v) => setLat(v)}
                    setLng={(v) => setLng(v)}
                    setAddress={(v) => {
                      setAddress(v);
                      if (addressSearchTimerRef.current) {
                        clearTimeout(addressSearchTimerRef.current);
                        addressSearchTimerRef.current = null;
                      }
                      addressSearchSeqRef.current += 1;
                      setAddressSuggestions([]);
                      setAddressSearchLoading(false);
                    }}
                  />
                  <p className="checkout-map-hint">{t("checkout.mapHint")}</p>
                </div>
              )}
              {!loadingLocation && lat != null && lng != null && (
                <p className="checkout-loc-coords" aria-live="polite">
                  {checkoutLocationLabel(address)}
                </p>
              )}
            </div>
          </div>
          ) : null}

          <div className="checkout-field">
            <label className="checkout-field__label" htmlFor="checkout-delivery">
              {t("checkout.deliveryType")}
            </label>
            {pickupOnly ? (
              <p className="checkout-field__hint">{t("checkout.pickup")}</p>
            ) : (
            <select
              id="checkout-delivery"
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value)}
            >
              <option value="delivery">{t("checkout.delivery")}</option>
              <option value="pickup">{t("checkout.pickup")}</option>
            </select>
            )}
          </div>

          <div className="checkout-field">
            <label className="checkout-field__label" htmlFor="checkout-promo">
              {t("checkout.promoCode")}
            </label>
            <div className="checkout-promo-row">
              <input
                id="checkout-promo"
                placeholder={t("checkout.promoCode")}
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  setPromoPreview(null);
                  setPromoError(null);
                }}
              />
              <button
                type="button"
                className="checkout-promo-apply"
                onClick={handleCheckPromo}
                disabled={promoChecking || !promo.trim()}
              >
                {t("checkout.promoApply")}
              </button>
            </div>
            {promoError && (
              <p className="checkout-field__error">{promoError}</p>
            )}
          </div>

          <div className="checkout-field">
            <label className="checkout-field__label" htmlFor="checkout-comment">
              {t("checkout.comment")}
            </label>
            <textarea
              id="checkout-comment"
              placeholder={t("checkout.comment")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <div className="checkout-payment">
            <p className="checkout-payment__summary" aria-live="polite">
              {t("checkout.paymentHint")}
            </p>
          </div>
        </div>
      </div>

      <div className="checkout-footer checkout-footer--sticky">
        <div className="checkout-footer__total">
          <span className="checkout-footer__total-label">{t("checkout.total")}</span>
          <strong className="checkout-footer__total-value">
            {formatSom(totalPrice)}
          </strong>
        </div>

        <button
          type="button"
          className="order-btn order-btn--primary order-btn--checkout"
          onClick={handleSubmit}
          disabled={
            submitting ||
            finikRedirectMessage != null ||
            Boolean(cartStockIssue) ||
            !deliveryQuote.ok
          }
        >
          {submitting ? t("checkout.submitting") : t("checkout.submit")}
        </button>
      </div>
    </div>
  );
}
