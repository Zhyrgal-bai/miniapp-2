import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTelegramWebApp } from "../utils/telegram";
import { resolveMerchantTelegramUserId } from "../utils/telegramUserId";
import {
  fetchRegistrationStatus,
  submitPlatformRegisterRequest,
} from "../services/platformApi";
import { trackPlatformFunnel } from "../services/platformFunnel";
import { formatApiError } from "../utils/adminApiError";
import "./MerchantRegisterPage.css";

const SS_SHOP = "miniapp-active-shop";

/** То же ключ — в PlatformPage после возврата показать успех и перезагрузить список. */
export const MERCHANT_REGISTER_SENT_KEY = "merchant-register-sent";

type BusinessType = "clothing" | "coffee" | "fastfood" | "flowers";

const BUSINESS_TYPES: Array<{
  id: BusinessType;
  emoji: string;
  label: string;
}> = [
  { id: "clothing", emoji: "👕", label: "Одежда" },
  { id: "coffee", emoji: "☕", label: "Кофейня" },
  { id: "fastfood", emoji: "🍔", label: "Фастфуд" },
  { id: "flowers", emoji: "🌸", label: "Цветочный" },
];

const STEP_LABELS = [
  "Тип бизнеса",
  "Название",
  "Токен бота",
  "Телефон",
  "Finik",
  "Проверка",
];

const TOTAL_STEPS = 6;

function businessTypeLabel(id: BusinessType | ""): string {
  return BUSINESS_TYPES.find((b) => b.id === id)?.label ?? "—";
}

type BackBtn = {
  show: () => void;
  hide: () => void;
  onClick: (fn: () => void) => void;
  offClick: (fn: () => void) => void;
};

