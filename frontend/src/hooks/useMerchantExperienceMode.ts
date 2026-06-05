import { useEffect, useState } from "react";
import {
  isTelegramMiniAppEnv,
  waitForTelegramInitDataResult,
} from "../utils/telegramSession";

export type MerchantExperienceMode = "telegram" | "web";

export function getMerchantExperienceMode(): MerchantExperienceMode {
  return isTelegramMiniAppEnv() ? "telegram" : "web";
}

/** Ждёт initData в Telegram перед рендером dashboard. */
export function useMerchantExperienceMode(): {
  mode: MerchantExperienceMode | null;
  booting: boolean;
} {
  const [mode, setMode] = useState<MerchantExperienceMode | null>(() =>
    isTelegramMiniAppEnv() ? null : "web",
  );
  const [booting, setBooting] = useState(() => isTelegramMiniAppEnv());

  useEffect(() => {
    if (!isTelegramMiniAppEnv()) {
      setMode("web");
      setBooting(false);
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
        setMode("telegram");
        setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { mode, booting };
}
