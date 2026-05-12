import { Navigate } from "react-router-dom";
import App from "../App";
import { readShopIdString } from "../utils/storeParams";

/**
 * Без `?shop=` (витрина) — открываем панель клиента `/merchant`.
 * С `?shop=` — обычное приложение магазина.
 */
export default function RootAppOrPlatform() {
  const shop = readShopIdString();
  if (shop) {
    return <App />;
  }
  return <Navigate to="/merchant" replace />;
}
