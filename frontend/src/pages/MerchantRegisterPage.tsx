import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTelegramWebApp } from "../utils/telegram";
import { resolveMerchantTelegramUserId } from "../utils/telegramUserId";
import { submitPlatformRegisterRequest } from "../services/platformApi";
import "./MerchantRegisterPage.css";

const SS_SHOP = "miniapp-active-shop";

/** То же ключ — в PlatformPage после возврата показать успех и перезагрузить список. */
export const MERCHANT_REGISTER_SENT_KEY = "merchant-register-sent";

type BackBtn = {
  show: () => void;
  hide: () => void;
  onClick: (fn: () => void) => void;
  offClick: (fn: () => void) => void;
};

function parseBackButton(tg: unknown): BackBtn | null {
  const bb = (
    tg as { BackButton?: Partial<BackBtn> } | undefined
  )?.BackButton;
  if (
    bb == null ||
    typeof bb.show !== "function" ||
    typeof bb.hide !== "function" ||
    typeof bb.onClick !== "function" ||
    typeof bb.offClick !== "function"
  ) {
    return null;
  }
  return bb as BackBtn;
}

/**
 * Отдельная страница заявки на магазин — в Telegram WebView модальные слои часто не видны,
 * переход по маршруту работает надёжно.
 */
export default function MerchantRegisterPage() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const goMerchant = useCallback(() => {
    navigate("/merchant", { replace: true });
  }, [navigate]);

  useEffect(() => {
    try {
      sessionStorage.removeItem(SS_SHOP);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    try {
      getTelegramWebApp()?.expand?.();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const tg = getTelegramWebApp();
    const bb = parseBackButton(tg);
    if (bb) {
      bb.show();
      bb.onClick(goMerchant);
    }
    return () => {
      if (bb) {
        bb.offClick(goMerchant);
        bb.hide();
      }
    };
  }, [goMerchant]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const uid = resolveMerchantTelegramUserId(getTelegramWebApp());
    if (!Number.isFinite(uid) || uid <= 0) {
      setSubmitError("Нет данных пользователя Telegram. Откройте из Mini App.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitPlatformRegisterRequest({
        storeName: storeName.trim(),
        botToken: botToken.trim(),
        phone: phone.trim(),
        telegramId: uid,
      });
      try {
        sessionStorage.setItem(MERCHANT_REGISTER_SENT_KEY, "1");
      } catch {
        /* ignore */
      }
      goMerchant();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mr">
      <header className="mr__header">
        <img
          src="/674440574_18101674030793392_828162833995675842_n.jpg"
          alt="ARCHA"
          width={40}
          height={40}
          className="mr__logo"
        />
        <div className="mr__brand">
          <p className="mr__brand-name">ARCHA</p>
          <p className="mr__brand-sub">Новый магазин</p>
        </div>
        <button
          type="button"
          onClick={goMerchant}
          className="mr__close"
          aria-label="Закрыть"
        >
          Закрыть
        </button>
      </header>

      <form
        className="mr__form"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div className="mr__card">
          <div className="mr__card-head">
            <h1 id="merchant-register-title" className="mr__title">
              Создание магазина
            </h1>
            <p
              id="merchant-register-desc"
              className="mr__subtitle"
            >
              Заполните поля — заявка уйдёт на проверку
            </p>
          </div>

          <div className="mr__fields">
            <div className="mr__field">
              <label htmlFor="mr-store-name" className="mr__label">
                Название
              </label>
              <input
                id="mr-store-name"
                type="text"
                required
                minLength={2}
                maxLength={160}
                autoComplete="organization"
                placeholder="Например: Archa Store"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="mr__input"
              />
            </div>
            <div className="mr__field">
              <label htmlFor="mr-bot-token" className="mr__label">
                Токен бота
              </label>
              <input
                id="mr-bot-token"
                type="password"
                autoComplete="off"
                required
                placeholder="От BotFather"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="mr__input mr__input--mono"
              />
            </div>
            <div className="mr__field">
              <label htmlFor="mr-phone" className="mr__label">
                Телефон
              </label>
              <input
                id="mr-phone"
                type="tel"
                required
                inputMode="tel"
                placeholder="+996…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mr__input"
              />
            </div>
          </div>

          <p className="mr__hint">+996 и 9 цифр или 0 и 9 цифр</p>

          {submitError ? (
            <p className="mr__err" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="mr__submit-wrap">
            <button
              type="submit"
              disabled={submitting}
              className="mr__submit"
            >
              {submitting ? "Отправка…" : "Отправить заявку"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
