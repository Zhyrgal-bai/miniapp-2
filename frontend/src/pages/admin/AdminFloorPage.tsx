import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useShop } from "../../context/ShopContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { adminService } from "../../services/admin.service";
import {
  fetchVenueFloor,
  fetchVenueMetrics,
  venueCloseSession,
  venueOpenSession,
  venueRequestPayment,
  type FloorSnapshot,
  type FloorTableDto,
} from "../../services/venueApi";
import { LiveFloorMap } from "../../components/venue/LiveFloorMap";
import { useVenueLiveStream } from "../../hooks/useVenueLiveStream";
import { formatAdminApiError } from "../../utils/adminApiError";
import "../../components/venue/liveFloor.css";

export default function AdminFloorPage(): ReactElement {
  const { businessId } = useShop();
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [floor, setFloor] = useState<FloorSnapshot | null>(null);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof fetchVenueMetrics>> | null>(null);
  const [selected, setSelected] = useState<FloorTableDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supported = businessTypeSupportsTableReservations(businessType);

  const load = useCallback(async () => {
    if (businessId == null) return;
    try {
      const [f, m] = await Promise.all([
        fetchVenueFloor(businessId),
        fetchVenueMetrics(businessId),
      ]);
      setFloor(f);
      setMetrics(m);
      setError(null);
    } catch (e) {
      setError(formatAdminApiError(e));
    }
  }, [businessId]);

  useEffect(() => {
    void (async () => {
      if (businessId == null) return;
      const schema = await adminService.getMerchantSchemas();
      setBusinessType(String(schema.businessType ?? ""));
    })();
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  useVenueLiveStream(businessId, load);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!supported && businessType != null) {
    return (
      <div className="admin-dash-page">
        <p className="admin-dash-page__muted">Зал доступен только для кофеен и фастфуда.</p>
      </div>
    );
  }

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">🪑 Зал live</h1>
        <p className="admin-dash-page__subtitle">
          Оперативная карта столиков. Чтобы двигать и менять размер столов — раздел «Столики».
        </p>
      </header>

      {metrics ? (
        <div className="floor-metrics">
          <div className="floor-metrics__cell">
            <div className="floor-metrics__val">{metrics.occupancyPercent}%</div>
            <div className="floor-metrics__lbl">Загрузка</div>
          </div>
          <div className="floor-metrics__cell">
            <div className="floor-metrics__val">{metrics.activeSessions}</div>
            <div className="floor-metrics__lbl">Активных столов</div>
          </div>
          <div className="floor-metrics__cell">
            <div className="floor-metrics__val">{metrics.avgTableMinutes}м</div>
            <div className="floor-metrics__lbl">Среднее время</div>
          </div>
          <div className="floor-metrics__cell">
            <div className="floor-metrics__val">{metrics.busiestHour ?? "—"}</div>
            <div className="floor-metrics__lbl">Пик час</div>
          </div>
        </div>
      ) : null}

      {floor ? (
        <LiveFloorMap
          tables={floor.tables}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      ) : (
        <p className="admin-dash-page__muted">Загрузка зала…</p>
      )}

      {selected ? (
        <div className="floor-actions">
          {!selected.session ? (
            <button
              type="button"
              className="is-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (businessId == null) return;
                  await venueOpenSession(businessId, {
                    tableId: selected.id,
                    partySize: selected.seats,
                  });
                })
              }
            >
              Гости пришли
            </button>
          ) : null}
          {selected.session ? (
            <>
              <button
                type="button"
                className="is-primary"
                disabled={busy}
                onClick={() => {
                  window.location.hash = "#/admin/orders";
                }}
              >
                Открыть заказы
              </button>
              <button
                type="button"
                className="is-warn"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (businessId == null || !selected.session) return;
                    await venueRequestPayment(businessId, selected.session.id);
                  })
                }
              >
                Запросить оплату
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (businessId == null || !selected.session) return;
                    await venueCloseSession(businessId, selected.session.id);
                    setSelected(null);
                  })
                }
              >
                Завершить стол
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="admin-dash-card admin-dash-page__alert" role="alert">
          <p style={{ margin: 0, color: "#fecaca" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
