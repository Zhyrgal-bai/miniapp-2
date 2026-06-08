import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  TEMPLATES,
  STORE_TEMPLATE_IDS,
  type StoreLayout,
  type StoreTemplateId,
} from "@repo-shared/storeTheme";
import { fetchBusinessPublic, saveBusinessThemePut } from "../../../../services/businessThemeApi";
import { putStorefrontTextBrandingPatch } from "../../../../services/storefrontTextBrandingApi";
import { formatAdminApiError } from "../../../../utils/adminApiError";
import { archa } from "../../../archa/archaUi";
import { storeBrandInitials } from "../../../layout/storeBrandHeaderUtils";
import { buildCloudinaryResponsiveUrl } from "../../../../utils/cloudinaryTransforms";
import { ru } from "../../../../i18n/ru";

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

type Props = {
  businessId: number;
};

export function MerchantSettingsStorefrontPanel(props: Props): ReactElement {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [storeName, setStoreName] = useState("Ваш магазин");
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBusinessPublic(props.businessId);
      const t = data.themeConfig;
      setStoreName(data.name?.trim() || "Ваш магазин");
      setTemplateId(normTemplateId(data.templateId));
      setPrimaryColor(t.primaryColor);
      setBgColor(t.bgColor);
      setCardColor(t.cardColor);
      setTextColor(t.textColor);
      setLayout(t.layout);
      setBannerEnabled(t.banner.enabled);
      setBannerTitle(t.banner.title);
      setBannerSubtitle(t.banner.subtitle);
      setLogoUrl(t.logoUrl ?? "");
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [props.businessId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      await saveBusinessThemePut(props.businessId, patch);
      await putStorefrontTextBrandingPatch(props.businessId, {
        brandTagline: brandTagline.trim(),
        drawerTagline: brandTagline.trim(),
      });
      setOk("Сохранено. Откройте витрину — изменения применятся.");
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const previewLogoSrc =
    logoUrl.trim() !== ""
      ? buildCloudinaryResponsiveUrl(logoUrl.trim(), "thumbnail")
      : "";

  if (loading) {
    return <p className="mp-muted text-sm">Загрузка темы…</p>;
  }

  return (
    <div className="mp-storefront-design">
      <div className="mp-storefront-design__controls">
        <div className="mp-settings-panel">
          <p className="mp-settings-field__label">Готовые темы</p>
          <div className="mp-storefront-template-grid">
            {STORE_TEMPLATE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`mp-storefront-template-btn${templateId === id ? " mp-storefront-template-btn--active" : ""}`}
                onClick={() => pickTemplate(id)}
              >
                <span className="mp-storefront-template-btn__swatches" aria-hidden>
                  <i style={{ background: TEMPLATES[id].bgColor }} />
                  <i style={{ background: TEMPLATES[id].cardColor }} />
                  <i style={{ background: TEMPLATES[id].primaryColor }} />
                </span>
                <span className="mp-storefront-template-btn__name">
                  {TEMPLATE_LABELS[id]}
                </span>
              </button>
            ))}
          </div>

          <p className="mp-settings-field__label">Сетка</p>
          <div className="mp-schedule-presets">
            {(["classic", "modern"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={`mp-schedule-preset${layout === l ? " mp-schedule-preset--active" : ""}`}
                onClick={() => setLayout(l)}
              >
                {l === "classic" ? "Классика" : "Современный"}
              </button>
            ))}
          </div>

          <div className="mp-settings-field-row">
            {(
              [
                ["Акцент", primaryColor, setPrimaryColor],
                ["Фон", bgColor, setBgColor],
                ["Карточки", cardColor, setCardColor],
                ["Текст", textColor, setTextColor],
              ] as const
            ).map(([label, val, set]) => (
              <label key={label} className="mp-settings-inline-card">
                <span className="mp-settings-inline-card__label">{label}</span>
                <input
                  type="color"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  aria-label={label}
                  style={{ width: "100%", height: "2.5rem" }}
                />
              </label>
            ))}
          </div>

          <div className="mp-settings-inline-card">
            <label className="mp-settings-field__label">
              <input
                type="checkbox"
                checked={bannerEnabled}
                onChange={(e) => setBannerEnabled(e.target.checked)}
              />{" "}
              Показывать баннер
            </label>
            <input
              type="text"
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              placeholder="Заголовок баннера"
              maxLength={280}
              className={`${archa.input} mt-2`}
            />
            <input
              type="text"
              value={bannerSubtitle}
              onChange={(e) => setBannerSubtitle(e.target.value)}
              placeholder="Подзаголовок"
              maxLength={280}
              className={`${archa.input} mt-2`}
            />
          </div>

          <div className="mp-settings-inline-card">
            <span className="mp-settings-inline-card__label">Слоган</span>
            <input
              type="text"
              value={brandTagline}
              onChange={(e) => setBrandTagline(e.target.value)}
              maxLength={120}
              placeholder="Например: доставка за 2 часа"
              className={archa.input}
            />
          </div>

          {error ? (
            <p className="mp-settings-alert mp-settings-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-sm text-[#86EFAC]" role="status">
              {ok}
            </p>
          ) : null}

          <button
            type="button"
            className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? "Сохранение…" : "Сохранить оформление"}
          </button>
        </div>
      </div>

      <div className="mp-storefront-design__preview">
        <p className="mp-settings-field__label">Живой превью</p>
        <div className="mp-storefront-preview-frame">
          <div className="mp-storefront-preview-frame__bar">
            <span className="mp-storefront-preview-frame__dot" />
            <span className="mp-storefront-preview-frame__dot" />
            <span className="mp-storefront-preview-frame__dot" />
            <span className="mp-storefront-preview-frame__label">Витрина</span>
          </div>
          <div
            className="mp-storefront-preview-canvas"
            style={{ background: bgColor, color: textColor }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                padding: "8px 10px",
                borderRadius: 10,
                background: cardColor,
                border: `1px solid ${primaryColor}44`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${primaryColor}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  overflow: "hidden",
                }}
              >
                {previewLogoSrc ? (
                  <img src={previewLogoSrc} alt="" style={{ width: "100%", height: "100%" }} />
                ) : (
                  storeBrandInitials(storeName)
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{storeName}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  {brandTagline.trim() || bannerSubtitle.trim() || "Слоган магазина"}
                </div>
              </div>
            </div>

            {bannerEnabled ? (
              <div
                style={{
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  background: `linear-gradient(135deg, ${primaryColor}55, ${cardColor})`,
                  border: `1px solid ${primaryColor}44`,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {bannerTitle.trim() || "Заголовок баннера"}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                  {bannerSubtitle.trim() || "Подзаголовок"}
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  style={{
                    borderRadius: 8,
                    padding: 8,
                    background: cardColor,
                    border: `1px solid ${primaryColor}22`,
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "4/5",
                      borderRadius: 6,
                      background: `${primaryColor}18`,
                      marginBottom: 6,
                    }}
                  />
                  <div style={{ fontSize: 10, opacity: 0.85 }}>Товар {n}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: primaryColor }}>
                    1 200 сом
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
