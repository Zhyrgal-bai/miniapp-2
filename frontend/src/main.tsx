import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import { ShopProvider } from "./context/ShopContext";
import { ThemeProvider } from "./context/ThemeContext";
import { StorefrontPayloadProvider } from "./components/storefront/runtime/StorefrontPayloadContext";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import MerchantRegisterPage from "./pages/MerchantRegisterPage";
import RootAppOrPlatform from "./pages/RootAppOrPlatform";
import "leaflet/dist/leaflet.css";
import "./index.css";
/** Последним в бандле: перебивает ProductCard.css / ProductGrid.css / kits (порядок каскада). */
import "./components/storefront/storefrontBones.css";

const tg = window.Telegram?.WebApp;
tg?.ready();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShopProvider>
        <ThemeProvider>
          <StorefrontPayloadProvider>
            <Routes>
              <Route
                path="/merchant/register"
                element={<MerchantRegisterPage />}
              />
              <Route path="/merchant" element={<MerchantDashboardPage />} />
              <Route
                path="/platform"
                element={<Navigate to="/merchant" replace />}
              />
              <Route path="/" element={<RootAppOrPlatform />} />
              <Route path="*" element={<App />} />
            </Routes>
          </StorefrontPayloadProvider>
        </ThemeProvider>
      </ShopProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
