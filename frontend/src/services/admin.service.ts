import { api, API_BASE_URL, apiAbsoluteUrl } from "./api";
import type { Category, Product } from "../types";
import { getWebAppUserId } from "../utils/telegramUserId";

/** Относительный путь или уже полный `https://...` (не дублируем API_BASE_URL). */
function resolveAdminUrl(path: string): string {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${p}`;
}

function requireAdminUserId(): number {
  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Откройте приложение в Telegram");
  }
  return userId;
}

export async function postConnectBot(
  botToken: string
): Promise<{ ok: boolean; shopId: number; botUsername: string }> {
  return adminPost("/connect-bot", { botToken });
}

async function readFetchError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    return (j.message ?? j.error ?? text) || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

async function adminPost<T>(
  path: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const userId = requireAdminUserId();
  const url = resolveAdminUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, userId }),
  });
  if (!res.ok) throw new Error(await readFetchError(res));
  return res.json() as Promise<T>;
}

async function adminGet<T>(path: string): Promise<T> {
  const userId = requireAdminUserId();
  const url = new URL(resolveAdminUrl(path));
  url.searchParams.set("userId", String(userId));
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(await readFetchError(res));
  return res.json() as Promise<T>;
}

async function adminDelete(path: string): Promise<void> {
  const userId = requireAdminUserId();
  const resolved = resolveAdminUrl(path);
  const sep = resolved.includes("?") ? "&" : "?";
  const url = `${resolved}${sep}userId=${encodeURIComponent(String(userId))}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(await readFetchError(res));
}

export type AdminPaymentDetail = {
  id: number;
  type: string;
  value: string;
};

export type AdminPromoRecord = {
  code: string;
  discount: number;
  maxUses: number;
  used: number;
};

export type AdminOrderListItem = {
  id: number;
  name: string;
  phone: string;
  status: string;
  statusText: string;
  total: number;
  paymentMethod?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  tracking?: string | null;
  receiptUrl?: string | null;
  receiptType?: string | null;
};

export type AdminAnalytics = {
  totalOrders: number;
  totalRevenue: number;
  accepted: number;
  done: number;
  pending?: number;
  shipped?: number;
  byStatus?: Record<string, number>;
};

export type CategoryCreateInput = {
  name: string;
  parentId?: number | null;
};

async function fetchAdminOrders(): Promise<AdminOrderListItem[]> {
  const data = await adminGet<AdminOrderListItem[]>("/orders");
  return Array.isArray(data) ? data : [];
}

