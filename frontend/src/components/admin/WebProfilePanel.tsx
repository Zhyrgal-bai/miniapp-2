import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  emptyWebProfileClient,
  type WebProfile,
} from "../../services/admin.service";
import { formatAdminApiError } from "../../utils/adminApiError";
import "./webProfilePanel.css";

/** Phase 17.7 + 17.3: merchant web branding + human-friendly slug editor. */
export function WebProfilePanel(): React.ReactElement {
  const [profile, setProfile] = useState<WebProfile>(emptyWebProfileClient());
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const p = await adminService.getWebProfile();
        setProfile(p);
      } catch (e) {
        setError(formatAdminApiError(e));
      }
    })();
  }, []);

  const setSocial = useCallback(
    (key: keyof WebProfile["social"], value: string) => {
      setProfile((p) => ({
        ...p,
        social: { ...p.social, [key]: value.trim() === "" ? null : value },
      }));
    },
    [],
  );

  const saveProfile = useCallback(async () => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const saved = await adminService.saveWebProfile(profile);
      setProfile(saved);
      setOk("Брендинг сохранён");
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setSaving(false);
    }
  }, [profile]);

  const checkSlug = useCallback(async () => {
    setSlugStatus(null);
    try {
      const r = await adminService.checkSlugAvailability(slug);
      setSlugStatus(
        r.ok ? "Свободно — можно сохранить" : `Недоступно: ${r.reason}`,
      );
    } catch (e) {
      setSlugStatus(formatAdminApiError(e));
    }
  }, [slug]);

  const saveSlug = useCallback(async () => {
    setError(null);
    setOk(null);
    try {
      const r = await adminService.changeSlug(slug);
      setOk(`Адрес обновлён: /s/${r.slug}`);
      setSlug("");
      setSlugStatus(null);
    } catch (e) {
      setError(formatAdminApiError(e));
    }
  }, [slug]);

  return (
    <div className="admin-dash-card web-profile-panel">
      <h2 className="web-profile-panel__title">Сайт и брендинг</h2>

      <section className="web-profile-panel__section">
        <h3>Адрес магазина</h3>
        <p className="web-profile-panel__hint">
          Человеко-понятный адрес витрины. Старый адрес продолжит работать.
        </p>
        <div className="web-profile-panel__row">
          <span className="web-profile-panel__prefix">/s/</span>
          <input
            className="web-profile-panel__input"
            placeholder="my-store"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <button type="button" className="web-profile-panel__btn" onClick={() => void checkSlug()}>
            Проверить
          </button>
          <button
            type="button"
            className="web-profile-panel__btn web-profile-panel__btn--primary"
            disabled={slug.trim() === ""}
            onClick={() => void saveSlug()}
          >
            Сохранить адрес
          </button>
        </div>
        {slugStatus ? <p className="web-profile-panel__status">{slugStatus}</p> : null}
      </section>

      <section className="web-profile-panel__section">
        <h3>Брендинг сайта</h3>
        <label className="web-profile-panel__field">
          <span>Обложка (URL)</span>
          <input
            className="web-profile-panel__input"
            placeholder="https://…"
            value={profile.coverUrl ?? ""}
            onChange={(e) =>
              setProfile((p) => ({ ...p, coverUrl: e.target.value.trim() || null }))
            }
          />
        </label>
        <label className="web-profile-panel__field">
          <span>Слоган</span>
          <input
            className="web-profile-panel__input"
            value={profile.slogan ?? ""}
            onChange={(e) => setProfile((p) => ({ ...p, slogan: e.target.value || null }))}
          />
        </label>
        <label className="web-profile-panel__field">
          <span>О магазине</span>
          <textarea
            className="web-profile-panel__input"
            rows={4}
            value={profile.story ?? ""}
            onChange={(e) => setProfile((p) => ({ ...p, story: e.target.value || null }))}
          />
        </label>
        <label className="web-profile-panel__field">
          <span>Акцентный цвет (#hex)</span>
          <input
            className="web-profile-panel__input"
            placeholder="#7fff3a"
            value={profile.accentColor ?? ""}
            onChange={(e) =>
              setProfile((p) => ({ ...p, accentColor: e.target.value.trim() || null }))
            }
          />
        </label>
      </section>

      <section className="web-profile-panel__section">
        <h3>Соцсети</h3>
        <label className="web-profile-panel__field">
          <span>Instagram</span>
          <input
            className="web-profile-panel__input"
            placeholder="username"
            value={profile.social.instagram ?? ""}
            onChange={(e) => setSocial("instagram", e.target.value)}
          />
        </label>
        <label className="web-profile-panel__field">
          <span>Telegram</span>
          <input
            className="web-profile-panel__input"
            placeholder="username"
            value={profile.social.telegram ?? ""}
            onChange={(e) => setSocial("telegram", e.target.value)}
          />
        </label>
        <label className="web-profile-panel__field">
          <span>WhatsApp</span>
          <input
            className="web-profile-panel__input"
            placeholder="+996…"
            value={profile.social.whatsapp ?? ""}
            onChange={(e) => setSocial("whatsapp", e.target.value)}
          />
        </label>
        <label className="web-profile-panel__field">
          <span>Сайт</span>
          <input
            className="web-profile-panel__input"
            placeholder="https://…"
            value={profile.social.website ?? ""}
            onChange={(e) => setSocial("website", e.target.value)}
          />
        </label>
      </section>

      <div className="web-profile-panel__actions">
        <button
          type="button"
          className="web-profile-panel__btn web-profile-panel__btn--primary"
          disabled={saving}
          onClick={() => void saveProfile()}
        >
          {saving ? "Сохранение…" : "Сохранить брендинг"}
        </button>
      </div>

      {error ? (
        <p className="web-profile-panel__error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? <p className="web-profile-panel__ok">{ok}</p> : null}
    </div>
  );
}
