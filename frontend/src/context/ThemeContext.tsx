/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_STORE_THEME,
  type ResolvedStoreTheme,
} from "@repo-shared/storeTheme";
import { fetchBusinessPublic } from "../services/businessThemeApi";
import { useShop } from "./ShopContext";

type ThemeCtx = {
  theme: ResolvedStoreTheme;
  serverTheme: ResolvedStoreTheme | null;
  /** Активный пресет с сервера (red | dark | light | luxury | null). */
  templateId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Полная временная тема поверх текущего магазина (настройки админа); null — только сервер. */
  setThemeDraft: (draft: ResolvedStoreTheme | null) => void;
};

const ThemeCtx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { businessId } = useShop();
  const [serverTheme, setServerTheme] =
    useState<ResolvedStoreTheme | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResolvedStoreTheme | null>(null);
  const aborted = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (businessId == null) {
      setServerTheme(null);
      setTemplateId(null);
      setError(null);
      return;
    }
    aborted.current?.abort();
    const ac = new AbortController();
    aborted.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBusinessPublic(businessId);
      if (ac.signal.aborted) return;
      setDraft(null);
      setServerTheme(data.themeConfig);
      setTemplateId(data.templateId ?? null);
    } catch (e) {
      if (ac.signal.aborted) return;
      console.error("[Theme]", e);
      setError(e instanceof Error ? e.message : "Ошибка темы");
      setServerTheme({
        ...DEFAULT_STORE_THEME,
        banner: { ...DEFAULT_STORE_THEME.banner },
      });
      setTemplateId(null);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void refresh();
    return () => {
      aborted.current?.abort();
    };
  }, [refresh]);

  const base = serverTheme ?? DEFAULT_STORE_THEME;
  const theme = draft ?? base;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--store-bg", theme.bgColor);
    root.style.setProperty("--store-card", theme.cardColor);
    root.style.setProperty("--store-primary", theme.primaryColor);
    root.style.setProperty("--store-text", theme.textColor);
    root.dataset.storeLayout = theme.layout;
    document.body.style.backgroundColor = theme.bgColor;
    document.body.style.color = theme.textColor;
    return () => {
      root.style.removeProperty("--store-bg");
      root.style.removeProperty("--store-card");
      root.style.removeProperty("--store-primary");
      root.style.removeProperty("--store-text");
      delete root.dataset.storeLayout;
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [theme]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      serverTheme,
      templateId,
      loading,
      error,
      refresh,
      setThemeDraft: setDraft,
    }),
    [theme, serverTheme, templateId, loading, error, refresh],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(ThemeCtx);
  if (!v) {
    throw new Error("useTheme needs ThemeProvider");
  }
  return v;
}
