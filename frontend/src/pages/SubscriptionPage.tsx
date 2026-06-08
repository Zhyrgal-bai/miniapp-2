import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArchPremiumSubscription } from "../components/platform/ArchPremiumSubscription";
import { ARCHA_BRAND } from "../config/brandAssets";
import { MERCHANT_HUB_PATH } from "../constants/merchantRoutes";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { fetchPlatformMyBusinesses } from "../services/platformApi";
import { formatAdminApiError } from "../utils/adminApiError";
import { getTelegramWebApp } from "../utils/telegram";
import { resolveMerchantTelegramUserId } from "../utils/telegramUserId";
import "./SubscriptionPage.css";
import "./MerchantPage.css";

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const finikReturn = searchParams.get("finik") === "return";
  const goHub = useCallback(() => navigate(MERCHANT_HUB_PATH), [navigate]);
  useTelegramBackButton(true, goHub);

  const [telegramId, setTelegramId] = useState<number>(NaN);
  const [businessId, setBusinessId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${ARCHA_BRAND.name} — Подписка`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let tgId = NaN;
        for (let attempt = 0; attempt < 50; attempt++) {
          const tg = getTelegramWebApp();
          tgId = resolveMerchantTelegramUserId(tg);
          const signed =
            typeof tg?.initData === "string" ? tg.initData.trim() : "";
          if (signed.length > 20 && Number.isFinite(tgId) && tgId > 0) break;
          await new Promise((r) => setTimeout(r, 120));
        }
        if (!Number.isFinite(tgId) || tgId <= 0) {
          if (!cancelled) {
            setError("Откройте панель в Telegram Mini App.");
            setBusinessId(0);
          }
          return;
        }
        const rows = await fetchPlatformMyBusinesses({ telegramId: tgId });
        const primary = rows[0];
        if (primary == null) {
          if (!cancelled) {
            setError("Сначала создайте магазин в панели ARCHA.");
            setTelegramId(tgId);
            setBusinessId(0);
          }
          return;
        }
        if (!cancelled) {
          setTelegramId(tgId);
          setBusinessId(primary.id);
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatAdminApiError(e));
          setBusinessId(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="merchant-subscription-page mp-page mp-page--v2 mp-page--premium">
      <header className="merchant-subscription-page__top">
        <button
          type="button"
          className="merchant-subscription-page__back"
          onClick={goHub}
        >
          ← Назад
        </button>
        <h1 className="merchant-subscription-page__title">Подписка ARCHA</h1>
      </header>

      <main className="merchant-subscription-page__main">
        {loading ? (
          <p className="mp-muted text-sm">Загрузка…</p>
        ) : error != null ? (
          <p className="archa-sub__hint archa-sub__hint--warn" role="alert">
            {error}
          </p>
        ) : businessId > 0 && Number.isFinite(telegramId) ? (
          <ArchPremiumSubscription
            businessId={businessId}
            telegramId={telegramId}
            finikReturn={finikReturn}
          />
        ) : null}
      </main>
    </div>
  );
}
