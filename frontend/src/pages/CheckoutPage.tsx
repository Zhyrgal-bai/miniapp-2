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
import { isCheckoutSubmitBlocked } from "../commerce/checkoutSubmitGuard";
import { setPendingFinikOrder, shouldReleaseCheckoutSubmitOnResume, hasPendingFinikCheckout, readPendingFinikOrder, releasePendingFinikCheckout, isPendingFinikCheckoutExpired } from "../utils/pendingFinikOrder";
import { FINIK_PAYMENT_POLL_MS, FINIK_PAYMENT_RELEASED_EVENT, FINIK_PAYMENT_TIMEOUT_MS } from "../utils/finikPaymentEvents";
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
import { useCheckoutDeliveryQuote } from "../hooks/useCheckoutDeliveryQuote";
import {
  markCustomerLocationGranted,
  readCustomerLocationAddress,
} from "../storefront/customerLocationStorage";
import {
  readCheckoutAutofillHints,
  rememberCheckoutAutofill,
  resolveCheckoutAutofill,
  resolveAutofillField,
  type AutofillRecipient,
} from "../storefront/customerAutofillStorage";
import { reverseGeocodeKg } from "../utils/nominatimGeocode";
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
  address?: string;
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
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const [recentRecipients, setRecentRecipients] = useState<AutofillRecipient[]>([]);
  const nameTouchedRef = useRef(false);
  const phoneTouchedRef = useRef(false);
  const addressTouchedRef = useRef(false);
  const autofillHydratedRef = useRef(false);
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
  /** Sync guard — blocks double-tap before React `submitting` state updates (C2). */
  const submitLockRef = useRef(false);

  const unlockFinikWait = useCallback(() => {
    submitLockRef.current = false;
    setSubmitting(false);
    setFinikRedirectMessage(null);
  }, []);

  /** M5: remount after Finik redirect — poll until paid, cancelled, timeout, or user starts over. */
  useEffect(() => {
    const unlockIfIdle = () => {
      if (!hasPendingFinikCheckout()) unlockFinikWait();
    };

    if (!hasPendingFinikCheckout()) return;

    if (isPendingFinikCheckoutExpired()) {
      releasePendingFinikCheckout();
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setFinikRedirectMessage(t("checkout.paymentAwaiting"));

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const pend = readPendingFinikOrder();
      if (pend == null) {
        unlockFinikWait();
        return;
      }
      if (Date.now() - pend.startedAt > FINIK_PAYMENT_TIMEOUT_MS) {
        releasePendingFinikCheckout();
        return;
      }
      if (businessId == null || pend.businessId !== businessId) return;

      const uid = getTelegramWebAppUserId();
      if (!Number.isFinite(uid) || uid <= 0) return;

      try {
        const rows = await fetchMyOrders(uid, buildCatalogRequestParams().shop);
        const order = rows.find((o) => o.id === pend.orderId);
        if (!order) return;
        const st = String(order.status ?? "").toUpperCase();
        if (st === "CANCELLED") {
          releasePendingFinikCheckout();
        }
      } catch {
        /* keep waiting — user can start a new order manually */
      }
    };

    void tick();
    const pollId = window.setInterval(() => void tick(), FINIK_PAYMENT_POLL_MS);
    const onReleased = () => unlockFinikWait();
    window.addEventListener(FINIK_PAYMENT_RELEASED_EVENT, onReleased);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener(FINIK_PAYMENT_RELEASED_EVENT, onReleased);
      unlockIfIdle();
    };
  }, [businessId, unlockFinikWait]);

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
    if (businessId == null || businessId <= 0) return;
    if (deliveryType === "pickup" || pickupOnly) return;
    const saved = readCustomerLocationAddress(businessId);
    if (saved == null) return;
    if (lat == null && saved.latitude != null) setLat(saved.latitude);
    if (lng == null && saved.longitude != null) setLng(saved.longitude);
    if (address.trim() === "" && saved.formattedAddress) {
      setAddress(saved.formattedAddress);
    }
  }, [businessId, deliveryType, pickupOnly, lat, lng, address]);

  useEffect(() => {
    if (pickupOnly) setDeliveryType("pickup");
  }, [pickupOnly]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0),
    [items],
  );

  const customerCoords = useMemo(() => {
    if (deliveryType === "pickup") {
      return { latitude: null as number | null, longitude: null as number | null };
    }
    const saved = businessId != null ? readCustomerLocationAddress(businessId) : null;
    return {
      latitude: lat ?? saved?.latitude ?? null,
      longitude: lng ?? saved?.longitude ?? null,
    };
  }, [deliveryType, lat, lng, businessId]);

  const checkoutDelivery = useCheckoutDeliveryQuote({
    merchantId: businessId,
    fulfillmentMode: deliveryType === "pickup" ? "PICKUP" : "DELIVERY",
    subtotalSom: subtotal,
    latitude: customerCoords.latitude,
    longitude: customerCoords.longitude,
  });

  const deliveryFeeSom = checkoutDelivery.deliveryFeeSom;
  const manualDeliveryNotice = checkoutDelivery.manualMessage;

  const deliverySummaryLabel = useMemo(() => {
    if (checkoutDelivery.loading && deliveryType === "delivery") {
      return "Расчёт доставки…";
    }
    return checkoutDelivery.displayLabel;
  }, [checkoutDelivery.loading, checkoutDelivery.displayLabel, deliveryType]);

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
    if (autofillHydratedRef.current) return;
    if (businessId == null || businessId <= 0) return;
    autofillHydratedRef.current = true;
    const telegramUser = getTelegramUser();
    const telegramName = [telegramUser?.first_name, telegramUser?.last_name]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
      .join(" ")
      .trim();
    const telegramPhoneRaw =
      telegramUser != null &&
      typeof (telegramUser as unknown as { phone_number?: unknown }).phone_number === "string"
        ? (telegramUser as unknown as { phone_number?: string }).phone_number ?? null
        : null;
    const telegramPhone = resolveAutofillField(
      null,
      telegramPhoneRaw,
    );
    const hints = readCheckoutAutofillHints(businessId);
    setRecentAddresses(
      [hints.addresses.home, hints.addresses.work, hints.addresses.last, ...hints.recentAddresses]
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .slice(0, 8),
    );
    setRecentRecipients(hints.recentRecipients.slice(0, 8));

    let cancelled = false;
    void (async () => {
      const uid = getTelegramWebAppUserId();
      let recentOrder: { name?: string | null; phone?: string | null; address?: string | null } | null =
        null;
      if (Number.isFinite(uid) && uid > 0) {
        try {
          const rows = await fetchMyOrders(uid, buildCatalogRequestParams().shop);
          if (cancelled) return;
          const best = rows.find(
            (o) =>
              resolveAutofillField(null, o.phone, o.customerPhone) !== "" ||
              resolveAutofillField(null, o.address) !== "",
          );
          if (best) {
            recentOrder = {
              name: resolveAutofillField(
                null,
                (best as { customerName?: unknown }).customerName as string | null | undefined,
                (best as { name?: unknown }).name as string | null | undefined,
              ),
              phone: resolveAutofillField(null, best.phone, best.customerPhone),
              address: resolveAutofillField(null, best.address),
            };
          }
        } catch {
          /* do not block checkout */
        }
      }
      if (cancelled) return;
      const merged = resolveCheckoutAutofill({
        explicit: { name, phone, address },
        saved: hints.profile,
        recentOrder: recentOrder ?? undefined,
        telegram: { name: telegramName, phone: telegramPhone || null, address: null },
      });
      if (!nameTouchedRef.current && name.trim() === "" && merged.name !== "") {
        setName(merged.name);
      }
      if (!phoneTouchedRef.current && phone.trim() === "" && merged.phone !== "") {
        setPhone(merged.phone);
        setPhoneFromSavedOrder(true);
      }
      if (!addressTouchedRef.current && address.trim() === "" && merged.address !== "") {
        setAddress(merged.address);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId, name, phone, address]);

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
      if (fieldErrors.address) {
        setFieldErrors((prev) => ({ ...prev, address: undefined }));
      }
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
    [runAddressSearch, fieldErrors.address],
  );

  const selectAddress = useCallback((item: NominatimSearchItem) => {
    addressTouchedRef.current = true;
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

  const applyRecentAddress = useCallback((value: string) => {
    addressTouchedRef.current = true;
    if (addressSearchTimerRef.current) {
      clearTimeout(addressSearchTimerRef.current);
      addressSearchTimerRef.current = null;
    }
    addressSearchSeqRef.current += 1;
    setAddressSearchLoading(false);
    setAddressSuggestions([]);
    setAddress(value);
    if (fieldErrors.address) {
      setFieldErrors((prev) => ({ ...prev, address: undefined }));
    }
  }, [fieldErrors.address]);

  const applyRecentRecipient = useCallback((recipient: AutofillRecipient) => {
    nameTouchedRef.current = true;
    phoneTouchedRef.current = true;
    setName(recipient.name);
    setPhone(recipient.phone);
    setPhoneFromSavedOrder(true);
    if (fieldErrors.name || fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, name: undefined, phone: undefined }));
    }
  }, [fieldErrors.name, fieldErrors.phone]);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setCheckoutError(t("checkout.geoUnsupported"));
      return;
    }
    if (businessId == null || businessId <= 0) return;
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
            const geo = await reverseGeocodeKg(nextLat, nextLng);
            if (geo.ok) {
              addressTouchedRef.current = true;
              setAddress(geo.value.displayAddress.slice(0, 2000));
              markCustomerLocationGranted(businessId, {
                latitude: nextLat,
                longitude: nextLng,
                accuracyM: Number.isFinite(pos.coords.accuracy)
                  ? pos.coords.accuracy
                  : null,
                address: {
                  formattedAddress: geo.value.displayAddress,
                  city: geo.value.city,
                  country: "Кыргызстан",
                  street: geo.value.addressLine,
                  houseNumber: null,
                },
              });
            } else {
              setCheckoutError(geo.error);
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
  }, [businessId]);

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
    if (deliveryType !== "pickup" && !pickupOnly && !address.trim()) {
      next.address = t("checkout.addressRequired");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (isCheckoutSubmitBlocked(submitLockRef.current, submitting)) return;
    if (items.length === 0) return;
    if (cartStockIssue) {
      setCheckoutError(cartStockIssue);
      return;
    }
    if (payload?.finikCheckoutReady === false) {
      setCheckoutError(
        "Онлайн-оплата временно недоступна. Магазин ещё не подключил Finik.",
      );
      return;
    }
    if (!validateForm()) return;
    if (!checkoutDelivery.ok) {
      setCheckoutError(checkoutDelivery.errorMessage ?? "Доставка недоступна");
      return;
    }

    const closedNotice = payload?.storeAvailability?.closedCheckoutNotice;
    if (closedNotice != null && closedNotice.trim() !== "") {
      const proceed = window.confirm(`${closedNotice}\n\nПродолжить?`);
      if (!proceed) return;
    }

    const tg = getTelegramUser();
    const uid = getTelegramWebAppUserId();
    const userId = Number.isFinite(uid) ? uid : Number(tg?.id);
    const promoCode = cleanInput(promo);
    const phoneTrimmed = phone.trim();

    submitLockRef.current = true;
    setSubmitting(true);
    setCheckoutError(null);

    let payTotal = goodsAfterPromo + deliveryFeeSom;
    if (promoCode) {
      const applied = await applyPromoCode();
      if (applied == null) {
        submitLockRef.current = false;
        setSubmitting(false);
        return;
      }
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
        ...(checkoutDelivery.providerOfferId
          ? { deliveryOfferId: checkoutDelivery.providerOfferId }
          : {}),
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

      rememberCheckoutAutofill(businessId ?? 0, {
        name: displayName,
        phone: phoneTrimmed,
        address: deliveryType === "pickup" ? null : addressClean,
        deliveryType: deliveryType === "pickup" ? "pickup" : "delivery",
      });

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
        }, 400);
        return;
      }

      setCheckoutError(t("checkout.payLinkMissing"));
    } catch (err) {
      setCheckoutError(orderErrorMessage(err));
    } finally {
      if (!redirecting) {
        submitLockRef.current = false;
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
      submitLockRef.current = false;
      nameTouchedRef.current = false;
      phoneTouchedRef.current = false;
      addressTouchedRef.current = false;
      autofillHydratedRef.current = false;
    };
    window.addEventListener("sf:finikPaymentPaid", onPaid as EventListener);
    return () =>
      window.removeEventListener("sf:finikPaymentPaid", onPaid as EventListener);
  }, [clearCart, setReservationId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (isPendingFinikCheckoutExpired()) {
        releasePendingFinikCheckout();
        return;
      }
      if (!shouldReleaseCheckoutSubmitOnResume()) {
        submitLockRef.current = true;
        setSubmitting(true);
        setFinikRedirectMessage((msg) => msg ?? t("checkout.paymentAwaiting"));
        return;
      }
      unlockFinikWait();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [unlockFinikWait]);

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
          <div className="checkout-finik-overlay__actions">
            {readPendingFinikOrder()?.paymentUrl ? (
              <button
                type="button"
                className="checkout-finik-overlay__btn checkout-finik-overlay__btn--primary"
                onClick={() => {
                  const url = readPendingFinikOrder()?.paymentUrl;
                  if (url) openTelegramExternalLink(url);
                }}
              >
                {t("checkout.paymentRetry")}
              </button>
            ) : null}
            <button
              type="button"
              className="checkout-finik-overlay__btn checkout-finik-overlay__btn--ghost"
              onClick={() => releasePendingFinikCheckout()}
            >
              {t("checkout.paymentNewOrder")}
            </button>
          </div>
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

      {payload?.finikCheckoutReady === false ? (
        <div className="checkout-error-banner" role="alert">
          <p>
            Онлайн-оплата временно недоступна. Магазин ещё не подключил Finik.
          </p>
        </div>
      ) : null}

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
                nameTouchedRef.current = true;
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
            {recentRecipients.length > 0 ? (
              <div className="checkout-autofill-row" aria-label="Недавние получатели">
                {recentRecipients.map((recipient) => (
                  <button
                    key={`${recipient.phone}-${recipient.name}`}
                    type="button"
                    className="checkout-autofill-chip"
                    onClick={() => applyRecentRecipient(recipient)}
                  >
                    {recipient.name} · {recipient.phone}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

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
                phoneTouchedRef.current = true;
                setPhone(e.target.value);
                if (phoneFromSavedOrder) setPhoneFromSavedOrder(false);
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

          {deliveryType !== "pickup" && !pickupOnly ? (
          <div className="checkout-field">
            <label className="checkout-field__label" htmlFor="checkout-address">
              {t("checkout.address")}
            </label>
            <div className="checkout-address-block">
              <div className="checkout-address-suggest">
                <input
                  id="checkout-address"
                  className={fieldErrors.address ? "checkout-field--error" : ""}
                  placeholder={t("checkout.address")}
                  value={address}
                  onChange={(e) => {
                    addressTouchedRef.current = true;
                    handleAddressChange(e.target.value);
                  }}
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
              {recentAddresses.length > 0 ? (
                <div className="checkout-autofill-row" aria-label="Недавние адреса">
                  {recentAddresses.map((recentAddress) => (
                    <button
                      key={recentAddress}
                      type="button"
                      className="checkout-autofill-chip checkout-autofill-chip--address"
                      onClick={() => applyRecentAddress(recentAddress)}
                    >
                      {recentAddress}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="checkout-loc-actions">
                <button
                  type="button"
                  className="checkout-loc-btn"
                  onClick={() => getLocation()}
                  disabled={loadingLocation || submitting}
                >
                  {loadingLocation
                    ? t("checkout.geoLoading")
                    : "📍 Использовать текущее местоположение"}
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
                      addressTouchedRef.current = true;
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
            {fieldErrors.address && (
              <p className="checkout-field__error">{fieldErrors.address}</p>
            )}
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
            !checkoutDelivery.ok ||
            checkoutDelivery.loading ||
            payload?.finikCheckoutReady === false
          }
        >
          {submitting ? t("checkout.submitting") : t("checkout.submit")}
        </button>
      </div>
    </div>
  );
}
