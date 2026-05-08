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
import { SectionMarketplaceModal } from "./sectionLibrary/SectionMarketplaceModal";
import type { SectionLibraryItem } from "./sectionLibrary/types";
import { stableSectionId } from "./sectionRegistry";

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
  const [ux, setUx] = useState<{ errors: string[]; warnings: string[] }>({
    errors: [],
    warnings: [],
  });

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
      setDraft(nextDraft);
      // optimistic preview: reuse server preview but swap sections only
      setPreview((p) =>
        p
          ? {
              ...p,
              sections: sortSections(nextDraft.sections ?? []) as unknown as ResolvedStorefrontPayload["sections"],
            }
          : p,
      );

      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            if (savingRef.current) return;
            savingRef.current = true;
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
          } catch (e) {
            console.error(e);
            setErr(e instanceof Error ? e.message : "Ошибка сохранения");
          } finally {
            setSaving(false);
            savingRef.current = false;
          }
        })();
      }, 600);
    },
    [],
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

  const addSection = useCallback(
    (item: SectionLibraryItem) => {
      if (!draft) return;
      const maxOrder = Math.max(0, ...draft.sections.map((s) => Number(s.order ?? 0)));
      const nextSection: BuilderSection = {
        id: stableSectionId(item.type),
        type: item.type,
        enabled: true,
        order: maxOrder + 10,
        config: item.defaultConfig ?? {},
      };
      scheduleSave({ ...draft, sections: [...draft.sections, nextSection] });
      setSelectedId(nextSection.id);
      setMarketOpen(false);
    },
    [draft, scheduleSave],
  );

  const onThemePatch = useCallback(
    (patch: Partial<ResolvedStoreTheme>) => {
      const nextTheme = mergeThemeFromUnknown(patch, theme);
      setThemeDraft(nextTheme);
      if (draft) scheduleSave(draft, patch);
    },
    [draft, scheduleSave, setThemeDraft, theme],
  );

  const canPublish = ux.errors.length === 0 && draft != null;

  const onPublish = useCallback(() => {
    void (async () => {
      try {
        const userId = ensureUserId();
        setSaving(true);
        await publishStorefrontBuilderDraft({ userId });
        await load();
      } catch (e) {
        console.error(e);
        setErr(e instanceof Error ? e.message : "Publish failed");
      } finally {
        setSaving(false);
      }
    })();
  }, [load]);

  const onReset = useCallback(() => {
    void (async () => {
      try {
        const userId = ensureUserId();
        setSaving(true);
        await resetStorefrontBuilderDraft({ userId });
        await load();
      } catch (e) {
        console.error(e);
        setErr(e instanceof Error ? e.message : "Reset failed");
      } finally {
        setSaving(false);
      }
    })();
  }, [load]);

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
      <BuilderToolbar saving={saving} onPublish={onPublish} onReset={onReset} canPublish={canPublish} />
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
          uxErrors={ux.errors}
          uxWarnings={ux.warnings}
        />
        <div style={{ minHeight: 0, overflow: "auto" }}>
          <BuilderCanvas previewPayload={preview} />
        </div>
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", minHeight: 0, overflow: "auto" }}>
          {selected ? <SectionEditor section={selected} onChange={onSectionChange} /> : null}
          <ThemeEditor theme={theme} onPatch={onThemePatch} />
        </div>
      </div>
    </div>
  );
}

