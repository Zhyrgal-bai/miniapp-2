import { Navigate, useLocation } from "react-router-dom";
import App from "../App";
import { parseStoreSlugFromPath, readShopIdString } from "../utils/storeParams";

/**
 * Без tenant в URL — панель клиента `/merchant`.
 * С `?shop=` / `/store/:slug` / Telegram — приложение магазина.
 */
export default function RootAppOrPlatform() {
  const { pathname } = useLocation();
  const shop = readShopIdString(pathname);
  if (shop || parseStoreSlugFromPath(pathname)) {
    return <App />;
  }
  return <Navigate to="/merchant" replace />;
}
