import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  TEMPLATES,
  STORE_TEMPLATE_IDS,
  type StoreLayout,
  type StoreTemplateId,
} from "@repo-shared/storeTheme";
import { useShop } from "../../context/ShopContext";
import { useTheme } from "../../context/ThemeContext";
import { useStorefrontPayload } from "../../components/storefront/runtime/StorefrontPayloadContext";
import { saveBusinessThemePut } from "../../services/businessThemeApi";

const TEMPLATE_LABELS: Record<StoreTemplateId, string> = {
  red: "Красный",
  dark: "Тёмный",
  light: "Светлый",
  luxury: "Премиум",
  minimal: "Минимал",
  fashion: "Fashion",
  neon: "Неон",
};

function normTemplateId(raw: string | null | undefined): StoreTemplateId | null {
  if (raw == null || raw === "") return null;
  const t = raw.trim().toLowerCase();
  return (STORE_TEMPLATE_IDS as readonly string[]).includes(t)
    ? (t as StoreTemplateId)
    : null;
}

export default function AdminDesignPage(): ReactElement {
  const { businessId } = useShop();
  const { theme, templateId: serverTemplateId, refresh, loading: themeLoading } =
    useTheme();
  const { refresh: refreshStorefrontPayload } = useStorefrontPayload();

  const [templateId, setTemplateId] = useState<StoreTemplateId | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [bgColor, setBgColor] = useState("#0f172a");
  const [cardColor, setCardColor] = useState("#1e293b");
  const [textColor, setTextColor] = useState("#ffffff");
  const [layout, setLayout] = useState<StoreLayout>("modern");
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const syncFromServer = useCallback(() => {
    setTemplateId(normTemplateId(serverTemplateId));
    setPrimaryColor(theme.primaryColor);
    setBgColor(theme.bgColor);
    setCardColor(theme.cardColor);
    setTextColor(theme.textColor);
    setLayout(theme.layout);
    setBannerEnabled(theme.banner.enabled);
    setBannerTitle(theme.banner.title);
    setBannerSubtitle(theme.banner.subtitle);
    setLogoUrl(theme.logoUrl ?? "");
  }, [
    serverTemplateId,
    theme.primaryColor,
    theme.bgColor,
    theme.cardColor,
    theme.textColor,
    theme.layout,
    theme.banner.enabled,
    theme.banner.title,
    theme.banner.subtitle,
    theme.logoUrl,
  ]);

  useEffect(() => {
    if (themeLoading) return;
    syncFromServer();
  }, [themeLoading, syncFromServer]);

  const pickTemplate = (id: StoreTemplateId) => {
    const t = TEMPLATES[id];
    setTemplateId(id);
    setPrimaryColor(t.primaryColor);
    setBgColor(t.bgColor);
    setCardColor(t.cardColor);
    setTextColor(t.textColor);
    setLayout(t.layout);
    setBannerEnabled(t.banner.enabled);
    setBannerTitle(t.banner.title);
    setBannerSubtitle(t.banner.subtitle);
    setError(null);
    setOk(null);
  };

  const onSave = async () => {
    if (businessId == null) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const patch = {
        primaryColor,
        bgColor,
        cardColor,
        textColor,
        layout,
        banner: {
          enabled: bannerEnabled,
          title: bannerTitle,
          subtitle: bannerSubtitle,
        },
        logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
        ...(templateId != null ? { templateId } : {}),
      };
      await saveBusinessThemePut(businessId, patch);
      await Promise.all([refresh(), refreshStorefrontPayload()]);
      setOk("Сохранено. Откройте «Магазин» — цвета обновятся сразу.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const onReloadFromServer = () => {
    setError(null);
    setOk(null);
    void Promise.all([refresh(), refreshStorefrontPayload()]);
  };

  if (businessId == null) {
    return (
      <div className="admin-dash-page">
        <header className="admin-dash-page__head">
          <h1 className="admin-dash-page__title">Оформление витрины</h1>
          <p className="admin-dash-page__subtitle">
            Откройте магазин с параметром shop, чтобы менять дизайн.
          </p>
        </header>
        <p className="admin-dash-page__muted">Магазин не выбран.</p>
      </div>
    );
  }

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Оформление витрины</h1>
        <p className="admin-dash-page__subtitle">
          Пресеты, цвета, баннер и логотип сохраняются для покупателей в миниаппе.
        </p>
      </header>

      {themeLoading ? (
        <p className="admin-dash-page__muted">Загрузка текущей темы…</p>
      ) : null}

      <div className="admin-dash-card">
        <p className="admin-theme-subtitle admin-theme-hint--tight">Готовые темы</p>
        <p className="admin-dash-page__subtitle" style={{ marginBottom: 12 }}>
          Нажмите карточку — подставятся цвета пресета, их можно потом подправить.
        </p>
        <div className="admin-theme-templates">
          {STORE_TEMPLATE_IDS.map((id) => {
            const t = TEMPLATES[id];
            const active = templateId === id;
            return (
              <button
                key={id}
                type="button"
                className={`admin-theme-template-card${active ? " admin-theme-template-card--active" : ""}`}
                onClick={() => pickTemplate(id)}
              >
                <span className="admin-theme-template-card__swatches" aria-hidden>
                  <i style={{ background: t.bgColor }} />
                  <i style={{ background: t.cardColor }} />
                  <i style={{ background: t.primaryColor }} />
                </span>
                <span className="admin-theme-template-card__label">
                  {TEMPLATE_LABELS[id]}
                </span>
                <span className="admin-theme-template-card__meta">{id}</span>
              </button>
            );
          })}
        </div>

        <p className="admin-theme-subtitle">Сетка витрины</p>
        <div className="admin-theme-layout-switch">
          {(["classic", "modern"] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`admin-theme-layout-switch__btn${layout === l ? " admin-theme-layout-switch__btn--on" : ""}`}
              onClick={() => setLayout(l)}
            >
              {l === "classic" ? "Классика" : "Современный"}
            </button>
          ))}
        </div>

        <p className="admin-theme-subtitle">Цвета (#RRGGBB)</p>
        <div className="admin-theme-grid">
          <label className="admin-theme-field">
            Акцент
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              aria-label="Цвет акцента"
            />
          </label>
          <label className="admin-theme-field">
            Фон
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              aria-label="Фон"
            />
          </label>
          <label className="admin-theme-field">
            Карточки
            <input
              type="color"
              value={cardColor}
              onChange={(e) => setCardColor(e.target.value)}
              aria-label="Карточки"
            />
          </label>
          <label className="admin-theme-field">
            Текст
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              aria-label="Текст"
            />
          </label>
        </div>

        <div className="admin-theme-banner">
          <label className="admin-theme-toggle">
            <input
              type="checkbox"
              checked={bannerEnabled}
              onChange={(e) => setBannerEnabled(e.target.checked)}
            />
            Показывать баннер на витрине
          </label>
          <label className="admin-theme-field admin-theme-field--full">
            Заголовок баннера
            <input
              type="text"
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              maxLength={280}
            />
          </label>
          <label className="admin-theme-field admin-theme-field--full">
            Подзаголовок
            <input
              type="text"
              value={bannerSubtitle}
              onChange={(e) => setBannerSubtitle(e.target.value)}
              maxLength={280}
            />
          </label>
        </div>

        <div className="admin-theme-logo">
          <label className="admin-theme-field admin-theme-field--full">
            Логотип (URL, только https)
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>

        <div
          className="admin-theme-preview"
          style={{
            marginTop: 12,
            borderRadius: 12,
            padding: 14,
            background: bgColor,
            color: textColor,
          }}
        >
          <div
            style={{
              borderRadius: 10,
              padding: 12,
              background: cardColor,
              border: `1px solid ${primaryColor}55`,
            }}
          >
            <span style={{ color: primaryColor, fontWeight: 800 }}>Превью</span>
            <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.95 }}>
              Так будут сочетаться фон, карточка и акцент.
            </p>
          </div>
        </div>

        <div className="admin-theme-actions">
          <button
            type="button"
            className="admin-members-actions__btn admin-members-actions__btn--promote"
            disabled={saving || themeLoading}
            onClick={() => void onSave()}
          >
            {saving ? "Сохранение…" : "Сохранить на сервер"}
          </button>
          <button
            type="button"
            className="admin-theme-reset"
            disabled={saving || themeLoading}
            onClick={onReloadFromServer}
          >
            Сбросить к серверу
          </button>
        </div>

        {error ? (
          <div className="admin-dash-card admin-dash-page__alert" role="alert">
            <p style={{ margin: 0, color: "#fecaca", fontSize: 14 }}>{error}</p>
          </div>
        ) : null}
        {ok ? <p className="admin-theme-msg">{ok}</p> : null}
      </div>
    </div>
  );
}
