import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import App from "../App";
import TenantBootScreen from "../components/ui/TenantBootScreen";
import { hasTenantLaunchHint } from "../utils/storeParams";
import {
  isTelegramMiniAppEnv,
  waitForTelegramInitDataResult,
} from "../utils/telegramSession";

/**
 * Без tenant в URL — панель клиента `/merchant`.
 * С `?shop=` / `/s/:slug` / Telegram — приложение магазина.
 */
export default function RootAppOrPlatform() {
  const { pathname, search } = useLocation();
  const [tgBoot, setTgBoot] = useState<"checking" | "ready">(() =>
    isTelegramMiniAppEnv() ? "checking" : "ready",
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isTelegramMiniAppEnv()) {
      setTgBoot("ready");
      return;
    }
    let cancelled = false;
    void (async () => {
      await waitForTelegramInitDataResult({
        timeoutMs: 3_000,
        pollMs: 80,
        stableTicks: 1,
      });
      if (!cancelled) {
        setTgBoot("ready");
        setTick((n) => n + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (tgBoot === "checking") {
    return (
      <TenantBootScreen
        variant="platform"
        message="Подключаемся к Telegram…"
      />
    );
  }

  if (hasTenantLaunchHint(pathname, search)) {
    return <App />;
  }
  return <Navigate to="/merchant" replace />;
}
