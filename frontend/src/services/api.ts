import axios from "axios";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** Убираем хвост `/api`, чтобы пути вроде `/categories` не превращались в `/api/categories` (404). */
function normalizeApiRoot(url: string): string {
  const trimmed = normalizeBaseUrl(url);
  if (trimmed.endsWith("/api")) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

const envUrl =
  typeof import.meta.env.VITE_API_URL === "string"
    ? import.meta.env.VITE_API_URL.trim()
    : "";

/** База API: задайте `VITE_API_URL` в `frontend/.env` (тот же публичный URL, что `API_URL` на бэкенде). */
export const API_BASE_URL =
  envUrl !== "" ? normalizeApiRoot(envUrl) : "";

/**
 * Абсолютный URL эндпоинта (axios с baseURL игнорирует свой baseURL для absolute URL).
 * Используй для путей, которые должны гарантированно попасть на бэкенд.
 */
export function apiAbsoluteUrl(path: string): string {
  const base = normalizeBaseUrl(API_BASE_URL);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});
