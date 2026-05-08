import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWebAppUserId } from "../utils/telegramUserId";
import { useTheme } from "../context/ThemeContext";
import { mergeThemeFromUnknown, type ResolvedStoreTheme } from "@repo-shared/storeTheme";
import {
  fetchStorefrontBuilderState,
  publishStorefrontBuilderDraft,
  resetStorefrontBuilderDraft,
  saveStorefrontBuilderDraft,
  type BuilderConfig,
  type BuilderSection,
  type StorefrontBuilderState,
} from "../services/storefrontBuilderApi";
import { BuilderToolbar } from "./BuilderToolbar";
import { BuilderSidebar } from "./BuilderSidebar";
import { BuilderCanvas } from "./BuilderCanvas";
import { SectionEditor } from "./SectionEditor";
import { ThemeEditor } from "./ThemeEditor";
import type { ResolvedStorefrontPayload } from "../components/storefront/StorefrontRenderer";
import { HeaderBuilder } from "./header/HeaderBuilder";
import { ProductCardBuilder } from "./cards/ProductCardBuilder";
import { TextControls } from "./texts/TextControls";
import { SectionMarketplaceModal } from "./sectionLibrary/SectionMarketplaceModal";
import { stableSectionId } from "./sectionRegistry";
import type { PreviewMode } from "./preview/modes";
import { useBuilderSaveState } from "./useBuilderSaveState";
import { BuilderStatusBar } from "./BuilderStatusBar";
import { createReusableBlock } from "./reusableBlocks/reusableBlocksApi";

function ensureUserId(): number {
  const id = getWebAppUserId();
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Откройте приложение в Telegram Mini App");
  }
  return id;
}

function sortSections(sections: BuilderSection[]): BuilderSection[] {
  return [...sections].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
}

function dedupeTimer(ref: MutableRefObject<number | null>) {
  if (ref.current) window.clearTimeout(ref.current);
  ref.current = null;
}

