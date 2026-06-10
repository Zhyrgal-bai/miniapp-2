import { useState } from "react";
import ArchaIntro, { ARCHA_INTRO_SESSION_KEY } from "../components/branding/ArchaIntro";
import TenantBootScreen from "../components/ui/TenantBootScreen";
import { useMerchantExperienceMode } from "../hooks/useMerchantExperienceMode";
import MerchantLandingPage from "./MerchantLandingPage";
import PlatformPage from "./PlatformPage";

/**
 * `/merchant` — dual experience:
 * - browser → SaaS landing (+ premium session intro)
 * - Telegram Mini App → merchant dashboard (PlatformPage)
 */
export default function MerchantDashboardPage() {
  const { mode, booting } = useMerchantExperienceMode();
  const [introDone, setIntroDone] = useState(() => {
    try {
      return sessionStorage.getItem(ARCHA_INTRO_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (booting || mode == null) {
    return (
      <TenantBootScreen
        variant="platform"
        message="Загружаем панель управления…"
      />
    );
  }

  if (mode === "telegram") {
    return <PlatformPage />;
  }

  return (
    <>
      {!introDone ? <ArchaIntro onComplete={() => setIntroDone(true)} /> : null}
      {introDone ? <MerchantLandingPage /> : null}
    </>
  );
}
