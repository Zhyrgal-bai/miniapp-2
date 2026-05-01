import { useCallback, useEffect, useState } from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { useShop } from "../../context/ShopContext";
import { useTheme } from "../../context/ThemeContext";
import * as businessThemeApi from "../../services/businessThemeApi";
import { adminService } from "../../services/admin.service";

function cloneTheme(t: ResolvedStoreTheme): ResolvedStoreTheme {
  return {
    ...t,
    banner: { ...t.banner },
  };
}

export default function StoreThemeEditor() {
  const { businessId } = useShop();
  const { serverTheme, theme, setThemeDraft, refresh } = useTheme();
  const [local, setLocal] = useState<ResolvedStoreTheme | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => setThemeDraft(null);
  }, [setThemeDraft]);

  useEffect(() => {
    if (serverTheme) {
      setLocal(cloneTheme(serverTheme));
      setThemeDraft(null);
    }
  }, [serverTheme, setThemeDraft]);

  const effective = local ?? theme;

  const pushDraft = useCallback(
    (next: ResolvedStoreTheme) => {
      setLocal(next);
      setThemeDraft(next);
    },
    [setThemeDraft],
  );

  const save = async () => {
    if (businessId == null || local == null) return;
    setSaving(true);
    setMsg(null);
    try {
      const { themeConfig } = await businessThemeApi.saveBusinessThemePut(businessId, {
        primaryColor: local.primaryColor,
        bgColor: local.bgColor,
        cardColor: local.cardColor,
        textColor: local.textColor,
        logoUrl: local.logoUrl,
        banner: local.banner,
      });
      setLocal(cloneTheme(themeConfig));
      setThemeDraft(null);
      await refresh();
      setMsg("Сохранено ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const onLogoFile = async (file: File | null) => {
    if (!file || businessId == null || local == null) return;
    try {
      const url = await adminService.uploadImage(file);
      pushDraft({ ...local, logoUrl: url });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Загрузка логотипа не удалась");
    }
  };

  if (businessId == null) {
    return (
      <p className="admin-form-hint">Откройте магазин с параметром ?shop=</p>
    );
  }

  if (local == null) {
    return <p className="admin-form-hint">Загрузка темы…</p>;
  }

  return (
    <div className="admin-theme-editor">
      <h3 className="admin-dash-section__title">Оформление витрины</h3>
      <p className="admin-form-hint">
        Изменения сразу видны в мини-приложении; нажмите «Сохранить», чтобы
        записать в базу.
      </p>

      <div
        className="admin-theme-preview"
        style={{
          backgroundColor: effective.bgColor,
          color: effective.textColor,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.85 }}>
          Предпросмотр
        </p>
        {effective.logoUrl ? (
          <img
            src={effective.logoUrl}
            alt=""
            style={{ maxHeight: 40, marginBottom: 8, borderRadius: 6 }}
          />
        ) : null}
        {effective.banner.enabled ? (
          <div
            style={{
              backgroundColor: effective.cardColor,
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <strong>{effective.banner.title}</strong>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {effective.banner.subtitle}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          style={{
            backgroundColor: effective.primaryColor,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontWeight: 600,
          }}
        >
          Пример кнопки
        </button>
        <div
          style={{
            marginTop: 12,
            backgroundColor: effective.cardColor,
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
          }}
        >
          Карточка товара
        </div>
      </div>

      <div className="admin-theme-grid">
        <label className="admin-theme-field">
          Акцент (кнопки)
          <input
            type="color"
            value={local.primaryColor}
            onChange={(e) =>
              pushDraft({ ...local, primaryColor: e.target.value })
            }
          />
        </label>
        <label className="admin-theme-field">
          Фон
          <input
            type="color"
            value={local.bgColor}
            onChange={(e) => pushDraft({ ...local, bgColor: e.target.value })}
          />
        </label>
        <label className="admin-theme-field">
          Карточки
          <input
            type="color"
            value={local.cardColor}
            onChange={(e) =>
              pushDraft({ ...local, cardColor: e.target.value })
            }
          />
        </label>
        <label className="admin-theme-field">
          Текст
          <input
            type="color"
            value={local.textColor}
            onChange={(e) =>
              pushDraft({ ...local, textColor: e.target.value })
            }
          />
        </label>
      </div>

      <div className="admin-theme-banner">
        <label className="admin-theme-toggle">
          <input
            type="checkbox"
            checked={local.banner.enabled}
            onChange={(e) =>
              pushDraft({
                ...local,
                banner: { ...local.banner, enabled: e.target.checked },
              })
            }
          />
          Показывать баннер на главной
        </label>
        <label className="admin-theme-field admin-theme-field--full">
          Заголовок баннера
          <input
            type="text"
            maxLength={280}
            value={local.banner.title}
            onChange={(e) =>
              pushDraft({
                ...local,
                banner: { ...local.banner, title: e.target.value },
              })
            }
          />
        </label>
        <label className="admin-theme-field admin-theme-field--full">
          Подзаголовок
          <input
            type="text"
            maxLength={280}
            value={local.banner.subtitle}
            onChange={(e) =>
              pushDraft({
                ...local,
                banner: { ...local.banner, subtitle: e.target.value },
              })
            }
          />
        </label>
      </div>

      <div className="admin-theme-logo">
        <label className="admin-theme-field admin-theme-field--full">
          Логотип (URL https)
          <input
            type="url"
            placeholder="https://…"
            value={local.logoUrl ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              pushDraft({ ...local, logoUrl: v === "" ? null : v });
            }}
          />
        </label>
        <label className="admin-theme-upload">
          Загрузить файл
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="admin-theme-actions">
        <button
          type="button"
          className="admin-pm-cta"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Сохранение…" : "Сохранить оформление"}
        </button>
        <button
          type="button"
          className="admin-theme-reset"
          onClick={() => {
            if (serverTheme) {
              const c = cloneTheme(serverTheme);
              setLocal(c);
              setThemeDraft(null);
            }
          }}
        >
          Сбросить превью
        </button>
      </div>
      {msg ? <p className="admin-theme-msg">{msg}</p> : null}
    </div>
  );
}
