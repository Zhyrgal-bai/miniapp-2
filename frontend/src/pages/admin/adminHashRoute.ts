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
  | "users"
  | "products"
  | "manage"
  | "categories"
  | "analytics"
  | "customers"
  | "marketing"
  | "design"
  | "tables"
  | "floor"
  | "kitchen"
  | "reservations"
  | "waitlist"
  | "promos"
  | "support"
  | "delivery";

export function adminNavKeyFromPath(path: string): AdminNavKey {
  if (path.includes("/admin/users")) return "users";
  if (path.includes("/admin/design")) return "design";
  if (path.includes("/admin/categories")) return "categories";
  if (path.includes("/admin/products/manage")) return "manage";
  if (path.includes("/admin/products")) return "products";
  if (path.includes("/admin/customers")) return "customers";
  if (path.includes("/admin/marketing")) return "marketing";
  if (path.includes("/admin/analytics")) return "analytics";
  if (path.includes("/admin/tables")) return "tables";
  if (path.includes("/admin/floor")) return "floor";
  if (path.includes("/admin/kitchen")) return "kitchen";
  if (path.includes("/admin/reservations")) return "reservations";
  if (path.includes("/admin/waitlist")) return "waitlist";
  if (path.includes("/admin/promos")) return "promos";
  if (path.includes("/admin/support")) return "support";
  if (path.includes("/admin/delivery")) return "delivery";
  return "orders";
}

export function subscribeAdminHash(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
