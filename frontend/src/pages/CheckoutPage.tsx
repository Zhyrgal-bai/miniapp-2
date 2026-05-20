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
    const data = err.response?.data as
      | { error?: string; details?: Record<string, string> }
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
    if (data?.error) return data.error;
  }
  return t("checkout.errorGeneric");
}

export default function CheckoutPage({ onBack }: Props) {
  const { businessId } = useShop();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (businessId != null && businessId > 0) {
      trackCheckoutStart(businessId);
    }
  }, [businessId]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0),
    [items],
  );

  const discountAmount = useMemo(() => {
    if (!promoPreview) return 0;
    return Math.max(0, subtotal - promoPreview.newTotal);
  }, [promoPreview, subtotal]);

  const totalPrice = promoPreview?.newTotal ?? subtotal;

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
    } catch (e) {
      console.error(e);
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
          } catch (e) {
            console.error(e);
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
    if (!validateForm()) return;

    const tg = getTelegramUser();
    const uid = getTelegramWebAppUserId();
    const userId = Number.isFinite(uid) ? uid : Number(tg?.id);
    const promoCode = cleanInput(promo);
    const phoneTrimmed = phone.trim();

    let payTotal = subtotal;
    if (promoCode) {
      const applied = await applyPromoCode();
      if (applied == null) return;
      payTotal = applied;
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
      const { data } = await api.post<{
        id: number;
        businessId?: number;
        paymentUrl?: string | null;
      }>("/orders", {
        ...tenantParams,
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
          clearCart();
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
        }, 400);
        return;
      }

      setCheckoutError(t("checkout.payLinkMissing"));
    } catch (err) {
      console.error(err);
      setCheckoutError(orderErrorMessage(err));
    } finally {
      if (!redirecting) {
        setSubmitting(false);
      }
    }
  };

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

      <h2 className="checkout-page-title">{t("checkout.title")}</h2>

      {checkoutError != null && (
        <div className="checkout-error-banner" role="alert">
          <p>{checkoutError}</p>
          <button
            type="button"
            className="checkout-error-banner__retry"
            onClick={() => setCheckoutError(null)}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      <section className="checkout-summary" aria-label={t("checkout.summary")}>
        <h3 className="checkout-summary__title">{t("checkout.summary")}</h3>
        <ul className="checkout-summary__items">
          {items.map((item) => {
            const variant = [item.size, item.color]
              .filter((v) => v && String(v).trim() !== "")
              .join(" · ");
            const key = `${item.productId}-${item.size}-${item.color}`;
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
            <span>{t("checkout.deliveryFree")}</span>
          </div>
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
                  {t("checkout.coordsSaved")} ({lat.toFixed(5)}, {lng.toFixed(5)})
                </p>
              )}
            </div>
          </div>

          <div className="checkout-field">
            <label className="checkout-field__label" htmlFor="checkout-delivery">
              {t("checkout.deliveryType")}
            </label>
            <select
              id="checkout-delivery"
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value)}
            >
              <option value="delivery">{t("checkout.delivery")}</option>
              <option value="pickup">{t("checkout.pickup")}</option>
            </select>
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
          disabled={submitting || finikRedirectMessage != null}
        >
          {submitting ? t("checkout.submitting") : t("checkout.submit")}
        </button>
      </div>
    </div>
  );
}
