import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import { ShopProvider } from "./context/ShopContext";
import { ThemeProvider } from "./context/ThemeContext";
import { StorefrontPayloadProvider } from "./components/storefront/runtime/StorefrontPayloadContext";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import MerchantRegisterPage from "./pages/MerchantRegisterPage";
import MerchantFaqPage from "./pages/MerchantFaqPage";
import RootAppOrPlatform from "./pages/RootAppOrPlatform";
import AppErrorBoundary from "./components/ui/AppErrorBoundary";
import "leaflet/dist/leaflet.css";
import "./index.css";
/** Последним в бандле: перебивает ProductCard.css / ProductGrid.css / kits (порядок каскада). */
import "./components/storefront/storefrontBones.css";
import "./components/storefront/commerceShell.css";
import "./components/storefront/commerce/openInTelegramCta.css";
import "./components/storefront/commerce/customerLocationPrompt.css";
import { bootstrapTelegramWebApp } from "./utils/telegramWebAppBootstrap";

bootstrapTelegramWebApp();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
      <ShopProvider>
        <ThemeProvider>
          <StorefrontPayloadProvider>
            <Routes>
              <Route
                path="/merchant/register"
                element={<MerchantRegisterPage />}
              />
              <Route path="/merchant/faq" element={<MerchantFaqPage />} />
              <Route path="/merchant" element={<MerchantDashboardPage />} />
              <Route
                path="/platform"
                element={<Navigate to="/merchant" replace />}
              />
              <Route path="/store/:slug" element={<App />} />
              <Route path="/s/:slug" element={<App />} />
              <Route path="/" element={<RootAppOrPlatform />} />
              <Route path="*" element={<App />} />
            </Routes>
          </StorefrontPayloadProvider>
        </ThemeProvider>
      </ShopProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
