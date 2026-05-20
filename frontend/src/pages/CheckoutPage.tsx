import { useCallback, useEffect, useRef, useState } from "react";
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

const PROMO_APPLY_ERROR = "Неверный или использован промокод";

type NominatimSearchItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const ADDRESS_SEARCH_DEBOUNCE_MS = 450;

function orderErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return "Не удалось оформить заказ. Попробуйте позже.";
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
    null
  );
  const addressSearchSeqRef = useRef(0);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [deliveryType, setDeliveryType] = useState("delivery");
  const [promo, setPromo] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** Телефон уже был в прошлом заказе — поле ввода не показываем */
  const [phoneFromSavedOrder, setPhoneFromSavedOrder] = useState(false);
  const [promoPreview, setPromoPreview] = useState<{
    newTotal: number;
    discount: number;
  } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [finikRedirectMessage, setFinikRedirectMessage] = useState<
    string | null
  >(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (businessId != null && businessId > 0) {
      trackCheckoutStart(businessId);
    }
  }, [businessId]);

  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * (item.quantity ?? 1),
    0
  );

  useEffect(() => {
    setPromoPreview(null);
  }, [totalPrice]);

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
          prev != null ? String(prev.phone ?? prev.customerPhone ?? "").trim() : "";
        const trimmed = saved != null ? String(saved).trim() : "";
        if (!cancelled && trimmed !== "") {
          setPhone(trimmed);
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
      return totalPrice;
    }
    const shop = buildCatalogRequestParams().shop;
    const businessId = shop ? Number(shop) : NaN;
    if (!Number.isInteger(businessId) || businessId <= 0) {
      alert(
        "Откройте мини-приложение со ссылкой ?shop=id_магазина — нужен промокод по магазину"
      );
      setPromoPreview(null);
      return null;
    }
    try {
      const applyRes = await api.post<{ newTotal?: number; discount?: number }>(
        "/promo/apply",
        { code, total: totalPrice, businessId },
      );
      const data = applyRes.data;
      if (
        data.newTotal == null ||
        data.discount == null ||
        !Number.isFinite(data.newTotal)
      ) {
        alert(PROMO_APPLY_ERROR);
        setPromoPreview(null);
        return null;
      }
      setPromoPreview({ newTotal: data.newTotal, discount: data.discount });
      return data.newTotal;
    } catch {
      alert(PROMO_APPLY_ERROR);
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
      const t = value.trim();
      if (t.length < 3) {
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
        void runAddressSearch(t);
      }, ADDRESS_SEARCH_DEBOUNCE_MS);
    },
    [runAddressSearch]
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
      alert("Геолокация не поддерживается");
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
            if (typeof data.display_name === "string" && data.display_name.trim()) {
              setAddress(data.display_name.trim().slice(0, 2000));
            }
          } catch (e) {
            console.error(e);
            alert("Не удалось получить адрес");
          } finally {
            setLoadingLocation(false);
          }
        })();
      },
      () => {
        alert("Разрешите доступ к геолокации");
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 }
    );
  }, []);

  const handleCheckPromo = async () => {
    if (!promo.trim()) {
      return;
    }
    setPromoChecking(true);
    try {
      await applyPromoCode();
    } finally {
      setPromoChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (!name.trim()) {
      alert("Укажите имя");
      return;
    }
    if (!phone.trim()) {
      alert("Укажите номер телефона");
      return;
    }
    const phoneTrimmed = phone.trim();
    if (!validateKgPhone(phoneTrimmed)) {
      alert("Введите правильный номер: +996XXXXXXXXX или 0556XXXXXX");
      if (phoneFromSavedOrder) {
        setPhoneFromSavedOrder(false);
      }
      return;
    }

    const tg = getTelegramUser();
    const uid = getTelegramWebAppUserId();
    const userId = Number.isFinite(uid) ? uid : Number(tg?.id);
    const promoCode = cleanInput(promo);

    let payTotal = totalPrice;
    if (promoCode) {
      const t = await applyPromoCode();
      if (t == null) return;
      payTotal = t;
    } else {
      setPromoPreview(null);
    }

    const nameClean = cleanInput(name);
    const addressClean = cleanInput(address);
    const commentClean = cleanInput(comment);
    const displayName =
      nameClean || (tg?.first_name ? cleanInput(tg.first_name) : "") || "Гость";

    const orderData = {
      name: displayName,
      phone: phoneTrimmed,
      address: addressClean,
      items: items.map((i) => ({
        name: i.name,
        size: i.size,
        quantity: i.quantity,
      })),
      total: payTotal,
    };

    setSubmitting(true);
    setCheckoutError(null);
    let redirecting = false;
    try {
      const tenantParams =
        businessId != null
          ? { businessId, shop: String(businessId) }
          : {};
      const { data } = await api.post<{
        id: number;
        businessId?: number;
        paymentUrl?: string | null;
      }>("/orders", {
        ...tenantParams,
        ...(Number.isFinite(userId) ? { userId } : {}),
        user: {
          telegramId: Number.isFinite(Number(tg?.id)) ? Number(tg?.id) : 0,
          name: orderData.name || "Гость",
        },
        phone: orderData.phone,
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          price: i.price,
        })),
        subtotal: totalPrice,
        total: payTotal,
        deliveryType,
        address: orderData.address,
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
          setPendingFinikOrder({ orderId: data.id, businessId: resolvedBusinessId });
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
        }, 400);
        return;
      }

      setCheckoutError(
        "Не удалось получить ссылку на оплату. Заказ создан — откройте «Мои заказы»."
      );
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
          ← Корзина
        </button>
        <h2>Оформление заказа</h2>
        <p className="checkout-empty-text">Корзина пуста</p>
        {onBack && (
          <button type="button" className="order-btn" onClick={onBack}>
            Вернуться в корзину
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
          ← Корзина
        </button>
      )}

      <h2>{t("checkout.title")}</h2>

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

      <div className="checkout-form-scroll">
      <div className="form">
        <input
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {!phoneFromSavedOrder && (
          <input
            placeholder="Введите номер телефона"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
        )}
        <div className="checkout-address-block">
          <div className="checkout-address-suggest">
            <input
              placeholder="Введите адрес"
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
                Поиск...
              </p>
            )}
            {addressSuggestions.length > 0 && (
              <div
                className="checkout-address-suggest__list"
                role="listbox"
                aria-label="Подсказки адреса"
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
              {loadingLocation ? "Определяем адрес..." : "📍 Определить адрес"}
            </button>
            <button
              type="button"
              className="checkout-loc-btn checkout-loc-btn--map"
              onClick={() => setShowMapPicker((v) => !v)}
              disabled={submitting}
              aria-expanded={showMapPicker}
            >
              {showMapPicker ? "🗺 Скрыть карту" : "🗺 Выбрать на карте"}
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
              <p className="checkout-map-hint">
                Нажмите на карту, чтобы поставить точку и подставить адрес
              </p>
            </div>
          )}
          {loadingLocation && (
            <p className="checkout-loc-status" role="status" aria-live="polite">
              Определяем адрес...
            </p>
          )}
          {!loadingLocation && lat != null && lng != null && (
            <p className="checkout-loc-coords" aria-live="polite">
              Координаты сохранены для заказа ({lat.toFixed(5)}, {lng.toFixed(5)})
            </p>
          )}
        </div>

        <select
          value={deliveryType}
          onChange={(e) => setDeliveryType(e.target.value)}
        >
          <option value="delivery">Доставка</option>
          <option value="pickup">Самовывоз</option>
        </select>

        <div className="checkout-promo-row">
          <input
            placeholder="Промокод"
            value={promo}
            onChange={(e) => {
              setPromo(e.target.value);
              setPromoPreview(null);
            }}
          />
          <button
            type="button"
            className="checkout-promo-apply"
            onClick={handleCheckPromo}
            disabled={promoChecking || !promo.trim()}
          >
            Применить
          </button>
        </div>
        <textarea
          placeholder="Комментарий"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />

        <div className="checkout-payment">
          <p className="checkout-payment__label">Оплата</p>
          <p className="checkout-payment__summary" aria-live="polite">
            {t("checkout.paymentHint")}
          </p>
        </div>
      </div>
      </div>

      <div className="checkout-footer checkout-footer--sticky">
        <div className="total">
          <span>{t("checkout.total")}</span>
          <strong>
            {promoPreview ? promoPreview.newTotal : totalPrice} сом
          </strong>
        </div>
        {promoPreview && (
          <div className="checkout-promo-result">
            <p className="checkout-promo-result__line">
              Новая цена: <strong>{promoPreview.newTotal} сом</strong>
            </p>
            <p className="checkout-promo-result__line">
              Скидка: <strong>{promoPreview.discount}%</strong>
            </p>
            <p className="checkout-promo-hint">Без скидки: {totalPrice} сом</p>
          </div>
        )}

        <button
          type="button"
          className="order-btn order-btn--primary"
          onClick={handleSubmit}
          disabled={submitting || finikRedirectMessage != null}
        >
          {submitting
            ? t("checkout.submitting")
            : t("checkout.submit")}
        </button>
      </div>
    </div>
  );
}
