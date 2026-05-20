import { api, API_BASE_URL, apiAbsoluteUrl } from "./api";
import type { Category, Product } from "../types";
import { getWebAppUserId } from "../utils/telegramUserId";
import { withTenantHeaders } from "./api";

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
    headers: withTenantHeaders({ "Content-Type": "application/json" }, url),
    body: JSON.stringify({ ...body, userId }),
  });
  if (!res.ok) throw new Error(await readFetchError(res));
  return res.json() as Promise<T>;
}

async function adminGet<T>(path: string): Promise<T> {
  const userId = requireAdminUserId();
  const url = new URL(resolveAdminUrl(path));
  url.searchParams.set("userId", String(userId));
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: withTenantHeaders(undefined, url.toString()),
  });
  if (!res.ok) throw new Error(await readFetchError(res));
  return res.json() as Promise<T>;
}

async function adminPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const userId = requireAdminUserId();
  const url = resolveAdminUrl(path);
  const res = await fetch(url, {
    method: "PATCH",
    headers: withTenantHeaders({ "Content-Type": "application/json" }, url),
    body: JSON.stringify({ ...body, userId }),
  });
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
    headers: withTenantHeaders({ "Content-Type": "application/json" }, url),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(await readFetchError(res));
}

export type AdminPaymentDetail = {
  id: number;
  type: string;
  value: string;
};

export type AdminMembershipRow = {
  userId: number;
  role: string;
  telegramId: string;
  name: string | null;
  permissions?: string[];
};

export type AdminPromoRecord = {
  code: string;
  discount: number;
  maxUses: number;
  used: number;
};

export type AdminOrderListItem = {
  id: number;
  orderNumber?: string | null;
  displayNumber?: string;
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
  buyerTelegramId?: string | null;
};

export type AdminAnalytics = {
  totalOrders: number;
  totalRevenue: number;
  accepted: number;
  done: number;
  pending?: number;
  shipped?: number;
  delivered?: number;
  byStatus?: Record<string, number>;
  rangeDays?: number;
  rangeSince?: string;
  ordersInRange?: number;
  revenueInRange?: number;
  paidOrdersInRange?: number;
  averageOrderValue?: number;
  conversionRate?: number | null;
  repeatCustomers?: number;
  visitorsInRange?: number;
  uniqueVisitorsInRange?: number;
  dau?: number;
  wau?: number;
  dailySeries?: Array<{
    day: string;
    revenue: number;
    orders: number;
    visitors?: number;
  }>;
  topSku?: Array<{
    productId: number | null;
    name: string;
    quantity: number;
    revenue?: number;
  }>;
  support?: {
    openTickets: number;
    pendingMerchant: number;
    resolvedInRange: number;
    openReturns: number;
  };
};

export type MerchantInsight = {
  code: string;
  severity: "info" | "success" | "warning";
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export type MerchantInsightsPayload = {
  rangeDays: number;
  insights: MerchantInsight[];
  generatedAt: string;
};

export type GrowthChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
  href?: string;
};

export type MerchantGrowthPayload = {
  score: number;
  maxScore: number;
  checklist: GrowthChecklistItem[];
  recommendations: string[];
};

export type GrowthMilestone = {
  id: string;
  label: string;
  done: boolean;
  achievedAt: string | null;
};

export type MerchantGrowthDashboard = {
  rangeDays: number;
  growth: MerchantGrowthPayload;
  insights: MerchantInsightsPayload;
  retention: {
    status: "active" | "at_risk" | "inactive";
    nudges: string[];
    daysSinceLastOrder: number | null;
    readinessScore: number;
  };
  milestones: GrowthMilestone[];
  optimizationTips: string[];
  referral: { signups: number; code: string | null };
  engagement: {
    ordersInRange: number;
    revenueInRange: number;
    conversionRate: number | null;
    uniqueVisitors: number;
  };
};

export type SupportSuggestion = {
  id: string;
  label: string;
  text: string;
};

