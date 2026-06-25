import { useDeliveryAdmin } from "../../hooks/useDeliveryAdmin";
import { StatisticsCards } from "../../components/delivery/StatisticsCards";
import { DeliverySearch } from "../../components/delivery/DeliverySearch";
import { DeliveryFilters } from "../../components/delivery/DeliveryFilters";
import { DeliveryCard } from "../../components/delivery/DeliveryCard";
import { DeliveryTable } from "../../components/delivery/DeliveryTable";
import { DeliveryDrawer } from "../../components/delivery/DeliveryDrawer";
import { AnalyticsCharts } from "../../components/delivery/AnalyticsCharts";
import { ExportButtons } from "../../components/delivery/ExportButtons";
import { DeliveryProviderSettings } from "../../components/delivery/DeliveryProviderSettings";
import { DeliveryEmptyState } from "../../components/delivery/DeliveryEmptyState";
import { LoadingSkeleton } from "../../components/delivery/LoadingSkeleton";
import type { DeliveryAdminMode } from "../../types/deliveryAdmin.types";
import "../../components/delivery/deliveryAdmin.css";
import "./adminOperations.css";

export type DeliveryPageProps = {
  mode: DeliveryAdminMode;
  businessId?: number | null;
  operatorToken?: string | null;
  canManageSettings?: boolean;
};

export default function DeliveryPage({
  mode,
  businessId = null,
  operatorToken = null,
  canManageSettings = false,
}: DeliveryPageProps) {
  const admin = useDeliveryAdmin({
    mode,
    businessId,
    operatorToken,
    canManageSettings,
  });

  const items = admin.searchResult?.items ?? [];
  const totalPages = admin.searchResult?.totalPages ?? 1;
  const showMerchant = mode === "operator";

  return (
    <div className="admin-dash-page admin-ops-page dlv-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">
          {mode === "operator" ? "Операции доставки" : "Доставка"}
        </h1>
        <p className="admin-dash-page__subtitle">
          Управление доставками, recovery и провайдерами — обновление каждые 30 с.
        </p>
      </header>

      <div className="admin-ops-tabs" role="tablist" aria-label="Разделы доставки">
        {(
          [
            ["list", "Список"],
            ["analytics", "Аналитика"],
            ...(mode === "merchant" && canManageSettings
              ? ([["settings", "Провайдеры"]] as const)
              : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={admin.tab === id}
            className={`admin-ops-tabs__btn${admin.tab === id ? " admin-ops-tabs__btn--active" : ""}`}
            onClick={() => admin.setTab(id as typeof admin.tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {admin.error ? (
        <DeliveryEmptyState
          variant="error"
          message={admin.error}
          onRetry={() => void admin.refreshAll()}
        />
      ) : null}

      {admin.tab === "list" ? (
        <>
          <StatisticsCards
            mode={mode}
            merchant={admin.dashboardMerchant}
            operator={admin.dashboardOperator}
            loading={admin.loading && !admin.silentRefresh}
          />

          <div className="dlv-toolbar">
            <div className="dlv-toolbar__left">
              <DeliverySearch
                value={admin.searchInput}
                onChange={admin.setSearchInput}
              />
            </div>
            <div className="dlv-toolbar__right">
              <div className="dlv-view-toggle" role="group" aria-label="Вид списка">
                <button
                  type="button"
                  className={`dlv-view-toggle__btn${admin.viewMode === "cards" ? " dlv-view-toggle__btn--active" : ""}`}
                  onClick={() => admin.setViewMode("cards")}
                >
                  Карточки
                </button>
                <button
                  type="button"
                  className={`dlv-view-toggle__btn${admin.viewMode === "table" ? " dlv-view-toggle__btn--active" : ""}`}
                  onClick={() => admin.setViewMode("table")}
                >
                  Таблица
                </button>
              </div>
              <button
                type="button"
                className="dlv-btn dlv-btn--ghost"
                onClick={() => void admin.refreshAll()}
                disabled={admin.loading}
              >
                {admin.loading ? "…" : "Обновить"}
              </button>
            </div>
          </div>

          {admin.lastRefreshAt ? (
            <p className="dlv-auto-refresh">
              Автообновление · последнее{" "}
              {admin.lastRefreshAt.toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          ) : null}

          <DeliveryFilters
            filters={admin.filters}
            onChange={admin.patchFilters}
            showMerchantFilter={showMerchant}
            expanded={admin.filtersExpanded}
            onToggleExpanded={() => admin.setFiltersExpanded((v) => !v)}
          />

          <div style={{ marginBottom: 12 }}>
            <ExportButtons
              mode={mode}
              operatorToken={operatorToken ?? undefined}
              searchItems={items}
              period={admin.period}
            />
          </div>

          {admin.loading && !admin.silentRefresh ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : items.length === 0 ? (
            <DeliveryEmptyState
              variant={
                admin.searchInput.trim() || admin.filters.status
                  ? "no-results"
                  : "no-deliveries"
              }
            />
          ) : admin.viewMode === "table" ? (
            <DeliveryTable
              items={items}
              searchQuery={admin.searchInput}
              showMerchant={showMerchant}
              onRowClick={(id) => void admin.openDelivery(id)}
            />
          ) : (
            <div className="dlv-list">
              {items.map((item) => (
                <DeliveryCard
                  key={item.deliveryId}
                  item={item}
                  searchQuery={admin.searchInput}
                  showMerchant={showMerchant}
                  onClick={(id) => void admin.openDelivery(id)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="dlv-pagination" aria-label="Страницы">
              <button
                type="button"
                className="dlv-btn dlv-btn--ghost dlv-btn--sm"
                disabled={admin.page <= 1}
                onClick={() => admin.setPage((p) => Math.max(1, p - 1))}
              >
                ←
              </button>
              <span className="dlv-pagination__info">
                {admin.page} / {totalPages}
              </span>
              <button
                type="button"
                className="dlv-btn dlv-btn--ghost dlv-btn--sm"
                disabled={admin.page >= totalPages}
                onClick={() => admin.setPage((p) => p + 1)}
              >
                →
              </button>
            </nav>
          ) : null}
        </>
      ) : null}

      {admin.tab === "analytics" ? (
        admin.loading && !admin.analytics ? (
          <LoadingSkeleton variant="stats" />
        ) : !admin.analytics ? (
          <DeliveryEmptyState variant="no-analytics" />
        ) : (
          <AnalyticsCharts
            analytics={admin.analytics}
            operatorDashboard={admin.dashboardOperator}
            period={admin.period}
            onPeriodChange={admin.setPeriod}
            loading={admin.loading && !admin.silentRefresh}
          />
        )
      ) : null}

      {admin.tab === "settings" && mode === "merchant" ? (
        <DeliveryProviderSettings
          policy={admin.providerPolicy}
          providers={admin.providers}
          loading={admin.loading}
          saving={admin.settingsSaving}
          onSave={admin.saveProviderPolicy}
        />
      ) : null}

      <DeliveryDrawer
        open={admin.selectedId != null}
        onClose={admin.closeDrawer}
        mode={mode}
        details={admin.details}
        events={admin.events}
        loading={admin.detailsLoading}
        operatorToken={operatorToken ?? undefined}
        onRefresh={admin.refreshSelected}
        onRetryRecovery={
          mode === "operator" ? admin.retryRecoverySelected : undefined
        }
        onForceRefresh={
          mode === "operator" ? admin.forceRefreshSelected : undefined
        }
      />
    </div>
  );
}
