import { Navigate } from "react-router-dom";
import App from "../App";
import { readShopIdString } from "../utils/storeParams";

/**
 * Главный бот / регистрация: открытие Mini App без `?shop=` → панель `/platform`.
 * Витрина магазина: при `?shop=` / `?businessId=` / start_param — обычный `App`.
 */
export default function RootAppOrPlatform() {
  const shop = readShopIdString();
  if (shop) {
    return <App />;
  }
  return <Navigate to="/platform" replace />;
}