export type MerchantNotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type MerchantNotificationsPayload = {
  unreadCount: number;
  items: MerchantNotificationItem[];
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
  async getMerchantSchemas(): Promise<{
    businessType: string;
    productSchema: Record<string, unknown>;
  }> {
    const userId = requireAdminUserId();
    const res = await api.get("/api/merchant/schemas", { params: { userId } });
    const data = res.data as unknown;
    const x =
      data != null && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    return {
      businessType: typeof x.businessType === "string" ? x.businessType : "",
      productSchema:
        x.productSchema != null &&
        typeof x.productSchema === "object" &&
        !Array.isArray(x.productSchema)
          ? (x.productSchema as Record<string, unknown>)
          : {},
    };
  },
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
        | "attributes"
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
    const res = await fetch(url, {
      method: "POST",
      headers: withTenantHeaders(undefined, url),
      body: form,
    });
    if (!res.ok) throw new Error(await readFetchError(res));
    const j = (await res.json()) as { url?: string; secure_url?: string };
    const out = j.url ?? j.secure_url;
    if (!out) throw new Error("Нет url в ответе");
    return out;
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
    const res = await fetch(url, {
      method: "POST",
      headers: withTenantHeaders(undefined, url),
      body: form,
    });
    if (!res.ok) throw new Error(await readFetchError(res));
    const j = (await res.json()) as { urls?: string[]; assets?: Array<{ url?: string }> };
    if (Array.isArray(j.urls)) return j.urls;
    if (Array.isArray(j.assets)) return j.assets.map((a) => String(a.url ?? "")).filter(Boolean);
    return [];
  },

  async updateOrderStatus(
    id: number,
    status:
      | "ACCEPTED"
      | "CONFIRMED"
      | "SHIPPED"
      | "DELIVERED"
      | "CANCELLED"
  ): Promise<unknown> {
    const userId = requireAdminUserId();
    const url = `${API_BASE_URL}/orders/${id}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: withTenantHeaders({ "Content-Type": "application/json" }, url),
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
      headers: withTenantHeaders({ "Content-Type": "application/json" }, url),
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
      headers: withTenantHeaders(
        { "Content-Type": "application/json" },
        url.toString(),
      ),
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
    const data = (await res.json().catch(() => ({}))) as { deleted?: unknown };
    return typeof data.deleted === "number" ? data.deleted : 0;
  },

  async getAnalytics(rangeDays: 7 | 30 | 90 = 30): Promise<AdminAnalytics> {
    const d = await adminPost<AdminAnalytics>("/analytics", { rangeDays });
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

  async getInsights(rangeDays: 7 | 30 | 90 = 30): Promise<MerchantInsightsPayload> {
    const d = await adminPost<MerchantInsightsPayload>(
      "/merchant/intelligence/insights",
      { rangeDays },
    );
    return {
      rangeDays: typeof d?.rangeDays === "number" ? d.rangeDays : rangeDays,
      insights: Array.isArray(d?.insights) ? d.insights : [],
      generatedAt: typeof d?.generatedAt === "string" ? d.generatedAt : "",
    };
  },

  async getGrowth(): Promise<MerchantGrowthPayload> {
    const d = await adminGet<MerchantGrowthPayload>("/merchant/intelligence/growth");
    return {
      score: typeof d?.score === "number" ? d.score : 0,
      maxScore: typeof d?.maxScore === "number" ? d.maxScore : 100,
      checklist: Array.isArray(d?.checklist) ? d.checklist : [],
      recommendations: Array.isArray(d?.recommendations) ? d.recommendations : [],
    };
  },

  async getGrowthDashboard(
    rangeDays: 7 | 30 | 90 = 30,
  ): Promise<MerchantGrowthDashboard> {
    const d = await adminPost<MerchantGrowthDashboard>("/merchant/growth/dashboard", {
      rangeDays,
    });
    return d;
  },

  async getSupportSuggestions(ticketId: number): Promise<SupportSuggestion[]> {
    const d = await adminGet<{ suggestions?: SupportSuggestion[] }>(
      `/merchant/support/tickets/${ticketId}/suggestions`,
    );
    return Array.isArray(d?.suggestions) ? d.suggestions : [];
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

  async getMembershipRows(
    businessId: number,
  ): Promise<AdminMembershipRow[]> {
    const userId = requireAdminUserId();
    const url = new URL(resolveAdminUrl("/api/memberships"));
    url.searchParams.set("userId", String(userId));
    url.searchParams.set("shop", String(businessId));
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: withTenantHeaders(undefined, url.toString(), { businessId }),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
    const data = (await res.json().catch(() => [])) as unknown;
    return Array.isArray(data) ? (data as AdminMembershipRow[]) : [];
  },

  async listSupportTickets(status?: string): Promise<unknown[]> {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    const data = await adminGet<unknown[]>(`/merchant/support/tickets${suffix}`);
    return Array.isArray(data) ? data : [];
  },

  async getSupportTicket(id: number): Promise<unknown> {
    return adminGet<unknown>(`/merchant/support/tickets/${id}`);
  },

  async patchSupportTicket(
    id: number,
    patch: { status?: string; internalNote?: string | null }
  ): Promise<unknown> {
    return adminPatch<unknown>(`/merchant/support/tickets/${id}`, patch as Record<string, unknown>);
  },

  async postSupportTicketMessage(id: number, text: string): Promise<unknown> {
    return adminPost<unknown>(`/merchant/support/tickets/${id}/messages`, {
      text,
    });
  },

  async listReturnRequests(status?: string): Promise<unknown[]> {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    const data = await adminGet<unknown[]>(`/merchant/support/returns${suffix}`);
    return Array.isArray(data) ? data : [];
  },

  async patchReturnRequest(
    id: number,
    patch: { status: string; refundAmount?: number | null }
  ): Promise<unknown> {
    return adminPatch<unknown>(`/merchant/support/returns/${id}`, patch as Record<string, unknown>);
  },

  async updateMembershipRole(input: {
    targetUserId: number;
    businessId: number;
    role: "ADMIN" | "CLIENT";
  }): Promise<void> {
    const telegramUserId = requireAdminUserId();
    const url = new URL(
      resolveAdminUrl("/api/memberships/update-role"),
    );
    url.searchParams.set("userId", String(telegramUserId));
    url.searchParams.set("shop", String(input.businessId));
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...withTenantHeaders(
          {
            "Content-Type": "application/json",
            "x-telegram-id": String(telegramUserId),
          },
          url.toString(),
          { businessId: input.businessId },
        ),
      },
      body: JSON.stringify({
        userId: input.targetUserId,
        businessId: input.businessId,
        role: input.role,
      }),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
  },

  async updateMembershipPermissions(input: {
    targetUserId: number;
    businessId: number;
    permissions: string[];
  }): Promise<void> {
    const telegramUserId = requireAdminUserId();
    const url = new URL(
      resolveAdminUrl("/api/memberships/update-permissions"),
    );
    url.searchParams.set("userId", String(telegramUserId));
    url.searchParams.set("shop", String(input.businessId));
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...withTenantHeaders(
          {
            "Content-Type": "application/json",
            "x-telegram-id": String(telegramUserId),
          },
          url.toString(),
          { businessId: input.businessId },
        ),
      },
      body: JSON.stringify({
        userId: input.targetUserId,
        businessId: input.businessId,
        permissions: input.permissions,
      }),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
  },

  async getNotifications(limit = 20): Promise<MerchantNotificationsPayload> {
    const telegramUserId = requireAdminUserId();
    const url = new URL(resolveAdminUrl("/merchant/notifications"));
    url.searchParams.set("userId", String(telegramUserId));
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString(), {
      headers: withTenantHeaders(
        { "x-telegram-id": String(telegramUserId) },
        url.toString(),
      ),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
    const data = (await res.json()) as MerchantNotificationsPayload;
    return {
      unreadCount: Number(data.unreadCount) || 0,
      items: Array.isArray(data.items) ? data.items : [],
    };
  },

  async markAllNotificationsRead(): Promise<void> {
    const telegramUserId = requireAdminUserId();
    const url = resolveAdminUrl("/merchant/notifications/read-all");
    const res = await fetch(url, {
      method: "POST",
      headers: withTenantHeaders(
        {
          "Content-Type": "application/json",
          "x-telegram-id": String(telegramUserId),
        },
        url,
      ),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
  },
};
