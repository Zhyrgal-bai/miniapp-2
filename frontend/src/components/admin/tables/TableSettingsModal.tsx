import { useEffect, useState, type ReactElement } from "react";
import type {
  DiningTableDto,
  DiningTableShape,
  DiningTableStatus,
} from "../../../services/diningTablesApi";
import { DINING_TABLE_STATUS_LABELS } from "@repo-shared/tableReservation";

type Props = {
  open: boolean;
  table: DiningTableDto | null;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: {
    name: string;
    seats: number;
    shape: DiningTableShape;
    description: string;
    status: DiningTableStatus;
  }) => void;
  onDelete: () => void;
};

const SHAPES: { id: DiningTableShape; label: string }[] = [
  { id: "SQUARE", label: "Квадрат" },
  { id: "RECTANGLE", label: "Прямоуг." },
  { id: "CIRCLE", label: "Круг" },
  { id: "VIP", label: "VIP" },
];

const STATUSES: DiningTableStatus[] = [
  "AVAILABLE",
  "SOON_OCCUPIED",
  "OCCUPIED",
  "RESERVED",
];

export function TableSettingsModal({
  open,
  table,
  saving,
  onClose,
  onSave,
  onDelete,
}: Props): ReactElement | null {
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(2);
  const [shape, setShape] = useState<DiningTableShape>("RECTANGLE");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<DiningTableStatus>("AVAILABLE");

  useEffect(() => {
    if (!table) return;
    setName(table.name);
    setSeats(table.seats);
    setShape(table.shape);
    setDescription(table.description);
    setStatus(table.status);
  }, [table]);

  if (!open || !table) return null;

  return (
    <div
      className="admin-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal table-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal__head">
          <h2 id="table-settings-title" className="admin-modal__title">
            Настройки столика
          </h2>
          <button type="button" className="admin-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-modal__body">
          <label className="admin-theme-field admin-theme-field--full">
            Название
            <input
              className="admin-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </label>
          <label className="admin-theme-field admin-theme-field--full">
            Мест
            <input
              type="number"
              min={1}
              max={99}
              className="admin-input"
              value={seats}
              onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>

          <p className="admin-theme-subtitle admin-theme-hint--tight">Форма</p>
          <div className="table-shape-picker">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={shape === s.id ? "is-on" : ""}
                onClick={() => setShape(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="admin-theme-subtitle admin-theme-hint--tight" style={{ marginTop: 12 }}>
            Статус
          </p>
          <div className="admin-theme-layout-switch">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`admin-theme-layout-switch__btn${status === s ? " admin-theme-layout-switch__btn--on" : ""}`}
                onClick={() => setStatus(s)}
              >
                {DINING_TABLE_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <label className="admin-theme-field admin-theme-field--full">
            Описание
            <textarea
              className="admin-input admin-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              placeholder="У окна, розетка, тихий уголок…"
            />
          </label>
        </div>

        <div className="admin-modal__foot">
          <button
            type="button"
            className="admin-theme-reset"
            disabled={saving}
            onClick={onDelete}
          >
            Удалить
          </button>
          <button type="button" className="admin-secondary-btn" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="admin-submit-btn"
            disabled={saving || name.trim() === ""}
            onClick={() =>
              onSave({
                name: name.trim(),
                seats,
                shape,
                description: description.trim(),
                status,
              })
            }
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
