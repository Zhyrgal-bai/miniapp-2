import { useCallback, useEffect, useMemo, useState } from "react";
import { getWebAppUserId } from "../../utils/telegramUserId";
import {
  fetchStorefrontBuilderState,
  saveStorefrontBuilderDraft,
  type BuilderConfig,
} from "../../services/storefrontBuilderApi";
import { STYLE_PRESETS } from "../../builder/design/stylePresets";
import { TypographyControls } from "../../builder/design/TypographyControls";
import { ChipsControls } from "../../builder/design/ChipsControls";
import { ButtonSystemControls } from "../../builder/design/ButtonSystemControls";
import { LayoutControls } from "../../builder/design/LayoutControls";
import { CartControls } from "../../builder/design/CartControls";
import { DrawerControls } from "../../builder/design/DrawerControls";
import { HeroControls } from "../../builder/design/HeroControls";

function ensureUserId(): number {
  const id = getWebAppUserId();
  if (!Number.isFinite(id) || id <= 0) throw new Error("Откройте приложение в Telegram Mini App");
  return id;
}

export function InlineDesignStudio(): React.ReactElement {
  const [draft, setDraft] = useState<BuilderConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setMsg(null);
    try {
      const userId = ensureUserId();
      const s = await fetchStorefrontBuilderState({ userId });
      setDraft(s.draft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось загрузить Design Studio");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const styleCfg = useMemo(() => (draft?.storefrontStyleConfig ?? {}) as Record<string, unknown>, [draft?.storefrontStyleConfig]);

  const patchStyle = (nextStyle: Record<string, unknown>) => {
    setDraft((prev) => (prev ? { ...prev, storefrontStyleConfig: nextStyle } : prev));
    setMsg(null);
  };

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const userId = ensureUserId();
      await saveStorefrontBuilderDraft({ userId, draftConfig: draft });
      setMsg("Сохранено ✓");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  if (err) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div className="admin-form-hint" style={{ color: "#ffb4b4" }}>
          {err}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.03)",
            color: "#fff",
            padding: "10px 12px",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Повторить загрузку
        </button>
      </div>
    );
  }

  if (!draft) return <p className="admin-form-hint">Загрузка Design Studio…</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(
          [
            { id: "minimal", label: "Minimal" },
            { id: "luxury", label: "Luxury" },
            { id: "fashion", label: "Fashion" },
            { id: "neon", label: "Neon" },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={saving}
            onClick={() => patchStyle(STYLE_PRESETS[p.id] as unknown as Record<string, unknown>)}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.03)",
              color: "#fff",
              padding: "8px 10px",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
        <HeroControls value={styleCfg.hero ?? {}} onChange={(next) => patchStyle({ ...styleCfg, hero: next as unknown as Record<string, unknown> })} />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <LayoutControls value={styleCfg.layout ?? {}} onChange={(next) => patchStyle({ ...styleCfg, layout: next as unknown as Record<string, unknown> })} />
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <TypographyControls value={styleCfg.typography ?? {}} onChange={(next) => patchStyle({ ...styleCfg, typography: next as unknown as Record<string, unknown> })} />
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <ChipsControls value={styleCfg.chips ?? {}} onChange={(next) => patchStyle({ ...styleCfg, chips: next as unknown as Record<string, unknown> })} />
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <ButtonSystemControls value={styleCfg.buttons ?? {}} onChange={(next) => patchStyle({ ...styleCfg, buttons: next as unknown as Record<string, unknown> })} />
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <CartControls value={styleCfg.cart ?? {}} onChange={(next) => patchStyle({ ...styleCfg, cart: next as unknown as Record<string, unknown> })} />
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <DrawerControls value={styleCfg.drawer ?? {}} onChange={(next) => patchStyle({ ...styleCfg, drawer: next as unknown as Record<string, unknown> })} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(220,38,38,0.22)",
            color: "#fff",
            padding: "10px 12px",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {saving ? "Сохранение…" : "Сохранить (Design Studio)"}
        </button>
        {msg ? <div className="admin-form-hint">{msg}</div> : null}
      </div>
    </div>
  );
}

