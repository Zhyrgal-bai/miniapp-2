import TenantBootScreen from "../components/ui/TenantBootScreen";
import { useMerchantExperienceMode } from "../hooks/useMerchantExperienceMode";
import MerchantLandingPage from "./MerchantLandingPage";
import PlatformPage from "./PlatformPage";

/**
 * `/merchant` — dual experience:
 * - browser → SaaS landing
 * - Telegram Mini App → merchant dashboard (PlatformPage)
 */
export default function MerchantDashboardPage() {
  const { mode, booting } = useMerchantExperienceMode();

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

  return <MerchantLandingPage />;
}
