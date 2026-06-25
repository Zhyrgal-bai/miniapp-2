import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DeliveryAdminMode,
  DeliveryAnalyticsPeriod,
  DeliveryDetailsView,
  DeliverySearchFilters,
  DeliverySearchResult,
  DeliveryUiEvent,
  MerchantDeliveryDashboard,
  MerchantDeliveryProviderPolicy,
  OperatorDeliveryDashboard,
  DeliveryAnalyticsReport,
  DeliveryProviderPublic,
} from "../types/deliveryAdmin.types";
import {
  fetchMerchantDeliveryDashboard,
  searchMerchantDeliveries,
  fetchMerchantDeliveryDetails,
  fetchMerchantDeliveryTimeline,
  refreshMerchantDelivery,
  fetchMerchantDeliveryAnalytics,
  fetchMerchantDeliveryProviders,
  updateMerchantDeliveryProviders,
} from "../services/deliveryMerchantApi";
import {
  fetchOperatorDeliveryDashboard,
  searchOperatorDeliveries,
  fetchOperatorDeliveryDetails,
  fetchOperatorDeliveryTimeline,
  refreshOperatorDelivery,
  retryOperatorDeliveryRecovery,
  forceRefreshOperatorDelivery,
  fetchOperatorDeliveryAnalytics,
} from "../services/deliveryOperatorApi";
import { DELIVERY_FILTERS_STORAGE_KEY } from "../components/delivery/deliveryUtils";

const AUTO_REFRESH_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 320;
const PAGE_SIZE = 20;

const DEFAULT_FILTERS: DeliverySearchFilters = {
  q: "",
  status: "",
  provider: "",
  recoveryStatus: "",
};

function loadSavedFilters(): DeliverySearchFilters {
  try {
    const raw = localStorage.getItem(DELIVERY_FILTERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FILTERS };
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as DeliverySearchFilters) };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

