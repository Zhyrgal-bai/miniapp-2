import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import { ShopProvider } from "./context/ShopContext";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import "leaflet/dist/leaflet.css";
import "./index.css";

const tg = window.Telegram?.WebApp;
tg?.ready();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShopProvider>
        <Routes>
          <Route path="/merchant" element={<MerchantDashboardPage />} />
          <Route path="*" element={<App />} />
        </Routes>
      </ShopProvider>
    </BrowserRouter>
  </React.StrictMode>
);