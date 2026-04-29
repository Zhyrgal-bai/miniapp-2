import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  adminService,
  type AdminPromoRecord,
} from "../../services/admin.service";

export default function PromoCodesPanel() {
  const [items, setItems] = useState<AdminPromoRecord[]>([]);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await adminService.listPromos();
      setItems(data);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить промокоды");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    const d = Number(discount);
    const m = Number(maxUses);
    if (!c) {
      setError("Укажите код");
      return;
    }
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      setError("Скидка: 0–100%");
      return;
    }
    if (!Number.isFinite(m) || m < 1 || !Number.isInteger(m)) {
      setError("Лимит использований: целое число ≥ 1");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await adminService.addPromo(c, d, m);
      setCode("");
      await load();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("Нет прав");
      } else if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError("Такой код уже есть");
      } else {
        const msg = (err as { response?: { data?: { error?: string } } })
          ?.response?.data?.error;
        setError(msg ?? "Не удалось добавить");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (promoCode: string) => {
    try {
      await adminService.deletePromo(promoCode);
      await load();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        alert("Нет прав");
      } else {
        alert("Не удалось удалить");
      }
    }
  };

  return (
    <>
      <h2 className="admin-section-title">Промокоды</h2>

      <form className="admin-form admin-promo-form" onSubmit={handleSubmit}>
        {error && (
          <div className="admin-form-error" role="alert">
            {error}
          </div>
        )}

        <input
          id="promo-code"
          className="admin-input"
          placeholder="Код"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
        />
        <input
          id="promo-discount"
          className="admin-input"
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          placeholder="Скидка %"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
        <input
          id="promo-max"
          className="admin-input"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder="Лимит"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
        />

        <button
          type="submit"
          className="admin-submit-btn"
          disabled={loading}
        >
          {loading ? "Создание…" : "Создать"}
        </button>
      </form>

      <div className="admin-promo-list">
        {listLoading && (
          <p className="admin-empty-products">Загрузка…</p>
        )}
        {!listLoading && items.length === 0 && (
          <p className="admin-empty-products">Промокодов нет</p>
        )}
        {!listLoading &&
          items.map((p) => (
            <div key={p.code} className="admin-promo-card">
              <div className="admin-promo-card__code">{p.code}</div>
              <div className="admin-promo-card__discount">{p.discount}%</div>
              <div className="admin-promo-card__usage">
                использовано: {p.used} / {p.maxUses}
              </div>
              <button
                type="button"
                className="admin-promo-card__delete delete"
                onClick={() => handleDelete(p.code)}
              >
                удалить
              </button>
            </div>
          ))}
      </div>
    </>
  );
}