function saveFilters(filters: DeliverySearchFilters) {
  try {
    localStorage.setItem(DELIVERY_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

export type UseDeliveryAdminOptions = {
  mode: DeliveryAdminMode;
  businessId?: number | null;
  operatorToken?: string | null;
  canManageSettings?: boolean;
};

export function useDeliveryAdmin({
  mode,
  businessId,
  operatorToken,
  canManageSettings = false,
}: UseDeliveryAdminOptions) {
  const [tab, setTab] = useState<"list" | "analytics" | "settings">("list");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [filters, setFilters] = useState<DeliverySearchFilters>(loadSavedFilters);
  const [searchInput, setSearchInput] = useState(filters.q ?? "");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<DeliveryAnalyticsPeriod>("daily");

  const [dashboardMerchant, setDashboardMerchant] =
    useState<MerchantDeliveryDashboard | null>(null);
  const [dashboardOperator, setDashboardOperator] =
    useState<OperatorDeliveryDashboard | null>(null);
  const [searchResult, setSearchResult] = useState<DeliverySearchResult | null>(null);
  const [analytics, setAnalytics] = useState<DeliveryAnalyticsReport | null>(null);
  const [providerPolicy, setProviderPolicy] =
    useState<MerchantDeliveryProviderPolicy | null>(null);
  const [providers, setProviders] = useState<DeliveryProviderPublic[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<DeliveryDetailsView | null>(null);
  const [events, setEvents] = useState<DeliveryUiEvent[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [silentRefresh, setSilentRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestGenRef = useRef(0);

  const effectiveFilters = useMemo(
    () => ({ ...filters, q: searchInput }),
    [filters, searchInput],
  );

  const patchFilters = useCallback((patch: Partial<DeliverySearchFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      saveFilters(next);
      return next;
    });
    setPage(1);
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      patchFilters({ q: searchInput });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput, patchFilters]);

  const loadDashboard = useCallback(async () => {
    if (mode === "merchant") {
      if (businessId == null) return;
      const d = await fetchMerchantDeliveryDashboard(businessId);
      setDashboardMerchant(d);
      return;
    }
    const token = operatorToken?.trim();
    if (!token) return;
    const d = await fetchOperatorDeliveryDashboard(token, period);
    setDashboardOperator(d);
  }, [mode, businessId, operatorToken, period]);

  const loadSearch = useCallback(async () => {
    if (mode === "merchant") {
      if (businessId == null) return;
      const r = await searchMerchantDeliveries(
        businessId,
        effectiveFilters,
        page,
        PAGE_SIZE,
      );
      setSearchResult(r);
      return;
    }
    const token = operatorToken?.trim();
    if (!token) return;
    const r = await searchOperatorDeliveries(token, effectiveFilters, page, PAGE_SIZE);
    setSearchResult(r);
  }, [mode, businessId, operatorToken, effectiveFilters, page]);

  const loadAnalytics = useCallback(async () => {
    if (mode === "merchant") {
      if (businessId == null) return;
      const r = await fetchMerchantDeliveryAnalytics(businessId, period);
      setAnalytics(r);
      return;
    }
    const token = operatorToken?.trim();
    if (!token) return;
    const r = await fetchOperatorDeliveryAnalytics(token, period);
    setAnalytics(r);
  }, [mode, businessId, operatorToken, period]);

  const loadProviders = useCallback(async () => {
    if (!canManageSettings || businessId == null) return;
    const r = await fetchMerchantDeliveryProviders(businessId);
    setProviderPolicy(r.policy);
    setProviders(r.providers);
  }, [canManageSettings, businessId]);

  const refreshAll = useCallback(
    async (silent = false) => {
      const gen = ++requestGenRef.current;
      if (!silent) setLoading(true);
      else setSilentRefresh(true);
      try {
        await Promise.all([
          loadDashboard(),
          tab === "list" ? loadSearch() : Promise.resolve(),
          tab === "analytics" ? loadAnalytics() : Promise.resolve(),
          tab === "settings" ? loadProviders() : Promise.resolve(),
        ]);
        if (gen !== requestGenRef.current) return;
        setError(null);
        setLastRefreshAt(new Date());
      } catch (e) {
        if (gen !== requestGenRef.current) return;
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (gen === requestGenRef.current) {
          setLoading(false);
          setSilentRefresh(false);
        }
      }
    },
    [loadDashboard, loadSearch, loadAnalytics, loadProviders, tab],
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshAll(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refreshAll]);

  const openDelivery = useCallback(
    async (deliveryId: number) => {
      setSelectedId(deliveryId);
      setDetailsLoading(true);
      setDetails(null);
      setEvents([]);
      try {
        if (mode === "merchant" && businessId != null) {
          const [d, tl] = await Promise.all([
            fetchMerchantDeliveryDetails(businessId, deliveryId),
            fetchMerchantDeliveryTimeline(businessId, deliveryId),
          ]);
          setDetails(d);
          setEvents(tl.events);
        } else if (mode === "operator" && operatorToken?.trim()) {
          const token = operatorToken.trim();
          const [d, tl] = await Promise.all([
            fetchOperatorDeliveryDetails(token, deliveryId),
            fetchOperatorDeliveryTimeline(token, deliveryId),
          ]);
          setDetails(d);
          setEvents(tl.events);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки доставки");
        setSelectedId(null);
      } finally {
        setDetailsLoading(false);
      }
    },
    [mode, businessId, operatorToken],
  );

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    setDetails(null);
    setEvents([]);
  }, []);

  const refreshSelected = useCallback(async () => {
    if (selectedId == null) return;
    if (mode === "merchant" && businessId != null) {
      await refreshMerchantDelivery(businessId, selectedId);
    } else if (mode === "operator" && operatorToken?.trim()) {
      await refreshOperatorDelivery(operatorToken.trim(), selectedId);
    }
    await openDelivery(selectedId);
    void refreshAll(true);
  }, [selectedId, mode, businessId, operatorToken, openDelivery, refreshAll]);

  const retryRecoverySelected = useCallback(async () => {
    if (selectedId == null || mode !== "operator" || !operatorToken?.trim()) return;
    await retryOperatorDeliveryRecovery(operatorToken.trim(), selectedId);
    await openDelivery(selectedId);
    void refreshAll(true);
  }, [selectedId, mode, operatorToken, openDelivery, refreshAll]);

  const forceRefreshSelected = useCallback(async () => {
    if (selectedId == null || mode !== "operator" || !operatorToken?.trim()) return;
    await forceRefreshOperatorDelivery(operatorToken.trim(), selectedId);
    await openDelivery(selectedId);
    void refreshAll(true);
  }, [selectedId, mode, operatorToken, openDelivery, refreshAll]);

  const saveProviderPolicy = useCallback(
    async (patch: Partial<MerchantDeliveryProviderPolicy>) => {
      if (businessId == null) return;
      setSettingsSaving(true);
      try {
        const r = await updateMerchantDeliveryProviders(businessId, patch);
        setProviderPolicy(r.policy);
      } finally {
        setSettingsSaving(false);
      }
    },
    [businessId],
  );

  return {
    tab,
    setTab,
    viewMode,
    setViewMode,
    filters,
    patchFilters,
    searchInput,
    setSearchInput,
    filtersExpanded,
    setFiltersExpanded,
    page,
    setPage,
    period,
    setPeriod,
    dashboardMerchant,
    dashboardOperator,
    searchResult,
    analytics,
    providerPolicy,
    providers,
    selectedId,
    details,
    events,
    detailsLoading,
    loading,
    silentRefresh,
    error,
    settingsSaving,
    lastRefreshAt,
    pageSize: PAGE_SIZE,
    openDelivery,
    closeDrawer,
    refreshAll,
    refreshSelected,
    retryRecoverySelected,
    forceRefreshSelected,
    saveProviderPolicy,
  };
}
