import { memo, useCallback, useState } from "react";
import { ArchaOverlay } from "../ui/ArchaOverlay";
import type {
  DeliveryAdminMode,
  DeliveryDetailsView,
  DeliveryUiEvent,
} from "../../types/deliveryAdmin.types";
import { DeliveryTimeline } from "./DeliveryTimeline";
import { ProviderBadge } from "./ProviderBadge";
import { StatusBadge } from "./StatusBadge";
import { ExportButtons } from "./ExportButtons";
import { formatDeliveryDate, formatSom } from "./deliveryUtils";
import { showSuccessToast, showErrorToast } from "../../store/toast.store";

type DeliveryDrawerProps = {
  open: boolean;
  onClose: () => void;
  mode: DeliveryAdminMode;
  details: DeliveryDetailsView | null;
  events: DeliveryUiEvent[];
  loading?: boolean;
  operatorToken?: string;
  onRefresh: () => Promise<void>;
  onRetryRecovery?: () => Promise<void>;
  onForceRefresh?: () => Promise<void>;
};

export const DeliveryDrawer = memo(function DeliveryDrawer({
  open,
  onClose,
  mode,
  details,
  events,
  loading = false,
  operatorToken,
  onRefresh,
  onRetryRecovery,
  onForceRefresh,
}: DeliveryDrawerProps) {
  const [actionBusy, setActionBusy] = useState(false);

  const copyClaim = useCallback(async () => {
    const id = details?.actions.copy.claimId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      showSuccessToast("Claim ID скопирован");
    } catch {
      showErrorToast("Не удалось скопировать");
    }
  }, [details?.actions.copy.claimId]);

  const runAction = async (fn: () => Promise<void>) => {
    setActionBusy(true);
    try {
      await fn();
      showSuccessToast("Готово");
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setActionBusy(false);
    }
  };

  const d = details?.delivery;
  const recovery = details?.recovery;

  return (
    <ArchaOverlay
      open={open}
      onClose={onClose}
      ariaLabel="Детали доставки"
      variant="sheet"
      header={
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {d ? <ProviderBadge providerId={d.provider} /> : null}
            {d ? <StatusBadge status={d.status} /> : null}
          </div>
          <h2 style={{ margin: "8px 0 0", fontSize: 18 }}>
            Доставка #{d?.id ?? "…"}
          </h2>
        </div>
      }
      footer={
        details ? (
          <div className="dlv-drawer-actions">
            {details.actions.canRefresh ? (
              <button
                type="button"
                className="dlv-btn dlv-btn--primary"
                disabled={actionBusy}
                onClick={() => void runAction(onRefresh)}
              >
                Обновить
              </button>
            ) : null}
            {mode === "operator" && details.actions.canRetryRecovery && onRetryRecovery ? (
              <button
                type="button"
                className="dlv-btn dlv-btn--danger"
                disabled={actionBusy}
                onClick={() => void runAction(onRetryRecovery)}
              >
                Retry Recovery
              </button>
            ) : null}
            {mode === "operator" && details.actions.canForceRefresh && onForceRefresh ? (
              <button
                type="button"
                className="dlv-btn dlv-btn--ghost"
                disabled={actionBusy}
                onClick={() => void runAction(onForceRefresh)}
              >
                Force Refresh
              </button>
            ) : null}
            {details.actions.copy.claimId ? (
              <button type="button" className="dlv-btn dlv-btn--ghost" onClick={() => void copyClaim()}>
                Copy Claim ID
              </button>
            ) : null}
            {details.actions.providerPortalUrl ? (
              <a
                className="dlv-btn dlv-btn--ghost"
                href={details.actions.providerPortalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Provider
              </a>
            ) : null}
          </div>
        ) : null
      }
    >
      {loading || !details ? (
        <div className="dlv-skeleton" style={{ height: 320 }} aria-hidden />
      ) : (
        <>
          <section className="dlv-drawer-section">
            <h3 className="dlv-drawer-section__title">Заказ</h3>
            <div className="dlv-drawer-grid">
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">Order ID</div>
                <div className="dlv-drawer-kv__v">{details.customer.orderId}</div>
              </div>
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">Claim ID</div>
                <div className="dlv-drawer-kv__v">
                  {d?.providerClaimId ?? "—"}
                </div>
              </div>
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">Магазин</div>
                <div className="dlv-drawer-kv__v">{details.merchant.name}</div>
              </div>
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">Клиент</div>
                <div className="dlv-drawer-kv__v">
                  {details.customer.name} · {details.customer.phoneMasked}
                </div>
              </div>
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">Цена</div>
                <div className="dlv-drawer-kv__v">
                  {formatSom(d?.price ?? null, d?.currency ?? "KGS")}
                </div>
              </div>
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">ETA</div>
                <div className="dlv-drawer-kv__v">
                  {d?.etaMinutes != null ? `${d.etaMinutes} мин` : "—"}
                </div>
              </div>
            </div>
          </section>

          {(details.tracking.hasCourier || d?.trackingUrl) && (
            <section className="dlv-drawer-section">
              <h3 className="dlv-drawer-section__title">Курьер и трекинг</h3>
              <div className="dlv-drawer-grid">
                <div className="dlv-drawer-kv">
                  <div className="dlv-drawer-kv__k">Курьер</div>
                  <div className="dlv-drawer-kv__v">{d?.courierName ?? "—"}</div>
                </div>
                <div className="dlv-drawer-kv">
                  <div className="dlv-drawer-kv__k">Авто</div>
                  <div className="dlv-drawer-kv__v">{d?.vehicleNumber ?? "—"}</div>
                </div>
                {d?.trackingUrl ? (
                  <div className="dlv-drawer-kv" style={{ gridColumn: "1 / -1" }}>
                    <div className="dlv-drawer-kv__k">Трекинг</div>
                    <a href={d.trackingUrl} target="_blank" rel="noreferrer">
                      {d.trackingUrl}
                    </a>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {recovery?.inRecoveryQueue ? (
            <section className="dlv-drawer-section">
              <div className="dlv-recovery">
                <div className="dlv-recovery__title">
                  <span aria-hidden>🔧</span> Recovery Required
                </div>
                <div className="dlv-drawer-grid">
                  <div className="dlv-drawer-kv">
                    <div className="dlv-drawer-kv__k">Попыток</div>
                    <div className="dlv-drawer-kv__v">{recovery.retryCount}</div>
                  </div>
                  <div className="dlv-drawer-kv">
                    <div className="dlv-drawer-kv__k">Следующая попытка</div>
                    <div className="dlv-drawer-kv__v">
                      {formatDeliveryDate(recovery.nextRetryAt)}
                    </div>
                  </div>
                </div>
                {recovery.lastError ? (
                  <p className="dlv-field__error" style={{ marginTop: 8 }}>
                    {recovery.lastError}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="dlv-drawer-section">
            <h3 className="dlv-drawer-section__title">Timeline</h3>
            <DeliveryTimeline events={events} />
          </section>

          {mode === "operator" && details.audit.length > 0 ? (
            <section className="dlv-drawer-section">
              <h3 className="dlv-drawer-section__title">Audit</h3>
              <div className="dlv-audit-list">
                {details.audit.map((a) => (
                  <div key={a.id} className="dlv-audit-item">
                    <strong>{a.action}</strong> · {a.actor}
                    <div className="dlv-timeline__meta">
                      {formatDeliveryDate(a.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="dlv-drawer-section">
            <h3 className="dlv-drawer-section__title">Экспорт timeline</h3>
            <ExportButtons
              mode={mode}
              operatorToken={operatorToken}
              deliveryId={d?.id ?? null}
              timelineJson={events}
            />
          </section>
        </>
      )}
    </ArchaOverlay>
  );
});
