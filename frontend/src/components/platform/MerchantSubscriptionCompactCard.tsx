import { useCallback, useEffect, useState } from "react";
import {
  fetchMerchantSubscriptionPanel,
  type MerchantSubscriptionPanelPayload,
} from "../../services/platformApi";
import "./MerchantSubscriptionCompactCard.css";

type Props = {
  businessId: number;
  onOpen: () => void;
};

function statusLine(panel: MerchantSubscriptionPanelPayload): string {
  if (panel.displayStatus === "PENDING_PAYMENT") {
    return "Ожидает оплаты";
  }
  if (panel.displayStatus === "TRIAL") {
    return "Пробный период";
  }
  return panel.displayStatusLabel;
}

function daysLine(panel: MerchantSubscriptionPanelPayload): string | null {
  if (panel.displayStatus === "PENDING_PAYMENT") {
    return "Подтверждение оплаты Finik";
  }
  if (panel.daysLeft != null && panel.daysLeft >= 0) {
    const n = panel.daysLeft;
    const mod10 = n % 10;
    const mod100 = n % 100;
    let word = "дней";
    if (mod100 < 11 || mod100 > 14) {
      if (mod10 === 1) word = "день";
      else if (mod10 >= 2 && mod10 <= 4) word = "дня";
    }
    return `${n} ${word} осталось`;
  }
  return null;
}

export function MerchantSubscriptionCompactCard({ businessId, onOpen }: Props) {
  const [panel, setPanel] = useState<MerchantSubscriptionPanelPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (businessId <= 0) return;
    setLoading(true);
    try {
      const p = await fetchMerchantSubscriptionPanel(businessId);
      setPanel(p);
    } catch {
      setPanel(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className="archa-sub-compact archa-glass archa-glass--glow"
      aria-label="Подписка ARCHA"
    >
      <div className="archa-sub-compact__copy">
        <h2 className="archa-sub-compact__title">Подписка ARCHA</h2>
        {loading ? (
          <p className="archa-sub-compact__meta">Загрузка…</p>
        ) : panel != null ? (
          <>
            <p className="archa-sub-compact__status">{statusLine(panel)}</p>
            {daysLine(panel) != null ? (
              <p className="archa-sub-compact__meta">{daysLine(panel)}</p>
            ) : null}
          </>
        ) : (
          <p className="archa-sub-compact__meta">Управление подпиской</p>
        )}
      </div>
      <button
        type="button"
        className="mp-btn mp-btn--primary archa-sub-compact__btn"
        onClick={onOpen}
      >
        Открыть
      </button>
    </section>
  );
}
