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
import {
  putStorefrontStyleCatalogPatch,
  type CatalogFooterSlideInput,
} from "../../services/storefrontStyleCatalogApi";

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
  const { refresh: refreshStorefrontPayload, payload: storefrontPayload } = useStorefrontPayload();

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

  const [footerSliderEnabled, setFooterSliderEnabled] = useState(false);
  const [footerSliderTitle, setFooterSliderTitle] = useState("Акции");
  const [footerSlides, setFooterSlides] = useState<CatalogFooterSlideInput[]>([
    { image: "", href: "", caption: "" },
    { image: "", href: "", caption: "" },
  ]);
  const [catalogGridBoost, setCatalogGridBoost] = useState<"normal" | "bold">("bold");

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

  const syncCatalogStyleFromPayload = useCallback(() => {
    const st = storefrontPayload?.storefrontStyleConfig;
    if (!st || typeof st !== "object") return;
    const o = st as Record<string, unknown>;
    const cf = o.catalogFooter;
    if (cf && typeof cf === "object") {
      const c = cf as Record<string, unknown>;
      setFooterSliderEnabled(Boolean(c.enabled));
      setFooterSliderTitle(typeof c.title === "string" && c.title.trim() !== "" ? c.title : "Акции");
      const slidesRaw = Array.isArray(c.slides) ? c.slides : [];
      const slides: CatalogFooterSlideInput[] = slidesRaw.map((row) => {
        if (!row || typeof row !== "object") return { image: "", href: "", caption: "" };
        const r = row as Record<string, unknown>;
        return {
          image: typeof r.image === "string" ? r.image : "",
          href: typeof r.href === "string" ? r.href : "",
          caption: typeof r.caption === "string" ? r.caption : "",
        };
      });
      const next = slides.length > 0 ? [...slides] : [];
      while (next.length < 2) next.push({ image: "", href: "", caption: "" });
      setFooterSlides(next.slice(0, 10));
    }
    const cat = o.catalog;
    if (cat && typeof cat === "object" && "gridBoost" in cat) {
      const gb = (cat as { gridBoost?: string }).gridBoost;
      setCatalogGridBoost(gb === "normal" ? "normal" : "bold");
    }
  }, [storefrontPayload?.storefrontStyleConfig]);

  useEffect(() => {
    syncCatalogStyleFromPayload();
  }, [syncCatalogStyleFromPayload]);

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
      const slidesOut = footerSlides
        .map((s) => ({
          image: s.image.trim(),
          href: (s.href ?? "").trim(),
          caption: (s.caption ?? "").trim(),
        }))
        .filter((s) => s.image !== "");
      if (footerSliderEnabled && slidesOut.length === 0) {
        setError("Слайдер включён: добавьте хотя бы одну картинку (https, разрешённый хост).");
        return;
      }
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
      await putStorefrontStyleCatalogPatch(businessId, {
        catalog: { gridBoost: catalogGridBoost },
        catalogFooter: {
          enabled: footerSliderEnabled,
          title: footerSliderTitle.trim() === "" ? "Акции" : footerSliderTitle.trim(),
          slides: slidesOut,
        },
      });
      await Promise.all([refresh(), refreshStorefrontPayload()]);
      setOk("Сохранено. Откройте «Магазин» — цвета и нижний блок обновятся.");
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

        <p className="admin-theme-subtitle">Каталог и низ витрины</p>
        <p className="admin-dash-page__subtitle" style={{ marginBottom: 10 }}>
          Слайдер внизу — после каталога. Картинки: https и тот же набор хостов, что для витрины (например Cloudinary).
        </p>
        <p className="admin-theme-subtitle admin-theme-hint--tight" style={{ marginBottom: 6 }}>
          Вид сетки товаров
        </p>
        <div className="admin-theme-layout-switch" style={{ marginBottom: 14 }}>
          {(["normal", "bold"] as const).map((b) => (
            <button
              key={b}
              type="button"
              className={`admin-theme-layout-switch__btn${catalogGridBoost === b ? " admin-theme-layout-switch__btn--on" : ""}`}
              onClick={() => setCatalogGridBoost(b)}
            >
              {b === "normal" ? "Спокойная" : "Мощная"}
            </button>
          ))}
        </div>

        <div className="admin-theme-banner" style={{ marginBottom: 8 }}>
          <label className="admin-theme-toggle">
            <input
              type="checkbox"
              checked={footerSliderEnabled}
              onChange={(e) => setFooterSliderEnabled(e.target.checked)}
            />
            Показывать нижний слайдер на витрине
          </label>
          <label className="admin-theme-field admin-theme-field--full">
            Заголовок над слайдером
            <input
              type="text"
              value={footerSliderTitle}
              onChange={(e) => setFooterSliderTitle(e.target.value)}
              maxLength={80}
              disabled={!footerSliderEnabled}
            />
          </label>
        </div>

        <div className="admin-dash-page__subtitle" style={{ marginBottom: 8 }}>
          Слайды (до 10)
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {footerSlides.map((row, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: 10,
                opacity: footerSliderEnabled ? 1 : 0.55,
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.85 }}>Слайд {idx + 1}</p>
              <label className="admin-theme-field admin-theme-field--full">
                Картинка (URL)
                <input
                  type="url"
                  value={row.image}
                  disabled={!footerSliderEnabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFooterSlides((prev) => prev.map((p, i) => (i === idx ? { ...p, image: v } : p)));
                  }}
                  placeholder="https://…"
                />
              </label>
              <label className="admin-theme-field admin-theme-field--full">
                Ссылка (необязательно)
                <input
                  type="url"
                  value={row.href ?? ""}
                  disabled={!footerSliderEnabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFooterSlides((prev) => prev.map((p, i) => (i === idx ? { ...p, href: v } : p)));
                  }}
                  placeholder="https://…"
                />
              </label>
              <label className="admin-theme-field admin-theme-field--full">
                Подпись
                <input
                  type="text"
                  value={row.caption ?? ""}
                  disabled={!footerSliderEnabled}
                  maxLength={120}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFooterSlides((prev) => prev.map((p, i) => (i === idx ? { ...p, caption: v } : p)));
                  }}
                />
              </label>
            </div>
          ))}
        </div>
        {footerSlides.length < 10 ? (
          <button
            type="button"
            className="admin-theme-reset"
            style={{ marginTop: 10 }}
            disabled={!footerSliderEnabled}
            onClick={() =>
              setFooterSlides((prev) => [...prev, { image: "", href: "", caption: "" }])
            }
          >
            Добавить слайд
          </button>
        ) : null}

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
