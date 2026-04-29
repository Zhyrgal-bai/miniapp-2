/** Путь админки из `location.hash` (без вложенного HashRouter). */
export function adminPathFromHash(): string {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw || raw === "/") return "/admin/orders";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  if (!path.startsWith("/admin")) return "/admin/orders";
  return path;
}

export type AdminNavKey =
  | "orders"
  | "products"
  | "manage"
  | "categories"
  | "analytics"
  | "settings";

export function adminNavKeyFromPath(path: string): AdminNavKey {
  if (path.includes("/admin/categories")) return "categories";
  if (path.includes("/admin/products/manage")) return "manage";
  if (path.includes("/admin/products")) return "products";
  if (path.includes("/admin/analytics")) return "analytics";
  if (path.includes("/admin/settings")) return "settings";
  return "orders";
}

export function subscribeAdminHash(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
