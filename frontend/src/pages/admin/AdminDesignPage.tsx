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
import { putStorefrontStyleCatalogPatch } from "../../services/storefrontStyleCatalogApi";
import { putStorefrontTextBrandingPatch } from "../../services/storefrontTextBrandingApi";
import { adminService } from "../../services/admin.service";
import { buildCloudinaryResponsiveUrl } from "../../utils/cloudinaryTransforms";
import { storeBrandInitials } from "../../components/layout/storeBrandHeaderUtils";
import { formatAdminApiError } from "../../utils/adminApiError";
import type { Product } from "../../types";
import { buildFooterSliderSlidesFromProducts } from "../../components/storefront/sections/CatalogFooterSlider";
import {
  DEFAULT_CATALOG_FOOTER_RAIL,
  parseCatalogFooterRailSettings,
  type CatalogFooterRailDirection,
  type CatalogFooterRailSpeed,
} from "../../storefront/catalogFooterRailSettings";
import { ru } from "../../i18n/ru";

const TEMPLATE_LABELS: Record<StoreTemplateId, string> = {
  red: "Красный",
  dark: "Тёмный",
  light: "Светлый",
  luxury: "Премиум",
  minimal: "Минимал",
  fashion: ru.admin.fashionTemplate,
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
  const [brandTagline, setBrandTagline] = useState("");
  const [logoUploadBusy, setLogoUploadBusy] = useState(false);

  const [footerSliderEnabled, setFooterSliderEnabled] = useState(false);
  const [footerSliderTitle, setFooterSliderTitle] = useState("Букеты");
  const [catalogGridBoost, setCatalogGridBoost] = useState<"normal" | "bold">("bold");

  const [railAutoMove, setRailAutoMove] = useState(DEFAULT_CATALOG_FOOTER_RAIL.autoMove);
  const [railDirection, setRailDirection] = useState<CatalogFooterRailDirection>(
    DEFAULT_CATALOG_FOOTER_RAIL.direction,
  );
  const [railSpeed, setRailSpeed] = useState<CatalogFooterRailSpeed>(DEFAULT_CATALOG_FOOTER_RAIL.speed);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);

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

  const syncBrandingFromPayload = useCallback(() => {
    const txt = storefrontPayload?.storefrontTextConfig;
    if (!txt || typeof txt !== "object") return;
    const tag = (txt as Record<string, unknown>).brandTagline;
    if (typeof tag === "string") setBrandTagline(tag);
  }, [storefrontPayload?.storefrontTextConfig]);

  const syncCatalogStyleFromPayload = useCallback(() => {
    const st = storefrontPayload?.storefrontStyleConfig;
    if (!st || typeof st !== "object") return;
    const o = st as Record<string, unknown>;
    const cf = o.catalogFooter;
    if (cf && typeof cf === "object") {
      const c = cf as Record<string, unknown>;
      setFooterSliderEnabled(Boolean(c.enabled));
      setFooterSliderTitle(typeof c.title === "string" && c.title.trim() !== "" ? c.title : "Букеты");
    }
    const cat = o.catalog;
    if (cat && typeof cat === "object" && "gridBoost" in cat) {
      const gb = (cat as { gridBoost?: string }).gridBoost;
      setCatalogGridBoost(gb === "normal" ? "normal" : "bold");
    }
    const sc = parseCatalogFooterRailSettings(o as Record<string, unknown>);
    setRailAutoMove(sc.autoMove);
    setRailDirection(sc.direction);
    setRailSpeed(sc.speed);
  }, [storefrontPayload?.storefrontStyleConfig]);

  useEffect(() => {
    syncCatalogStyleFromPayload();
    syncBrandingFromPayload();
  }, [syncCatalogStyleFromPayload, syncBrandingFromPayload]);

  useEffect(() => {
    if (businessId == null) return;
    let alive = true;
    void (async () => {
      try {
        const rows = await adminService.getProducts();
        if (!alive) return;
        setCatalogProducts(rows);
      } catch {
        if (!alive) return;
        setCatalogProducts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [businessId]);

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

  const footerSliderProductCount = buildFooterSliderSlidesFromProducts(catalogProducts).length;

  const previewStoreName =
    storefrontPayload?.storeName?.trim() || "Ваш магазин";
  const previewLogoSrc =
    logoUrl.trim() !== ""
      ? buildCloudinaryResponsiveUrl(logoUrl.trim(), "thumbnail")
      : "";

  const onLogoFile = async (file: File | null) => {
    if (!file || businessId == null) return;
    const okType = /image\/(png|jpe?g|webp)/i.test(file.type);
    if (!okType) {
      setError("Логотип: PNG, JPG или WEBP.");
      return;
    }
    setLogoUploadBusy(true);
    setError(null);
    try {
      const url = await adminService.uploadImage(file);
      setLogoUrl(url);
      setOk("Логотип загружен. Нажмите «Сохранить».");
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setLogoUploadBusy(false);
    }
  };

  const onSave = async () => {
    if (businessId == null) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      if (footerSliderEnabled && footerSliderProductCount === 0) {
        setError("Слайдер включён, но в каталоге нет товаров с фото.");
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
      await putStorefrontTextBrandingPatch(businessId, {
        brandTagline: brandTagline.trim(),
        drawerTagline: brandTagline.trim(),
      });
      await putStorefrontStyleCatalogPatch(businessId, {
        catalog: { gridBoost: catalogGridBoost },
        catalogFooter: {
          enabled: footerSliderEnabled,
          title: footerSliderTitle.trim() === "" ? "Букеты" : footerSliderTitle.trim(),
          slides: [],
          rail: {
            autoMove: railAutoMove,
            direction: railDirection,
            speed: railSpeed,
            pauseOnTouch: true,
            infiniteLoop: true,
          },
        },
      });
      await Promise.all([refresh(), refreshStorefrontPayload()]);
      setOk("Сохранено. Откройте «Магазин» — цвета и нижний блок обновятся.");
    } catch (e) {
      setError(formatAdminApiError(e));
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

        <p className="admin-theme-subtitle">Бренд в шапке витрины</p>
        <p className="admin-dash-page__subtitle" style={{ marginBottom: 12 }}>
          Логотип, название и слоган — как в премиум Mini App. Покупатели увидят это вверху
          витрины.
        </p>
        <div className="admin-theme-logo admin-brand-header-editor">
          <div
            className="admin-brand-header-preview"
            style={{
              borderColor: `${primaryColor}44`,
              background: `linear-gradient(145deg, ${primaryColor}22, ${bgColor})`,
            }}
          >
            <div className="admin-brand-header-preview__main">
              <div className="admin-brand-header-preview__logo">
                {previewLogoSrc !== "" ? (
                  <img src={previewLogoSrc} alt="" />
                ) : (
                  <span>{storeBrandInitials(previewStoreName)}</span>
                )}
              </div>
              <div className="admin-brand-header-preview__copy">
                <strong>{previewStoreName}</strong>
                <span>
                  {brandTagline.trim() !== ""
                    ? brandTagline.trim()
                    : bannerSubtitle.trim() !== ""
                      ? bannerSubtitle.trim()
                      : "Слоган магазина"}
                </span>
              </div>
            </div>
            <div className="admin-brand-header-preview__actions" aria-hidden>
              <i />
              <i />
            </div>
          </div>

          <label className="admin-theme-upload">
            Загрузить логотип
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={logoUploadBusy || saving}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void onLogoFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {logoUploadBusy ? (
            <p className="admin-dash-page__muted">Загрузка…</p>
          ) : null}
          <label className="admin-theme-field admin-theme-field--full">
            Или вставьте ссылку (https)
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          {logoUrl.trim() !== "" ? (
            <button
              type="button"
              className="admin-theme-reset"
              disabled={saving || logoUploadBusy}
              onClick={() => setLogoUrl("")}
            >
              Удалить логотип
            </button>
          ) : null}
          <label className="admin-theme-field admin-theme-field--full">
            Слоган под названием
            <input
              type="text"
              value={brandTagline}
              onChange={(e) => setBrandTagline(e.target.value)}
              maxLength={120}
              placeholder="Например: доставка цветов за 2 часа"
            />
          </label>
        </div>

        <p className="admin-theme-subtitle">Каталог и низ витрины</p>
        <p className="admin-dash-page__subtitle" style={{ marginBottom: 10 }}>
          Нижняя лента товаров — плавное непрерывное движение. По нажатию открывается карточка товара.
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
          <p className="admin-dash-page__muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
            Слайдер автоматически показывает все товары из каталога с фото
            {footerSliderProductCount > 0
              ? ` (${footerSliderProductCount})`
              : " — добавьте товары с картинками в каталог"}.
          </p>
          <label className="admin-theme-field admin-theme-field--full">
            Заголовок над слайдером
            <input
              type="text"
              value={footerSliderTitle}
              onChange={(e) => setFooterSliderTitle(e.target.value)}
              maxLength={80}
              disabled={!footerSliderEnabled}
              placeholder="Букеты"
            />
          </label>
          <p className="admin-theme-subtitle admin-theme-hint--tight" style={{ marginTop: 12 }}>
            Движение ленты
          </p>
          <label className="admin-theme-toggle">
            <input
              type="checkbox"
              checked={railAutoMove}
              onChange={(e) => setRailAutoMove(e.target.checked)}
              disabled={!footerSliderEnabled}
            />
            Автопрокрутка
          </label>
          <p className="admin-theme-subtitle admin-theme-hint--tight" style={{ marginTop: 8 }}>
            Направление
          </p>
          <div className="admin-theme-layout-switch" style={{ marginBottom: 8 }}>
            {(["left", "right"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={`admin-theme-layout-switch__btn${railDirection === d ? " admin-theme-layout-switch__btn--on" : ""}`}
                onClick={() => setRailDirection(d)}
                disabled={!footerSliderEnabled}
              >
                {d === "left" ? "Влево ←" : "Вправо →"}
              </button>
            ))}
          </div>
          <p className="admin-theme-subtitle admin-theme-hint--tight">Скорость</p>
          <div className="admin-theme-layout-switch">
            {(["slow", "medium", "fast"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`admin-theme-layout-switch__btn${railSpeed === s ? " admin-theme-layout-switch__btn--on" : ""}`}
                onClick={() => setRailSpeed(s)}
                disabled={!footerSliderEnabled || !railAutoMove}
              >
                {s === "slow" ? "Медленно" : s === "medium" ? "Средне" : "Быстро"}
              </button>
            ))}
          </div>
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
