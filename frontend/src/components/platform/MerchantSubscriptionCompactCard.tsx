import { useCallback, useEffect, useState } from "react";
import {
  fetchMerchantSubscriptionPanel,
  type MerchantSubscriptionPanelPayload,
} from "../../services/platformApi";
import {
  isFreeStartStatus,
  resolveFreeOrdersProgressModel,
  resolveMerchantGrowthBanner,
} from "../../utils/subscriptionUx";
import "./MerchantSubscriptionCompactCard.css";

type Props = {
  businessId: number;
  onOpen: () => void;
  panel?: MerchantSubscriptionPanelPayload | null;
};

function statusLine(panel: MerchantSubscriptionPanelPayload): string {
  if (panel.displayStatus === "PENDING_PAYMENT") {
    return "Ожидает оплаты";
  }
  if (panel.displayStatus === "TRIAL" || panel.displayStatus === "FREE") {
    return "Бесплатный старт";
  }
  if (panel.displayStatus === "QUOTA_EXHAUSTED") {
    return "Бесплатный этап завершён";
  }
  return panel.displayStatusLabel;
}

function daysLine(panel: MerchantSubscriptionPanelPayload): string | null {
  if (panel.displayStatus === "PENDING_PAYMENT") {
    return "Подтверждение оплаты Finik";
  }
  if (isFreeStartStatus(panel.displayStatus)) {
    const used = panel.freeOrdersUsed ?? 0;
    const limit = panel.freeOrdersLimit ?? 5;
    const remaining = Math.max(0, limit - used);
    return `Использовано ${used}/${limit} · Осталось ${remaining}`;
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

export function MerchantSubscriptionCompactCard({ businessId, onOpen, panel }: Props) {
  const [loadedPanel, setLoadedPanel] = useState<MerchantSubscriptionPanelPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(panel == null);

  const load = useCallback(async () => {
    if (businessId <= 0) return;
    setLoading(true);
    try {
      const p = await fetchMerchantSubscriptionPanel(businessId);
      setLoadedPanel(p);
    } catch {
      setLoadedPanel(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (panel != null) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, panel]);

  const effectivePanel = panel ?? loadedPanel;
  const progress =
    effectivePanel != null &&
    isFreeStartStatus(effectivePanel.displayStatus)
      ? resolveFreeOrdersProgressModel(effectivePanel)
      : null;
  const growthBanner =
    effectivePanel != null ? resolveMerchantGrowthBanner(effectivePanel) : null;

  return (
    <section
      className="archa-sub-compact archa-glass archa-glass--glow"
      aria-label="Подписка ARCHA"
    >
      <div className="archa-sub-compact__copy">
        <h2 className="archa-sub-compact__title">Подписка ARCHA</h2>
        {loading ? (
          <p className="archa-sub-compact__meta">Загрузка…</p>
        ) : effectivePanel != null ? (
          <>
            <p className="archa-sub-compact__status">{statusLine(effectivePanel)}</p>
            {daysLine(effectivePanel) != null ? (
              <p className="archa-sub-compact__meta">{daysLine(effectivePanel)}</p>
            ) : null}
            {growthBanner != null ? (
              <p className="archa-sub-compact__banner">{growthBanner.title}</p>
            ) : null}
            {progress != null ? (
              <div
                className={`archa-sub-compact__progress archa-sub-compact__progress--${progress.tier}`}
                aria-hidden
              >
                <span
                  className="archa-sub-compact__progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
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