export default function BuilderPage(): React.ReactElement {
  const nav = useNavigate();
  const { theme, setThemeDraft } = useTheme();
  const [state, setState] = useState<StorefrontBuilderState | null>(null);
  const [draft, setDraft] = useState<BuilderConfig | null>(null);
  const [preview, setPreview] = useState<ResolvedStorefrontPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [ux, setUx] = useState<{ errors: string[]; warnings: string[] }>({
    errors: [],
    warnings: [],
  });
  const [rightTab, setRightTab] = useState<"sections" | "design" | "header" | "cards" | "texts">("sections");
  const save = useBuilderSaveState();

  const debounceRef = useRef<number | null>(null);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const userId = ensureUserId();
    const s = await fetchStorefrontBuilderState({ userId });
    setState(s);
    setDraft(s.draft);
    setPreview(s.preview as ResolvedStorefrontPayload);
    setSelectedId(
      Array.isArray(s.draft?.sections) && s.draft.sections[0]
        ? String(s.draft.sections[0].id)
        : null,
    );
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Ошибка загрузки builder");
    });
    return () => {
      dedupeTimer(debounceRef);
    };
  }, [load]);

  const sections = useMemo(
    () => sortSections(draft?.sections ?? []),
    [draft?.sections],
  );
  const selected = useMemo(
    () => sections.find((s) => String(s.id) === String(selectedId)) ?? null,
    [sections, selectedId],
  );

  const scheduleSave = useCallback(
    (nextDraft: BuilderConfig, themePatch?: Partial<ResolvedStoreTheme> | null) => {
      save.markDirty();
      setDraft(nextDraft);
      // optimistic preview: reuse server preview but swap sections only
      setPreview((p) =>
        p
          ? {
              ...p,
              sections: sortSections(nextDraft.sections ?? []) as unknown as ResolvedStorefrontPayload["sections"],
              storefrontHeaderConfig: nextDraft.storefrontHeaderConfig ?? p.storefrontHeaderConfig,
              storefrontCardConfig: nextDraft.storefrontCardConfig ?? p.storefrontCardConfig,
              storefrontTextConfig: nextDraft.storefrontTextConfig ?? p.storefrontTextConfig,
              storefrontStyleConfig: nextDraft.storefrontStyleConfig ?? p.storefrontStyleConfig,
            }
          : p,
      );

      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            if (savingRef.current) return;
            savingRef.current = true;
            save.startSaving();
            setSaving(true);
            const userId = ensureUserId();
            const out = await saveStorefrontBuilderDraft({
              userId,
              draftConfig: nextDraft,
              themePatch: themePatch ?? undefined,
            });
            const uxResp = out?.ux as unknown as {
              errors?: Array<{ message?: unknown }>;
              warnings?: Array<{ message?: unknown }>;
            };
            const errors = Array.isArray(uxResp?.errors)
              ? uxResp.errors.map((x) => String(x?.message ?? ""))
              : [];
            const warnings = Array.isArray(uxResp?.warnings)
              ? uxResp.warnings.map((x) => String(x?.message ?? ""))
              : [];
            setUx({ errors, warnings });
            save.savedOk();
          } catch (e) {
            console.error(e);
            const msg = e instanceof Error ? e.message : "Ошибка сохранения";
            setErr(msg);
            save.saveFailed(msg);
          } finally {
            setSaving(false);
            savingRef.current = false;
          }
        })();
      }, 600);
    },
    [save],
  );

  const onHeaderChange = useCallback(
    (next: Record<string, unknown>) => {
      if (!draft) return;
      scheduleSave({ ...draft, storefrontHeaderConfig: next });
      setRightTab("header");
    },
    [draft, scheduleSave],
  );

  const onCardChange = useCallback(
    (next: Record<string, unknown>) => {
      if (!draft) return;
      scheduleSave({ ...draft, storefrontCardConfig: next });
      setRightTab("cards");
    },
    [draft, scheduleSave],
  );

  const onTextChange = useCallback(
    (next: Record<string, unknown>) => {
      if (!draft) return;
      scheduleSave({ ...draft, storefrontTextConfig: next });
      setRightTab("texts");
    },
    [draft, scheduleSave],
  );

  const onStyleChange = useCallback(
    (next: Record<string, unknown>) => {
      if (!draft) return;
      scheduleSave({ ...draft, storefrontStyleConfig: next } as unknown as BuilderConfig);
      setRightTab("design");
    },
    [draft, scheduleSave],
  );

  const onToggle = useCallback(
    (id: string) => {
      if (!draft) return;
      const next = {
        ...draft,
        sections: (draft.sections ?? []).map((s) =>
          String(s.id) === String(id) ? { ...s, enabled: s.enabled === false } : s,
        ),
      };
      scheduleSave(next);
    },
    [draft, scheduleSave],
  );

  const onSectionChange = useCallback(
    (nextSection: BuilderSection) => {
      if (!draft) return;
      const next = {
        ...draft,
        sections: (draft.sections ?? []).map((s) =>
          String(s.id) === String(nextSection.id) ? nextSection : s,
        ),
      };
      scheduleSave(next);
    },
    [draft, scheduleSave],
  );

  const onReorder = useCallback(
    (ids: string[]) => {
      if (!draft) return;
      const byId = new Map(draft.sections.map((s) => [String(s.id), s] as const));
      const ordered = ids
        .map((id) => byId.get(String(id)))
        .filter((x): x is BuilderSection => Boolean(x));
      const baseOrder = 10;
      const step = 10;
      const normalized = ordered.map((s, idx) => ({
        ...s,
        order: baseOrder + idx * step,
      }));
      scheduleSave({ ...draft, sections: normalized });
    },
    [draft, scheduleSave],
  );

  const deepClone = (v: unknown): unknown => {
    if ("structuredClone" in globalThis && typeof globalThis.structuredClone === "function") {
      return globalThis.structuredClone(v);
    }
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return v;
    }
  };

  const onDuplicate = useCallback(
    (id: string) => {
      if (!draft) return;
      const idx = draft.sections.findIndex((s) => String(s.id) === String(id));
      if (idx < 0) return;
      const src = draft.sections[idx]!;
      const clone: BuilderSection = {
        ...src,
        id: stableSectionId(src.type),
        config: (deepClone(src.config) as Record<string, unknown>) ?? {},
      };
      const next = [...draft.sections];
      next.splice(idx + 1, 0, clone);
      // normalize orders
      const normalized = next.map((s, i) => ({ ...s, order: 10 + i * 10 }));
      scheduleSave({ ...draft, sections: normalized });
      setSelectedId(clone.id);
    },
    [draft, scheduleSave],
  );

  const onDelete = useCallback(
    (id: string) => {
      if (!draft) return;
      const next = draft.sections.filter((s) => String(s.id) !== String(id));
      const normalized = next.map((s, i) => ({ ...s, order: 10 + i * 10 }));
      scheduleSave({ ...draft, sections: normalized });
      if (selectedId === id) {
        setSelectedId(normalized[0]?.id ?? null);
      }
    },
    [draft, scheduleSave, selectedId],
  );

  const addSection = useCallback(
    (params: { type: string; config: Record<string, unknown> }) => {
      if (!draft) return;
      const maxOrder = Math.max(0, ...draft.sections.map((s) => Number(s.order ?? 0)));
      const nextSection: BuilderSection = {
        id: stableSectionId(params.type),
        type: params.type,
        enabled: true,
        order: maxOrder + 10,
        config: params.config ?? {},
      };
      scheduleSave({ ...draft, sections: [...draft.sections, nextSection] });
      setSelectedId(nextSection.id);
      setMarketOpen(false);
    },
    [draft, scheduleSave],
  );

  const onSaveAsBlock = useCallback(
    (id: string) => {
      if (!draft) return;
      const sec = draft.sections.find((s) => String(s.id) === String(id));
      if (!sec) return;
      const name = window.prompt("Block name", `${sec.type} block`);
      if (!name) return;
      void createReusableBlock({
        name: name.trim().slice(0, 80),
        type: sec.type,
        config: sec.config ?? {},
      }).catch((e) => {
        console.error(e);
        setErr(e instanceof Error ? e.message : "Не удалось сохранить block");
      });
    },
    [draft],
  );

  const onThemePatch = useCallback(
    (patch: Record<string, unknown>) => {
      const nextTheme = mergeThemeFromUnknown(patch, theme);
      setThemeDraft(nextTheme);
      if (draft) scheduleSave(draft, patch as unknown as Partial<ResolvedStoreTheme>);
    },
    [draft, scheduleSave, setThemeDraft, theme],
  );

  const canPublish = ux.errors.length === 0 && draft != null;

  const onPublish = useCallback(() => {
    void (async () => {
      try {
        const userId = ensureUserId();
        save.startPublishing();
        setSaving(true);
        await publishStorefrontBuilderDraft({ userId });
        save.publishedOk();
        await load();
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Publish failed";
        setErr(msg);
        save.publishFailed(msg);
      } finally {
        setSaving(false);
      }
    })();
  }, [load, save]);

  const onReset = useCallback(() => {
    void (async () => {
      try {
        const userId = ensureUserId();
        setSaving(true);
        await resetStorefrontBuilderDraft({ userId });
        save.resetDone();
        await load();
      } catch (e) {
        console.error(e);
        setErr(e instanceof Error ? e.message : "Reset failed");
      } finally {
        setSaving(false);
      }
    })();
  }, [load, save]);

  if (err) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Builder</div>
        <div style={{ opacity: 0.8 }}>{err}</div>
        <button
          onClick={() => nav("/merchant")}
          style={{
            marginTop: 12,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent",
            color: "#fff",
            padding: "8px 12px",
            fontWeight: 700,
          }}
        >
          Назад
        </button>
      </div>
    );
  }

  if (!state || !draft || !preview) {
    return <div style={{ padding: 16, opacity: 0.8 }}>Загрузка builder…</div>;
  }

  return (
    <div style={{ minHeight: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}>
      <BuilderToolbar
        saving={saving}
        onPublish={onPublish}
        onReset={onReset}
        canPublish={canPublish}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
      />
      <SectionMarketplaceModal
        open={marketOpen}
        onClose={() => setMarketOpen(false)}
        onPick={addSection}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 360px",
          minHeight: 0,
        }}
      >
        <BuilderSidebar
          sections={sections.map((s) => ({
            id: String(s.id),
            type: String(s.type),
            enabled: s.enabled !== false,
            order: Number(s.order ?? 0),
          }))}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggle={onToggle}
          onReorder={onReorder}
          onAddSection={() => setMarketOpen(true)}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onSaveAsBlock={onSaveAsBlock}
          uxErrors={ux.errors}
          uxWarnings={ux.warnings}
        />
        <div style={{ minHeight: 0, overflow: "auto" }}>
          <BuilderCanvas previewPayload={preview} mode={previewMode} />
        </div>
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", minHeight: 0, overflow: "auto", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
          <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {(
              [
                { id: "sections", label: "Секции" },
                { id: "design", label: "Оформление витрины" },
                { id: "header", label: "Header" },
                { id: "cards", label: "Карточки" },
                { id: "texts", label: "Тексты" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRightTab(t.id)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: rightTab === t.id ? "rgba(220,38,38,0.22)" : "rgba(255,255,255,0.03)",
                  color: "#fff",
                  padding: "8px 12px",
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ minHeight: 0, overflow: "auto" }}>
            {rightTab === "sections" ? (selected ? <SectionEditor section={selected} onChange={onSectionChange} /> : null) : null}
            {rightTab === "design" ? (
              <div>
                <ThemeEditor theme={theme} onPatch={onThemePatch} />
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <HeaderBuilder
                    theme={theme}
                    value={draft?.storefrontHeaderConfig}
                    onChange={(next) => onHeaderChange(next as unknown as Record<string, unknown>)}
                  />
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <ProductCardBuilder
                    value={draft?.storefrontCardConfig}
                    onChange={(next) => onCardChange(next as unknown as Record<string, unknown>)}
                  />
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <TextControls
                    value={draft?.storefrontTextConfig}
                    onChange={(next) => onTextChange(next as unknown as Record<string, unknown>)}
                  />
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Layout / Chips / Buttons / Hero</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
                      Быстрый старт (создать `storefrontStyleConfig`)
                      <button
                        type="button"
                        onClick={() =>
                          onStyleChange({
                            layout: {
                              density: "normal",
                              sectionSpacing: 16,
                              productGap: 10,
                              mobilePadding: 10,
                              contentWidth: "full",
                            },
                            typography: {
                              titleSize: 24,
                              sectionTitleSize: 16,
                              buttonSize: 13,
                              titleWeight: 800,
                              uppercaseTitles: false,
                              letterSpacing: 0,
                              lineHeight: 1.15,
                            },
                            chips: {
                              shape: "pill",
                              style: "outline",
                              size: "md",
                              radius: 999,
                              gap: 8,
                            },
                            buttons: {
                              radius: 14,
                              height: 44,
                              shadow: true,
                              glow: false,
                              variant: "filled",
                              compact: false,
                              animationLevel: "low",
                            },
                            hero: {
                              layout: "centered",
                              overlay: false,
                              height: 320,
                              radius: 24,
                              shadow: false,
                              alignment: "center",
                              ctaPosition: "below",
                            },
                          })
                        }
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
                        Создать настройки
                      </button>
                    </label>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      Следующим шагом: заменю эту “заглушку” на полноценные слайдеры/тумблеры и привяжу к
                      <b> --sf-*</b> в `StorefrontRenderer`.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {rightTab === "header" ? (
              <HeaderBuilder
                theme={theme}
                value={draft?.storefrontHeaderConfig}
                onChange={(next) => onHeaderChange(next as unknown as Record<string, unknown>)}
              />
            ) : null}
            {rightTab === "cards" ? (
              <ProductCardBuilder
                value={draft?.storefrontCardConfig}
                onChange={(next) => onCardChange(next as unknown as Record<string, unknown>)}
              />
            ) : null}
            {rightTab === "texts" ? (
              <TextControls
                value={draft?.storefrontTextConfig}
                onChange={(next) => onTextChange(next as unknown as Record<string, unknown>)}
              />
            ) : null}
          </div>
        </div>
      </div>
      <BuilderStatusBar state={save.state} uxErrorsCount={ux.errors.length} />
    </div>
  );
}

