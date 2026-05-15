import { Navigate, useLocation } from "react-router-dom";
import App from "../App";
import { hasTenantLaunchHint } from "../utils/storeParams";

/**
 * Без tenant в URL — панель клиента `/merchant`.
 * С `?shop=` / `/store/:slug` / Telegram — приложение магазина.
 */
export default function RootAppOrPlatform() {
  const { pathname, search } = useLocation();
  if (hasTenantLaunchHint(pathname, search)) {
    return <App />;
  }
  return <Navigate to="/merchant" replace />;
}
