import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useShop } from "../../context/ShopContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { adminService } from "../../services/admin.service";
import {
  createMerchantDiningTable,
  deleteMerchantDiningTable,
  fetchMerchantDiningTables,
  saveMerchantDiningTableLayout,
  updateMerchantDiningTable,
  type DiningTableDto,
} from "../../services/diningTablesApi";
import { TableMapCanvas } from "../../components/admin/tables/TableMapCanvas";
import { TableSettingsModal } from "../../components/admin/tables/TableSettingsModal";
import { listLineForTable } from "../../components/admin/tables/tableMapUtils";
import { formatAdminApiError } from "../../utils/adminApiError";
import "./adminTables.css";

export default function AdminTablesPage(): ReactElement {
  const { businessId } = useShop();
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<DiningTableDto[]>([]);
  const [mode, setMode] = useState<"editor" | "preview">("editor");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const layoutTimer = useRef<number | null>(null);

  const supported = businessTypeSupportsTableReservations(businessType);

  const load = useCallback(async () => {
    if (businessId == null) return;
    setLoading(true);
    setError(null);
    try {
      const schema = await adminService.getMerchantSchemas();
      setBusinessType(String(schema.businessType ?? ""));
      const payload = await fetchMerchantDiningTables(businessId);
      setTables(payload.tables);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = tables.find((t) => t.id === selectedId) ?? null;

  const flushLayout = useCallback(
    (nextTables: DiningTableDto[]) => {
      if (businessId == null) return;
      if (layoutTimer.current != null) window.clearTimeout(layoutTimer.current);
      layoutTimer.current = window.setTimeout(() => {
        void (async () => {
          try {
            await saveMerchantDiningTableLayout(
              businessId,
              nextTables.map((t) => ({
                id: t.id,
                posX: t.posX,
                posY: t.posY,
                width: t.width,
                height: t.height,
              })),
            );
          } catch (e) {
            setError(formatAdminApiError(e));
          }
        })();
      }, 450);
    },
    [businessId],
  );

  const onAddTable = async () => {
    if (businessId == null) return;
    setSaving(true);
    setError(null);
    try {
      const n = tables.length;
      const { table } = await createMerchantDiningTable(businessId, {
        name: `Стол #${n + 1}`,
        seats: 2,
        shape: "RECTANGLE",
        posX: 0.1 + (n % 4) * 0.18,
        posY: 0.12 + Math.floor(n / 4) * 0.14,
      });
      setTables((prev) => [...prev, table]);
      setSelectedId(table.id);
      setOk("Столик добавлен");
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onSaveSettings = async (patch: {
    name: string;
    seats: number;
    shape: DiningTableDto["shape"];
    description: string;
    status: DiningTableDto["status"];
  }) => {
    if (businessId == null || !selected) return;
    setSaving(true);
    setError(null);
    try {
      const { table } = await updateMerchantDiningTable(businessId, selected.id, patch);
      setTables((prev) => prev.map((t) => (t.id === table.id ? table : t)));
      setModalOpen(false);
      setOk("Сохранено");
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteTable = async () => {
    if (businessId == null || !selected) return;
    setSaving(true);
    try {
      await deleteMerchantDiningTable(businessId, selected.id);
      setTables((prev) => prev.filter((t) => t.id !== selected.id));
      setSelectedId(null);
      setModalOpen(false);
      setOk("Столик удалён");
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (businessId == null) {
    return (
      <div className="admin-dash-page">
        <p className="admin-dash-page__muted">Магазин не выбран.</p>
      </div>
    );
  }

  if (!loading && !supported) {
    return (
      <div className="admin-dash-page">
        <header className="admin-dash-page__head">
          <h1 className="admin-dash-page__title">Столики</h1>
        </header>
        <p className="admin-dash-page__muted">
          Раздел доступен только для кофеен и фастфуда. Текущий тип магазина не поддерживает
          бронирование столиков.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-dash-page table-admin-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Столики</h1>
        <p className="admin-dash-page__subtitle">
          Схема зала редактируется здесь (не в «Зал live»). Режим «Редактор» — перетаскивание и
          размер угла столика.
        </p>
      </header>

      {loading ? <p className="admin-dash-page__muted">Загрузка…</p> : null}

      {!loading ? (
        <>
          <div className="table-admin-toolbar">
            <div className="table-admin-mode-switch" role="tablist">
              <button
                type="button"
                className={mode === "editor" ? "is-on" : ""}
                onClick={() => setMode("editor")}
              >
                Редактор
              </button>
              <button
                type="button"
                className={mode === "preview" ? "is-on" : ""}
                onClick={() => {
                  setMode("preview");
                  setModalOpen(false);
                }}
              >
                Как у гостя
              </button>
            </div>
            {mode === "editor" ? (
              <button
                type="button"
                className="admin-submit-btn"
                disabled={saving}
                onClick={() => void onAddTable()}
              >
                + Столик
              </button>
            ) : null}
            {mode === "editor" && selected ? (
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={() => setModalOpen(true)}
              >
                Настройки
              </button>
            ) : null}
          </div>

          <TableMapCanvas
            tables={tables}
            mode={mode}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPatchTable={(id, patch) => {
              setTables((prev) => {
                const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
                flushLayout(next);
                return next;
              });
            }}
          />

          {selected?.qrToken ? (
            <p className="admin-theme-hint admin-theme-hint--tight">
              QR столика: добавьте в ссылку Mini App параметр{" "}
              <code>?tableQr={selected.qrToken}</code>
            </p>
          ) : null}

          <section>
            <p className="admin-theme-subtitle admin-theme-hint--tight">Список</p>
            <ul className="table-admin-list">
              {tables.map((t) => (
                <li
                  key={t.id}
                  className={selectedId === t.id ? "is-active" : ""}
                  onClick={() => {
                    setSelectedId(t.id);
                    if (mode === "editor") setModalOpen(true);
                  }}
                >
                  <span>{listLineForTable(t)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <TableSettingsModal
        open={modalOpen && mode === "editor"}
        table={selected}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={onSaveSettings}
        onDelete={() => void onDeleteTable()}
      />

      {error ? (
        <div className="admin-dash-card admin-dash-page__alert" role="alert">
          <p style={{ margin: 0, color: "#fecaca" }}>{error}</p>
        </div>
      ) : null}
      {ok ? <p className="admin-theme-msg">{ok}</p> : null}
    </div>
  );
}