export const adminService = {
  async getProducts(): Promise<Product[]> {
    const userId = requireAdminUserId();
    const res = await api.get<Product[]>("/products", { params: { userId } });
    return res.data;
  },

  async getProduct(id: number): Promise<Product> {
    const userId = requireAdminUserId();
    const res = await api.get<Product>(`/products/${id}`, { params: { userId } });
    return res.data;
  },

  async createProduct(data: Product): Promise<Product> {
    const userId = requireAdminUserId();
    try {
      const images =
        data.images && data.images.length > 0
          ? data.images
          : data.image
            ? [data.image]
            : [];
      const res = await api.post<Product>("/products", {
        ...data,
        userId,
        images,
        image: images[0] ?? data.image,
      });
      console.log("CREATED:", res.data);
      return res.data;
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error("CREATE ERROR:", e.message);
      }
      throw e;
    }
  },

  async deleteProduct(id: number): Promise<void> {
    const userId = requireAdminUserId();
    await api.delete(`/products/${id}`, {
      data: { userId },
      params: { userId },
    });
  },

  async updateProduct(
    id: number,
    patch: Partial<
      Pick<
        Product,
        | "name"
        | "price"
        | "image"
        | "images"
        | "description"
        | "categoryId"
        | "isNew"
        | "isPopular"
        | "isSale"
        | "discountPercent"
        | "variants"
      >
    >
  ): Promise<Product> {
    const userId = requireAdminUserId();
    const res = await api.put<Product>(`/products/${id}`, {
      ...patch,
      userId,
    });
    return res.data;
  },

  async listPaymentDetails(): Promise<AdminPaymentDetail[]> {
    const data = await adminPost<AdminPaymentDetail[]>("/payment/list", {});
    return data ?? [];
  },

  async savePaymentSettings(data: {
    mbank?: string;
    optima?: string;
    obank?: string;
    other?: string;
    card?: string;
    qr?: string;
  }): Promise<unknown> {
    const payload = {
      ...data,
      // Совместимость со старым полем `obank`.
      obank: data.obank ?? data.other,
    } as Record<string, unknown>;
    return adminPost("/payment", payload);
  },

  async deletePaymentDetail(id: number): Promise<void> {
    await adminDelete(`/payment/${id}`);
  },

  async listPromos(): Promise<AdminPromoRecord[]> {
    const data = await adminPost<AdminPromoRecord[]>("/promo/list", {});
    return data ?? [];
  },

  async addPromo(
    code: string,
    discount: number,
    maxUses: number
  ): Promise<AdminPromoRecord> {
    return adminPost<AdminPromoRecord>("/promo", {
      code,
      discount,
      maxUses,
      limit: maxUses,
    });
  },

  async deletePromo(code: string): Promise<void> {
    await adminDelete(`/promo/${encodeURIComponent(code)}`);
  },

  /** Список заказов из PostgreSQL (polling и после действий). */
  fetchOrders: fetchAdminOrders,

  listOrders: fetchAdminOrders,

  listAllOrders: fetchAdminOrders,

  async uploadImage(file: File): Promise<string> {
    const userId = requireAdminUserId();
    const form = new FormData();
    form.append("userId", String(userId));
    form.append("file", file);
    const url = `${API_BASE_URL}/upload`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(await readFetchError(res));
    const j = (await res.json()) as { url?: string };
    if (!j.url) throw new Error("Нет url в ответе");
    return j.url;
  },

  async uploadImages(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    const userId = requireAdminUserId();
    const form = new FormData();
    form.append("userId", String(userId));
    for (const f of files) {
      form.append("files", f);
    }
    const url = `${API_BASE_URL}/products/upload-images`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(await readFetchError(res));
    const j = (await res.json()) as { urls?: string[] };
    return Array.isArray(j.urls) ? j.urls : [];
  },

  async updateOrderStatus(
    id: number,
    status: "ACCEPTED" | "CONFIRMED" | "SHIPPED" | "CANCELLED"
  ): Promise<unknown> {
    const userId = requireAdminUserId();
    const url = `${API_BASE_URL}/orders/${id}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, userId }),
    });
    console.log("PUT /orders/:id (status)", res.status);
    if (!res.ok) throw new Error(await readFetchError(res));
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  },

  /** Статус доставки / комментарий (только tracking, без смены status). */
  async updateOrderTracking(id: number, tracking: string): Promise<unknown> {
    const userId = requireAdminUserId();
    const url = `${API_BASE_URL}/orders/${id}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracking, userId }),
    });
    console.log("PUT /orders/:id (tracking)", res.status);
    if (!res.ok) throw new Error(await readFetchError(res));
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  },

  async clearOrders(type: "completed" | "rejected" | "all"): Promise<number> {
    const userId = requireAdminUserId();
    const url = new URL(`${API_BASE_URL}/orders/clear`);
    url.searchParams.set("type", type);
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
    const data = (await res.json().catch(() => ({}))) as { deleted?: unknown };
    return typeof data.deleted === "number" ? data.deleted : 0;
  },

  async getAnalytics(): Promise<AdminAnalytics> {
    const d = await adminPost<AdminAnalytics>("/analytics", {});
    if (
      !d ||
      typeof d.totalOrders !== "number" ||
      typeof d.totalRevenue !== "number" ||
      typeof d.accepted !== "number" ||
      typeof d.done !== "number"
    ) {
      throw new Error("Некорректный ответ аналитики");
    }
    const byStatus =
      d.byStatus != null &&
      typeof d.byStatus === "object" &&
      !Array.isArray(d.byStatus)
        ? d.byStatus
        : {};
    return {
      ...d,
      pending: typeof d.pending === "number" ? d.pending : 0,
      shipped: typeof d.shipped === "number" ? d.shipped : d.done,
      byStatus,
    };
  },

  async getCategories(): Promise<Category[]> {
    const userId = requireAdminUserId();
    const res = await api.get<Category[]>(apiAbsoluteUrl("/categories"), {
      params: { userId },
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  async createCategory(input: CategoryCreateInput): Promise<Category> {
    return adminPost<Category>(apiAbsoluteUrl("/categories"), {
      name: input.name,
      parentId: input.parentId ?? null,
    });
  },

  async deleteCategory(id: number): Promise<void> {
    await adminDelete(apiAbsoluteUrl(`/categories/${id}`));
  },
};
