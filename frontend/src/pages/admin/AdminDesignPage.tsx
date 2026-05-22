import { useCallback, useEffect, useState, useRef, type ReactElement, type ChangeEvent } from "react";
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
import { adminService } from "../../services/admin.service";
import { formatAdminApiError } from "../../utils/adminApiError";
import type { Product } from "../../types";
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

  const [footerSliderEnabled, setFooterSliderEnabled] = useState(false);
  const [footerSliderTitle, setFooterSliderTitle] = useState("Акции");
  const [footerSlides, setFooterSlides] = useState<CatalogFooterSlideInput[]>([
    { image: "", href: "", caption: "" },
    { image: "", href: "", caption: "" },
  ]);
  const [catalogGridBoost, setCatalogGridBoost] = useState<"normal" | "bold">("bold");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetSlide, setUploadTargetSlide] = useState<number | null>(null);
  const [uploadingSlideIdx, setUploadingSlideIdx] = useState<number | null>(null);
  const [slidePickerIdx, setSlidePickerIdx] = useState<number | null>(null);
  const [slidePickerQ, setSlidePickerQ] = useState("");
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
          productId:
            typeof r.productId === "number" && Number.isFinite(r.productId) && r.productId > 0
              ? r.productId
              : undefined,
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

  function productRowImage(p: Product): string {
    const a = typeof p.image === "string" ? p.image.trim() : "";
    if (a !== "") return a;
    const u = p.images?.[0];
    return typeof u === "string" ? u.trim() : "";
  }

  const handleSlideUpload = async (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || businessId == null) return;
    setUploadingSlideIdx(idx);
    setError(null);
    try {
      const url = await adminService.uploadImage(file);
      setFooterSlides((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, image: url, productId: undefined } : r)),
      );
    } catch (err) {
      setError(formatAdminApiError(err));
    } finally {
      setUploadingSlideIdx(null);
    }
  };

  const bindProductToSlide = (idx: number, p: Product) => {
    const id = p.id;
    if (typeof id !== "number") return;
    const img = productRowImage(p);
    setFooterSlides((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              productId: id,
              image: img,
              href: "",
              caption: r.caption != null && String(r.caption).trim() !== "" ? r.caption : p.name,
            }
          : r,
      ),
    );
    setSlidePickerIdx(null);
    setSlidePickerQ("");
  };

  const onSave = async () => {
    if (businessId == null) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const slidesOut: CatalogFooterSlideInput[] = footerSlides
        .map((s) => {
          const img = (s.image ?? "").trim();
          const href = (s.href ?? "").trim();
          const caption = (s.caption ?? "").trim();
          const productId =
            typeof s.productId === "number" && s.productId > 0 ? s.productId : undefined;
          const row: CatalogFooterSlideInput = { href, caption };
          if (img !== "") row.image = img;
          if (productId != null) row.productId = productId;
          return row;
        })
        .filter(
          (s) =>
            (s.image != null && String(s.image).trim() !== "") ||
            (s.productId != null && s.productId > 0),
        );
      if (footerSliderEnabled && slidesOut.length === 0) {
        setError("Слайдер включён: загрузите фото или выберите товар из каталога.");
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const idx = uploadTargetSlide;
            setUploadTargetSlide(null);
            if (idx == null) return;
            void handleSlideUpload(idx, e);
          }}
        />

        <p className="admin-theme-subtitle">Каталог и низ витрины</p>
        <p className="admin-dash-page__subtitle" style={{ marginBottom: 10 }}>
          Слайдер внизу витрины: загрузите картинку (Cloudinary) или выберите товар — подставится фото и
          название. По нажатию на витрине откроется карточка товара.
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
          {footerSlides.map((row, idx) => {
            const q = slidePickerQ.trim().toLowerCase();
            const filtered =
              q === ""
                ? catalogProducts
                : catalogProducts.filter((p) => p.name.toLowerCase().includes(q));
            const pickerOpen = slidePickerIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: 10,
                  opacity: footerSliderEnabled ? 1 : 0.55,
                }}
              >
                <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.85 }}>
                  Слайд {idx + 1}
                  {typeof row.productId === "number" && row.productId > 0 ? (
                    <span style={{ marginLeft: 8, opacity: 0.75 }}>· товар #{row.productId}</span>
                  ) : null}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    className="admin-theme-reset"
                    disabled={!footerSliderEnabled || uploadingSlideIdx !== null}
                    onClick={() => {
                      setUploadTargetSlide(idx);
                      fileInputRef.current?.click();
                    }}
                  >
                    {uploadingSlideIdx === idx ? "Загрузка…" : "Загрузить фото"}
                  </button>
                  <button
                    type="button"
                    className="admin-theme-reset"
                    disabled={!footerSliderEnabled}
                    onClick={() => {
                      setSlidePickerIdx(pickerOpen ? null : idx);
                      setSlidePickerQ("");
                    }}
                  >
                    {pickerOpen ? "Скрыть каталог" : "Товар из каталога"}
                  </button>
                  {(row.productId != null && row.productId > 0) || (row.image ?? "").trim() !== "" ? (
                    <button
                      type="button"
                      className="admin-theme-reset"
                      disabled={!footerSliderEnabled}
                      onClick={() =>
                        setFooterSlides((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { image: "", href: "", caption: "", productId: undefined } : r,
                          ),
                        )
                      }
                    >
                      Очистить слайд
                    </button>
                  ) : null}
                </div>
                {pickerOpen ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: 8,
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.2)",
                    }}
                  >
                    <input
                      type="search"
                      value={slidePickerQ}
                      onChange={(e) => setSlidePickerQ(e.target.value)}
                      placeholder="Поиск по названию…"
                      disabled={!footerSliderEnabled}
                      style={{ width: "100%", marginBottom: 8 }}
                    />
                    <div
                      style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      {filtered.slice(0, 80).map((p) => (
                        <button
                          key={String(p.id ?? p.name)}
                          type="button"
                          className="admin-theme-reset"
                          style={{ textAlign: "left", justifyContent: "flex-start" }}
                          disabled={!footerSliderEnabled || p.id == null}
                          onClick={() => bindProductToSlide(idx, p)}
                        >
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                          <span style={{ opacity: 0.7, marginLeft: 8 }}>{p.price} сом</span>
                        </button>
                      ))}
                      {filtered.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>Ничего не найдено</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <label className="admin-theme-field admin-theme-field--full">
                  Картинка (URL, если без загрузки)
                  <input
                    type="url"
                    value={row.image ?? ""}
                    disabled={!footerSliderEnabled}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFooterSlides((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, image: v, productId: undefined } : p)),
                      );
                    }}
                    placeholder="https://… или загрузите файл выше"
                  />
                </label>
                <label className="admin-theme-field admin-theme-field--full">
                  Внешняя ссылка (если не товар)
                  <input
                    type="url"
                    value={row.href ?? ""}
                    disabled={!footerSliderEnabled || (row.productId != null && row.productId > 0)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFooterSlides((prev) => prev.map((p, i) => (i === idx ? { ...p, href: v } : p)));
                    }}
                    placeholder="https://…"
                  />
                </label>
                <label className="admin-theme-field admin-theme-field--full">
                  Подпись на слайде
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
            );
          })}
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