function parseBackButton(tg: unknown): BackBtn | null {
  const bb = (tg as { BackButton?: Partial<BackBtn> } | undefined)?.BackButton;
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

export default function MerchantRegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [storeName, setStoreName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [phone, setPhone] = useState("");
  const [finikApiKey, setFinikApiKey] = useState("");
  const [finikAccountId, setFinikAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateMessage, setGateMessage] = useState<string | null>(null);

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
    trackPlatformFunnel("register_start");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await fetchRegistrationStatus();
        if (cancelled) return;
        if (status.status === "pending") {
          setGateMessage(
            `Заявка «${status.storeName ?? "магазин"}» уже на рассмотрении.`,
          );
        } else if (status.status === "has_stores") {
          setGateMessage("У вас уже есть магазин. Новую заявку можно подать позже.");
        } else if (status.status === "rejected") {
          setGateMessage(null);
        }
      } catch {
        if (!cancelled) setGateMessage(null);
      } finally {
        if (!cancelled) setGateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goBackStep = useCallback(() => {
    if (step <= 1) {
      goMerchant();
      return;
    }
    setSubmitError(null);
    setStep((s) => s - 1);
  }, [step, goMerchant]);

  useEffect(() => {
    const tg = getTelegramWebApp();
    const bb = parseBackButton(tg);
    if (bb) {
      bb.show();
      bb.onClick(goBackStep);
    }
    return () => {
      if (bb) {
        bb.offClick(goBackStep);
        bb.hide();
      }
    };
  }, [goBackStep]);

  const ownerUsername = useMemo(() => {
    const tg = getTelegramWebApp() as {
      initDataUnsafe?: { user?: { username?: string } };
    } | null;
    const u = tg?.initDataUnsafe?.user?.username;
    return typeof u === "string" ? u.trim().replace(/^@/, "") : undefined;
  }, []);

  const finikPairError = useMemo(() => {
    const key = finikApiKey.trim();
    const account = finikAccountId.trim();
    if (key === "" && account === "") return null;
    if (key === "" && account !== "") return "Укажите API Key вместе с Account ID";
    if (key !== "" && account === "") return "Укажите Account ID Finik";
    if (key.length < 4) return "API Key слишком короткий";
    if (account.length < 2) return "Account ID слишком короткий";
    return null;
  }, [finikApiKey, finikAccountId]);

  const canNext = useMemo(() => {
    if (step === 1) return businessType !== "";
    if (step === 2) return storeName.trim().length >= 2;
    if (step === 3) return botToken.trim().length > 10;
    if (step === 4) return phone.trim().length >= 9;
    if (step === 5) return finikPairError == null;
    return true;
  }, [step, businessType, storeName, botToken, phone, finikPairError]);

  const goNext = () => {
    if (!canNext) return;
    setSubmitError(null);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  const handleSubmit = async () => {
    const uid = resolveMerchantTelegramUserId(getTelegramWebApp());
    if (!Number.isFinite(uid) || uid <= 0) {
      setSubmitError("Нет данных пользователя Telegram. Откройте из Mini App.");
      return;
    }
    if (businessType === "") {
      setSubmitError("Выберите тип бизнеса");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const key = finikApiKey.trim();
      const account = finikAccountId.trim();
      await submitPlatformRegisterRequest({
        storeName: storeName.trim(),
        botToken: botToken.trim(),
        phone: phone.trim(),
        telegramId: uid,
        businessType,
        ownerUsername,
        ...(key !== "" && account !== ""
          ? { finikApiKey: key, finikAccountId: account }
          : {}),
      });
      trackPlatformFunnel("register_submit");
      try {
        sessionStorage.setItem(MERCHANT_REGISTER_SENT_KEY, "1");
      } catch {
        /* ignore */
      }
      goMerchant();
    } catch (e) {
      setSubmitError(formatApiError(e));
      setStep(TOTAL_STEPS);
    } finally {
      setSubmitting(false);
    }
  };

  if (gateLoading) {
    return (
      <div className="mr">
        <p className="mr__loading">Загрузка…</p>
      </div>
    );
  }

  if (gateMessage != null) {
    return (
      <div className="mr">
        <header className="mr__header">
          <div className="mr__brand">
            <p className="mr__brand-name">ARCHA</p>
            <p className="mr__brand-sub">Регистрация</p>
          </div>
          <button type="button" onClick={goMerchant} className="mr__close">
            Закрыть
          </button>
        </header>
        <div className="mr__form">
          <div className="mr__card">
            <div className="mr__card-head">
              <h1 className="mr__title">Заявка уже отправлена</h1>
              <p className="mr__subtitle">{gateMessage}</p>
            </div>
            <div className="mr__submit-wrap">
              <button type="button" onClick={goMerchant} className="mr__submit">
                В кабинет
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="mr__brand-sub">
            Шаг {Math.min(step, TOTAL_STEPS)} из {TOTAL_STEPS} ·{" "}
            {STEP_LABELS[step - 1]}
          </p>
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

      <div className="mr__progress" aria-hidden>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span
            key={n}
            className={`mr__progress-dot${n <= step ? " mr__progress-dot--active" : ""}`}
          />
        ))}
      </div>

      <div className="mr__form">
        <div className="mr__card">
          {step === 1 ? (
            <>
              <div className="mr__card-head">
                <h1 className="mr__title">Тип бизнеса</h1>
                <p className="mr__subtitle">Выберите шаблон для вашего магазина</p>
              </div>
              <ul className="mr__type-list">
                {BUSINESS_TYPES.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`mr__type-btn${businessType === t.id ? " mr__type-btn--active" : ""}`}
                      onClick={() => setBusinessType(t.id)}
                    >
                      <span className="mr__type-emoji">{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="mr__card-head">
                <h1 className="mr__title">Название магазина</h1>
                <p className="mr__subtitle">Как увидят клиенты</p>
              </div>
              <div className="mr__field mr__field--solo">
                <input
                  id="mr-store-name"
                  type="text"
                  autoFocus
                  minLength={2}
                  maxLength={160}
                  autoComplete="organization"
                  placeholder="Например: Archa Store"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="mr__input"
                />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="mr__card-head">
                <h1 className="mr__title">Токен бота</h1>
                <p className="mr__subtitle">
                  Создайте бота в @BotFather и вставьте токен
                </p>
              </div>
              <div className="mr__field mr__field--solo">
                <input
                  id="mr-bot-token"
                  type="password"
                  autoFocus
                  autoComplete="off"
                  placeholder="1234567890:ABC…"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="mr__input mr__input--mono"
                />
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div className="mr__card-head">
                <h1 className="mr__title">Телефон</h1>
                <p className="mr__subtitle">Для связи оператора с вами</p>
              </div>
              <div className="mr__field mr__field--solo">
                <input
                  id="mr-phone"
                  type="tel"
                  autoFocus
                  inputMode="tel"
                  placeholder="+996…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mr__input"
                />
              </div>
              <p className="mr__hint">+996 и 9 цифр или 0 и 9 цифр</p>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <div className="mr__card-head">
                <h1 className="mr__title">Finik (опционально)</h1>
                <p className="mr__subtitle">
                  API Key и Account ID можно указать сейчас или после одобрения в
                  настройках магазина
                </p>
              </div>
              <div className="mr__field">
                <label className="mr__label" htmlFor="mr-finik-key">
                  API Key
                </label>
                <input
                  id="mr-finik-key"
                  type="password"
                  autoComplete="off"
                  placeholder="Оставьте пустым, чтобы пропустить"
                  value={finikApiKey}
                  onChange={(e) => setFinikApiKey(e.target.value)}
                  className="mr__input mr__input--mono"
                />
              </div>
              <div className="mr__field mr__field--solo">
                <label className="mr__label" htmlFor="mr-finik-account">
                  Account ID
                </label>
                <input
                  id="mr-finik-account"
                  type="text"
                  autoComplete="off"
                  placeholder="Оставьте пустым, чтобы пропустить"
                  value={finikAccountId}
                  onChange={(e) => setFinikAccountId(e.target.value)}
                  className="mr__input mr__input--mono"
                />
              </div>
              {finikPairError ? (
                <p className="mr__err" role="alert">
                  {finikPairError}
                </p>
              ) : null}
            </>
          ) : null}

          {step >= 6 ? (
            <>
              <div className="mr__card-head">
                <h1 className="mr__title">Проверьте заявку</h1>
                <p className="mr__subtitle">
                  После отправки магазин создастся только после одобрения
                </p>
              </div>
              <dl className="mr__review">
                <div className="mr__review-row">
                  <dt>Тип</dt>
                  <dd>{businessTypeLabel(businessType)}</dd>
                </div>
                <div className="mr__review-row">
                  <dt>Название</dt>
                  <dd>{storeName.trim()}</dd>
                </div>
                <div className="mr__review-row">
                  <dt>Токен бота</dt>
                  <dd className="mr__review-masked">••••••••</dd>
                </div>
                <div className="mr__review-row">
                  <dt>Телефон</dt>
                  <dd>{phone.trim()}</dd>
                </div>
                <div className="mr__review-row">
                  <dt>Finik</dt>
                  <dd>
                    {finikApiKey.trim() !== "" && finikAccountId.trim() !== ""
                      ? "API Key + Account ID"
                      : "не подключён"}
                  </dd>
                </div>
                {ownerUsername ? (
                  <div className="mr__review-row">
                    <dt>Telegram</dt>
                    <dd>@{ownerUsername}</dd>
                  </div>
                ) : null}
              </dl>
            </>
          ) : null}

          {submitError ? (
            <p className="mr__err" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="mr__submit-wrap">
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={goNext}
                className="mr__submit"
              >
                Далее
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="mr__submit"
              >
                {submitting ? "Отправка…" : "Отправить заявку"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
