import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import { ShopProvider } from "./context/ShopContext";
import { ThemeProvider } from "./context/ThemeContext";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import PlatformPage from "./pages/PlatformPage";
import PlatformAdminPage from "./pages/PlatformAdminPage";
import "leaflet/dist/leaflet.css";
import "./index.css";

const tg = window.Telegram?.WebApp;
tg?.ready();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShopProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/merchant" element={<MerchantDashboardPage />} />
            <Route path="/platform" element={<PlatformPage />} />
            <Route path="/platform-admin" element={<PlatformAdminPage />} />
            <Route path="*" element={<App />} />
          </Routes>
        </ThemeProvider>
      </ShopProvider>
    </BrowserRouter>
  </React.StrictMode>
);