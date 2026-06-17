import { API_BASE_URL, apiAbsoluteUrl } from "./api";
import type { Category, Product, ProductStatus } from "../types";
import {
  adminFetch,
  adminFetchJson,
  adminFetchVoid,
} from "./adminRequest";

export type UploadAsset = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format?: string;
};

/** Относительный путь или уже полный `https://...` (не дублируем API_BASE_URL). */
function resolveAdminUrl(path: string): string {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${p}`;
}

export async function postConnectBot(
  botToken: string,
): Promise<{ ok: boolean; shopId: number; botUsername: string }> {
  return adminPost("/connect-bot", { botToken });
}

async function adminStaffFetch<T>(
  path: string,
  businessId: number,
  init: { method: "GET" | "POST"; body?: Record<string, unknown> },
): Promise<T> {
  const url = new URL(resolveAdminUrl(path));
  url.searchParams.set("shop", String(businessId));
  if (init.method === "GET") {
    return adminFetchJson<T>(url.toString(), {
      method: "GET",
      businessId,
      json: false,
    });
  }
  return adminFetchJson<T>(url.toString(), {
    method: "POST",
    businessId,
    body: JSON.stringify(init.body ?? {}),
  });
}

async function adminPost<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return adminFetchJson<T>(resolveAdminUrl(path), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function adminGet<T>(path: string): Promise<T> {
  return adminFetchJson<T>(resolveAdminUrl(path), {
    method: "GET",
    json: false,
  });
}

async function adminPatch<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  return adminFetchJson<T>(resolveAdminUrl(path), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function adminDelete(path: string): Promise<void> {
  await adminFetchVoid(resolveAdminUrl(path), { method: "DELETE" });
}

async function adminPut<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return adminFetchJson<T>(resolveAdminUrl(path), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export type AdminPaymentDetail = {
  id: number;
  type: string;
  value: string;
};

export type AdminStaffRow = {
  staffId: number;
  userId: number;
  role: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
  permissions?: string[];
};

export type StaffInvitePreview = {
  name: string;
  username: string;
  photoUrl: string | null;
  alreadyStaff: boolean;
  lookupStatus: "ready" | "already_staff" | "needs_bot_contact" | "bot_not_configured";
  canInviteNow: boolean;
  hasPendingInvite: boolean;
  botLink: string | null;
  userId: number | null;
};

export type StaffInviteResult =
  | { kind: "added"; staff: AdminStaffRow }
  | { kind: "pending"; message: string };

/** @deprecated Use AdminStaffRow */
export type AdminMembershipRow = AdminStaffRow;

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
  topCategories?: Array<{
    categoryId: number | null;
    name: string;
    quantity: number;
    revenue?: number;
  }>;
  periods?: {
    today: {
      orders: number;
      revenue: number;
      averageOrderValue: number;
      funnel: {
        created: number;
        paid: number;
        completed: number;
        cancelled: number;
        paidRate: number;
        completedRate: number;
        cancelledRate: number;
      };
    };
    week: {
      orders: number;
      revenue: number;
      averageOrderValue: number;
      funnel: {
        created: number;
        paid: number;
        completed: number;
        cancelled: number;
        paidRate: number;
        completedRate: number;
        cancelledRate: number;
      };
    };
    month: {
      orders: number;
      revenue: number;
      averageOrderValue: number;
      funnel: {
        created: number;
        paid: number;
        completed: number;
        cancelled: number;
        paidRate: number;
        completedRate: number;
        cancelledRate: number;
      };
    };
    lifetime: {
      orders: number;
      revenue: number;
      averageOrderValue: number;
      funnel: {
        created: number;
        paid: number;
        completed: number;
        cancelled: number;
        paidRate: number;
        completedRate: number;
        cancelledRate: number;
      };
    };
  };
  freeOrdersUsed?: number;
  freeOrdersRemaining?: number;
  subscriptionConversionRate?: number | null;
  customers?: {
    total: number;
    new: number;
    returning: number;
    repeatPurchaseRate: number;
    averageOrdersPerCustomer: number;
  };
  marketing?: {
    activePromotions: number;
    totalPromotions: number;
    activeCampaigns: number;
    totalCampaigns: number;
    promotionRedemptions: number;
    loyaltyEnabled: boolean;
    loyaltyMembers: number;
  };
  support?: {
    openTickets: number;
    pendingMerchant: number;
    resolvedInRange: number;
    openReturns: number;
  };
  operations?: {
    cancelledOrders: number;
    cancelledInRange: number;
    refundRequestsInRange: number;
    returnRequestsInRange: number;
    lowStockSkus: number;
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

export type CustomerSegment =
  | "best"
  | "high_value"
  | "frequent"
  | "returning"
  | "recent"
  | "inactive";

export type MerchantCustomerRow = {
  customerKey: string;
  buyerUserId: number | null;
  telegramId: string | null;
  username: string | null;
  name: string;
  phone: string | null;
  phoneNormalized: string | null;
  address: string | null;
  ordersCount: number;
  totalOrders: number;
  cancelledOrders: number;
  lifetimeValue: number;
  averageOrderValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  segments: CustomerSegment[];
};

export type MerchantCustomerListPayload = {
  total: number;
  returningCount: number;
  customers: MerchantCustomerRow[];
};

export type MerchantCustomerInsights = {
  best: MerchantCustomerRow[];
  highValue: MerchantCustomerRow[];
  frequent: MerchantCustomerRow[];
  recent: MerchantCustomerRow[];
  inactive: MerchantCustomerRow[];
};

export type MerchantCustomerDashboard = {
  rangeDays: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatPurchaseRate: number;
  averageOrdersPerCustomer: number;
  averageLifetimeValue: number;
  totalLifetimeValue: number;
  customerGrowth: Array<{ day: string; newCustomers: number }>;
  topCustomers: MerchantCustomerRow[];
  insights: MerchantCustomerInsights;
};

export type MerchantCustomerPreference = {
  key: string;
  label: string;
  value: string;
  valueLabel: string;
  count: number;
};

export type MerchantCustomerDetail = {
  customer: MerchantCustomerRow | null;
  orders: Array<{
    id: number;
    orderNumber: string | null;
    status: string;
    total: number;
    createdAt: string;
    summary: string;
  }>;
  favoriteProducts: Array<{ productId: number | null; name: string; quantity: number }>;
  favoriteCategories: Array<{ categoryId: number | null; name: string; quantity: number }>;
  recentAddresses: string[];
  preferences: MerchantCustomerPreference[];
};

export type MarketingPromotionType =
  | "PERCENT"
  | "FIXED"
  | "FREE_DELIVERY"
  | "GIFT"
  | "BUY_X_GET_Y"
  | "COUPON_PERCENT"
  | "AUTOMATIC_PERCENT";

export type MarketingPromotionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "ENDED";

export type MarketingPromotion = {
  id: number;
  businessId: number;
  type: MarketingPromotionType;
  title: string;
  code: string | null;
  percent: number | null;
  fixedAmountSom: number | null;
  minOrderSom: number;
  giftProductId: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  audienceSegment: CustomerSegment | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  maxRedemptions: number;
  redemptions: number;
  status: MarketingPromotionStatus;
};

export type MarketingCampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "ENDED";

export type MarketingCampaign = {
  id: number;
  businessId: number;
  title: string;
  promotionId: number | null;
  audienceSegment: CustomerSegment | null;
  startsAt: string | null;
  endsAt: string | null;
  budgetSom: number;
  paused: boolean;
  active: boolean;
  status: MarketingCampaignStatus;
};

export type MarketingDashboard = {
  rangeDays: number;
  activeCampaigns: number;
  totalCampaigns: number;
  activePromotions: number;
  totalPromotions: number;
  totalRedemptions: number;
  customerGrowth: Array<{ day: string; newCustomers: number }>;
  repeatCustomers: number;
  topPromotions: Array<{ id: number; title: string; type: MarketingPromotionType; redemptions: number }>;
  topSegments: Array<{ segment: CustomerSegment | "all"; customers: number }>;
  bestProducts: Array<{ productId: number | null; name: string; quantity: number }>;
  campaignRoi: Array<{ id: number; title: string; budgetSom: number; roi: number | null }>;
};

export type LoyaltyProgramRules = {
  enabled: boolean;
  pointsPerOrder: number;
  pointsPerSomSpent: number;
  redeemThreshold: number;
  redeemValueSom: number;
};

export type MerchantLoyaltyPayload = {
  program: LoyaltyProgramRules;
  enrolledCustomers: number;
  totalPointsIssued: number;
  topCustomers: Array<{
    customerKey: string;
    points: number;
    visits: number;
    orders: number;
    tier: "bronze" | "silver" | "gold" | "platinum";
  }>;
};

export type WebProfile = {
  coverUrl: string | null;
  slogan: string | null;
  story: string | null;
  accentColor: string | null;
  social: {
    instagram: string | null;
    telegram: string | null;
    whatsapp: string | null;
    website: string | null;
  };
};

export function emptyWebProfileClient(): WebProfile {
  return {
    coverUrl: null,
    slogan: null,
    story: null,
    accentColor: null,
    social: { instagram: null, telegram: null, whatsapp: null, website: null },
  };
}

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
    merchantConfig: Record<string, unknown>;
    templateDescriptor?: Record<string, unknown>;
  }> {
    const data = await adminGet<unknown>("/api/merchant/schemas");
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
      merchantConfig:
        x.merchantConfig != null &&
        typeof x.merchantConfig === "object" &&
        !Array.isArray(x.merchantConfig)
          ? (x.merchantConfig as Record<string, unknown>)
          : {},
      templateDescriptor:
        x.templateDescriptor != null &&
        typeof x.templateDescriptor === "object" &&
        !Array.isArray(x.templateDescriptor)
          ? (x.templateDescriptor as Record<string, unknown>)
          : undefined,
    };
  },
  async getProducts(query?: {
    q?: string;
    categoryId?: number;
    status?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<Product[]> {
    const params = new URLSearchParams();
    params.set("status", query?.status ?? "all");
    if (query?.q?.trim()) params.set("q", query.q.trim());
    if (query?.categoryId != null) params.set("categoryId", String(query.categoryId));
    if (query?.limit != null) params.set("limit", String(query.limit));
    if (query?.offset != null) params.set("offset", String(query.offset));
    if (query?.sort) params.set("sort", query.sort);
    const qs = params.toString();
    const data = await adminGet<Product[] | { items: Product[] }>(
      `/products${qs ? `?${qs}` : ""}`,
    );
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && Array.isArray((data as { items?: Product[] }).items)) {
      return (data as { items: Product[] }).items;
    }
    return [];
  },

  async getProductsPage(query: {
    q?: string;
    categoryId?: number;
    status?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<{ items: Product[]; total: number; limit: number; offset: number }> {
    const params = new URLSearchParams();
    params.set("status", query.status ?? "all");
    if (query.q?.trim()) params.set("q", query.q.trim());
    if (query.categoryId != null) params.set("categoryId", String(query.categoryId));
    params.set("limit", String(query.limit ?? 50));
    params.set("offset", String(query.offset ?? 0));
    if (query.sort) params.set("sort", query.sort);
    const data = await adminGet<
      Product[] | { items: Product[]; total: number; limit: number; offset: number }
    >(`/products?${params.toString()}`);
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: Number(data?.total ?? 0),
      limit: Number(data?.limit ?? 50),
      offset: Number(data?.offset ?? 0),
    };
  },

  async getProduct(id: number): Promise<Product> {
    return adminGet<Product>(`/products/${id}`);
  },

  async createProduct(data: Product): Promise<Product> {
    const images =
      data.images && data.images.length > 0
        ? data.images
        : data.image
          ? [data.image]
          : [];
    return adminPost<Product>("/products", {
      ...data,
      images,
      image: images[0] ?? data.image,
    } as unknown as Record<string, unknown>);
  },

  async deleteProduct(id: number): Promise<void> {
    await adminDelete(`/products/${id}`);
  },

  async archiveProduct(id: number): Promise<void> {
    await adminDelete(`/products/${id}`);
  },

  async restoreProduct(id: number): Promise<Product> {
    return adminPost<Product>(`/products/${id}/restore`, {});
  },

  async duplicateProduct(id: number): Promise<Product> {
    return adminPost<Product>(`/products/${id}/duplicate`, {});
  },

  async bulkUpdateProducts(input: {
    ids: number[];
    status?: ProductStatus;
    categoryId?: number;
  }): Promise<{ updated: number }> {
    return adminPatch<{ updated: number }>("/products/bulk", input);
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
        | "status"
        | "imagesMeta"
      >
    >
  ): Promise<Product> {
    return adminPut<Product>(`/products/${id}`, patch as Record<string, unknown>);
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
    qrPublicId?: string | null;
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

  async listPromos(businessId: number): Promise<AdminPromoRecord[]> {
    const url = new URL(resolveAdminUrl("/promo/list"));
    url.searchParams.set("shop", String(businessId));
    const data = await adminFetchJson<AdminPromoRecord[]>(url.toString(), {
      method: "POST",
      businessId,
      body: JSON.stringify({ businessId }),
    });
    return data ?? [];
  },

  async addPromo(
    businessId: number,
    code: string,
    discount: number,
    maxUses: number,
  ): Promise<AdminPromoRecord> {
    const url = new URL(resolveAdminUrl("/promo"));
    url.searchParams.set("shop", String(businessId));
    return adminFetchJson<AdminPromoRecord>(url.toString(), {
      method: "POST",
      businessId,
      body: JSON.stringify({
        businessId,
        code,
        discount,
        maxUses,
        limit: maxUses,
      }),
    });
  },

  async deletePromo(businessId: number, code: string): Promise<void> {
    const url = new URL(
      resolveAdminUrl(`/promo/${encodeURIComponent(code)}`),
    );
    url.searchParams.set("shop", String(businessId));
    await adminFetchVoid(url.toString(), {
      method: "DELETE",
      businessId,
    });
  },

  /** Список заказов из PostgreSQL (polling и после действий). */
  fetchOrders: fetchAdminOrders,

  listOrders: fetchAdminOrders,

  listAllOrders: fetchAdminOrders,

  async uploadImage(file: File): Promise<UploadAsset> {
    const form = new FormData();
    form.append("file", file);
    const url = `${API_BASE_URL}/upload`;
    const res = await adminFetch(url, {
      method: "POST",
      json: false,
      body: form,
    });
    const j = (await res.json()) as UploadAsset & { secure_url?: string };
    const outUrl = j.url ?? j.secure_url;
    if (!outUrl || !j.publicId) {
      throw new Error("Сервер не вернул метаданные файла");
    }
    return {
      url: outUrl,
      publicId: j.publicId,
      width: j.width ?? 0,
      height: j.height ?? 0,
      ...(j.format ? { format: j.format } : {}),
    };
  },

  async uploadImageUrl(file: File): Promise<string> {
    const asset = await adminService.uploadImage(file);
    return asset.url;
  },

  async uploadImages(files: File[]): Promise<UploadAsset[]> {
    if (files.length === 0) return [];
    const form = new FormData();
    for (const f of files) {
      form.append("files", f);
    }
    const url = `${API_BASE_URL}/products/upload-images`;
    const res = await adminFetch(url, {
      method: "POST",
      json: false,
      body: form,
    });
    const j = (await res.json()) as {
      urls?: string[];
      assets?: UploadAsset[];
    };
    if (Array.isArray(j.assets)) {
      return j.assets
        .map((a) => ({
          url: String(a.url ?? ""),
          publicId: String(a.publicId ?? ""),
          width: Number(a.width ?? 0) || 0,
          height: Number(a.height ?? 0) || 0,
          ...(a.format ? { format: a.format } : {}),
        }))
        .filter((a) => a.url && a.publicId);
    }
    if (Array.isArray(j.urls)) {
      return j.urls.map((u) => ({
        url: u,
        publicId: "",
        width: 0,
        height: 0,
      }));
    }
    return [];
  },

  async uploadImageUrls(files: File[]): Promise<string[]> {
    const assets = await adminService.uploadImages(files);
    return assets.map((a) => a.url);
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
    const url = `${API_BASE_URL}/orders/${id}`;
    const res = await adminFetch(url, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  },

  /** Запросить статус Finik у провайдера (не ручное подтверждение). */
  async syncFinikPayment(id: number): Promise<{
    paymentState: "paid" | "pending" | "failed";
    duplicate?: boolean;
    order?: unknown;
  }> {
    const url = `${API_BASE_URL}/orders/${id}/sync-finik-payment`;
    const j = await adminFetchJson<{
      paymentState?: unknown;
      duplicate?: unknown;
      order?: unknown;
    }>(url, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const ps = j.paymentState;
    if (ps !== "paid" && ps !== "pending" && ps !== "failed") {
      throw new Error("Некорректный ответ проверки оплаты");
    }
    return {
      paymentState: ps,
      duplicate: j.duplicate === true,
      order: j.order,
    };
  },

  /** Статус доставки / комментарий (только tracking, без смены status). */
  async updateOrderTracking(id: number, tracking: string): Promise<unknown> {
    const url = `${API_BASE_URL}/orders/${id}`;
    const res = await adminFetch(url, {
      method: "PUT",
      body: JSON.stringify({ tracking }),
    });
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  },

  async clearOrders(type: "completed" | "rejected" | "all"): Promise<number> {
    const url = new URL(`${API_BASE_URL}/orders/clear`);
    url.searchParams.set("type", type);
    const data = await adminFetchJson<{ deleted?: unknown }>(url.toString(), {
      method: "DELETE",
    });
    return typeof data?.deleted === "number" ? data.deleted : 0;
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

  async getCustomers(input?: {
    search?: string;
    segment?: CustomerSegment | null;
    limit?: number;
    offset?: number;
  }): Promise<MerchantCustomerListPayload> {
    const d = await adminPost<MerchantCustomerListPayload>("/merchant/customers", {
      search: input?.search ?? "",
      segment: input?.segment ?? null,
      limit: input?.limit ?? 50,
      offset: input?.offset ?? 0,
    });
    return {
      total: typeof d?.total === "number" ? d.total : 0,
      returningCount: typeof d?.returningCount === "number" ? d.returningCount : 0,
      customers: Array.isArray(d?.customers) ? d.customers : [],
    };
  },

  async getCustomerDashboard(
    rangeDays: 7 | 30 | 90 = 30,
  ): Promise<MerchantCustomerDashboard> {
    return adminPost<MerchantCustomerDashboard>("/merchant/customers/dashboard", {
      rangeDays,
    });
  },

  async getCustomerDetail(customerKey: string): Promise<MerchantCustomerDetail> {
    return adminPost<MerchantCustomerDetail>("/merchant/customers/detail", {
      customerKey,
    });
  },

  async listMarketingPromotions(): Promise<MarketingPromotion[]> {
    const d = await adminGet<{ promotions?: MarketingPromotion[] }>(
      "/merchant/marketing/promotions",
    );
    return Array.isArray(d?.promotions) ? d.promotions : [];
  },

  async createMarketingPromotion(
    input: Partial<MarketingPromotion>,
  ): Promise<MarketingPromotion> {
    return adminPost<MarketingPromotion>(
      "/merchant/marketing/promotions",
      input as Record<string, unknown>,
    );
  },

  async setMarketingPromotionActive(id: number, active: boolean): Promise<void> {
    await adminPost(`/merchant/marketing/promotions/${id}/active`, { active });
  },

  async deleteMarketingPromotion(id: number): Promise<void> {
    await adminDelete(`/merchant/marketing/promotions/${id}`);
  },

  async listMarketingCampaigns(): Promise<MarketingCampaign[]> {
    const d = await adminGet<{ campaigns?: MarketingCampaign[] }>(
      "/merchant/marketing/campaigns",
    );
    return Array.isArray(d?.campaigns) ? d.campaigns : [];
  },

  async createMarketingCampaign(
    input: Partial<MarketingCampaign>,
  ): Promise<MarketingCampaign> {
    return adminPost<MarketingCampaign>(
      "/merchant/marketing/campaigns",
      input as Record<string, unknown>,
    );
  },

  async setMarketingCampaignState(
    id: number,
    state: { active?: boolean; paused?: boolean },
  ): Promise<void> {
    await adminPost(`/merchant/marketing/campaigns/${id}/state`, state);
  },

  async deleteMarketingCampaign(id: number): Promise<void> {
    await adminDelete(`/merchant/marketing/campaigns/${id}`);
  },

  async getMarketingDashboard(
    rangeDays: 7 | 30 | 90 = 30,
  ): Promise<MarketingDashboard> {
    return adminPost<MarketingDashboard>("/merchant/marketing/dashboard", {
      rangeDays,
    });
  },

  async getLoyalty(): Promise<MerchantLoyaltyPayload> {
    return adminGet<MerchantLoyaltyPayload>("/merchant/loyalty");
  },

  async getWebProfile(): Promise<WebProfile> {
    const d = await adminGet<{ profile?: WebProfile }>("/api/merchant/web-profile");
    return d?.profile ?? emptyWebProfileClient();
  },

  async saveWebProfile(profile: WebProfile): Promise<WebProfile> {
    const d = await adminPost<{ profile?: WebProfile }>(
      "/api/merchant/web-profile",
      profile as unknown as Record<string, unknown>,
    );
    return d?.profile ?? profile;
  },

  async checkSlugAvailability(slug: string): Promise<{
    ok: boolean;
    slug: string | null;
    reason: string;
  }> {
    const url = new URL(resolveAdminUrl("/api/merchant/slug/availability"));
    url.searchParams.set("slug", slug);
    return adminFetchJson(url.toString(), { method: "GET", json: false });
  },

  async changeSlug(slug: string): Promise<{ slug: string; previousSlug: string | null }> {
    return adminPost<{ slug: string; previousSlug: string | null }>("/api/merchant/slug", {
      slug,
    });
  },

  async saveLoyalty(
    rules: Partial<LoyaltyProgramRules>,
  ): Promise<{ program: LoyaltyProgramRules }> {
    return adminPost<{ program: LoyaltyProgramRules }>(
      "/merchant/loyalty",
      rules as Record<string, unknown>,
    );
  },

  async getSupportSuggestions(ticketId: number): Promise<SupportSuggestion[]> {
    const d = await adminGet<{ suggestions?: SupportSuggestion[] }>(
      `/merchant/support/tickets/${ticketId}/suggestions`,
    );
    return Array.isArray(d?.suggestions) ? d.suggestions : [];
  },

  async getCategories(): Promise<Category[]> {
    const data = await adminGet<Category[]>(apiAbsoluteUrl("/categories"));
    return Array.isArray(data) ? data : [];
  },

  async createCategory(input: CategoryCreateInput): Promise<Category> {
    return adminPost<Category>(apiAbsoluteUrl("/categories"), {
      name: input.name,
      parentId: input.parentId ?? null,
    });
  },

  async restoreDefaultCategories(): Promise<{ created: number; skipped: number }> {
    return adminPost<{ created: number; skipped: number }>(
      apiAbsoluteUrl("/categories/restore-defaults"),
      {},
    );
  },

  async deleteCategory(id: number): Promise<void> {
    await adminDelete(apiAbsoluteUrl(`/categories/${id}`));
  },

  async updateCategory(
    id: number,
    patch: { name?: string; parentId?: number | null; sortOrder?: number },
  ): Promise<Category> {
    return adminPatch<Category>(apiAbsoluteUrl(`/categories/${id}`), patch);
  },

  async reorderCategories(
    updates: Array<{ id: number; sortOrder: number; parentId?: number | null }>,
  ): Promise<{ updated: number }> {
    return adminPatch<{ updated: number }>(apiAbsoluteUrl("/categories/reorder"), {
      updates,
    });
  },

  async getStaffRows(businessId: number): Promise<AdminStaffRow[]> {
    const data = await adminStaffFetch<unknown>("/api/staff", businessId, {
      method: "GET",
    });
    return Array.isArray(data) ? (data as AdminStaffRow[]) : [];
  },

  async getMembershipRows(
    businessId: number,
  ): Promise<AdminStaffRow[]> {
    return this.getStaffRows(businessId);
  },

  async previewStaffInvite(input: {
    businessId: number;
    username: string;
  }): Promise<StaffInvitePreview> {
    return adminStaffFetch<StaffInvitePreview>("/api/staff/preview", input.businessId, {
      method: "POST",
      body: { username: input.username },
    });
  },

  async createPendingStaffInvite(input: {
    businessId: number;
    username: string;
    role: "ADMIN" | "MANAGER" | "SUPPORT";
  }): Promise<{ pending: true; message: string }> {
    return adminStaffFetch("/api/staff/pending-invite", input.businessId, {
      method: "POST",
      body: { username: input.username, role: input.role },
    });
  },

  async inviteStaffMember(input: {
    businessId: number;
    username: string;
    role: "ADMIN" | "MANAGER" | "SUPPORT";
  }): Promise<StaffInviteResult> {
    const url = new URL(resolveAdminUrl("/api/staff/invite"));
    url.searchParams.set("shop", String(input.businessId));
    const res = await adminFetch(url.toString(), {
      method: "POST",
      businessId: input.businessId,
      body: JSON.stringify({ username: input.username, role: input.role }),
    });
    const text = await res.text();
    const data = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (res.status === 202 || data.pending === true) {
      const message =
        typeof data.message === "string" && data.message.trim() !== ""
          ? data.message
          : "Приглашение сохранено. Сотрудник получит доступ после /start в боте.";
      return { kind: "pending", message };
    }
    return { kind: "added", staff: data as AdminStaffRow };
  },

  async updateStaffRole(input: {
    targetUserId: number;
    businessId: number;
    role: "ADMIN" | "MANAGER" | "SUPPORT";
  }): Promise<void> {
    await adminStaffFetch("/api/staff/update-role", input.businessId, {
      method: "POST",
      body: { userId: input.targetUserId, role: input.role },
    });
  },

  async updateStaffPermissions(input: {
    targetUserId: number;
    businessId: number;
    permissions: string[];
  }): Promise<void> {
    await adminStaffFetch("/api/staff/update-permissions", input.businessId, {
      method: "POST",
      body: {
        userId: input.targetUserId,
        permissions: input.permissions,
      },
    });
  },

  async removeStaffMember(input: {
    targetUserId: number;
    businessId: number;
  }): Promise<void> {
    await adminStaffFetch("/api/staff/remove", input.businessId, {
      method: "POST",
      body: { userId: input.targetUserId },
    });
  },

  async updateMembershipRole(input: {
    targetUserId: number;
    businessId: number;
    role: "ADMIN" | "CLIENT";
  }): Promise<void> {
    if (input.role === "CLIENT") {
      await this.removeStaffMember({
        targetUserId: input.targetUserId,
        businessId: input.businessId,
      });
      return;
    }
    await this.updateStaffRole({
      targetUserId: input.targetUserId,
      businessId: input.businessId,
      role: input.role,
    });
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

  async listCancelRequests(): Promise<unknown[]> {
    const data = await adminGet<unknown[]>("/merchant/support/cancel-requests");
    return Array.isArray(data) ? data : [];
  },

  async patchCancelRequest(
    id: number,
    patch: { status: string; merchantComment?: string | null }
  ): Promise<unknown> {
    return adminPatch<unknown>(
      `/merchant/support/cancel-requests/${id}`,
      patch as Record<string, unknown>
    );
  },

  async listRefundRequests(): Promise<unknown[]> {
    const data = await adminGet<unknown[]>("/merchant/support/refund-requests");
    return Array.isArray(data) ? data : [];
  },

  async patchRefundRequest(
    id: number,
    patch: {
      status: string;
      merchantComment?: string | null;
      refundAmount?: number | null;
      refundMethod?: "MANUAL" | "FINIK" | "AUTO";
    }
  ): Promise<unknown> {
    return adminPatch<unknown>(
      `/merchant/support/refund-requests/${id}`,
      patch as Record<string, unknown>
    );
  },

  async createRefundRequest(body: {
    orderId: number;
    reason?: string;
    comment?: string;
    merchantComment?: string;
  }): Promise<unknown> {
    return adminPost<unknown>("/merchant/support/refund-requests", body);
  },

  async listRefundAuditLogs(refundId: number): Promise<unknown[]> {
    const data = await adminGet<unknown[]>(
      `/merchant/support/refund-requests/${refundId}/audit`
    );
    return Array.isArray(data) ? data : [];
  },

  async getMerchantWorkload(): Promise<{
    unreadNotifications: number;
    pendingSupport: number;
    pendingCancelRequests: number;
    pendingRefundRequests: number;
    pendingReturnRequests: number;
    ordersAwaitingAction: number;
    priorityScore: number;
  }> {
    return adminPost("/merchant/workload", {});
  },

  async updateMembershipPermissions(input: {
    targetUserId: number;
    businessId: number;
    permissions: string[];
  }): Promise<void> {
    return this.updateStaffPermissions(input);
  },

  async getNotifications(limit = 20): Promise<MerchantNotificationsPayload> {
    const url = new URL(resolveAdminUrl("/merchant/notifications"));
    url.searchParams.set("limit", String(limit));
    const data = await adminFetchJson<MerchantNotificationsPayload>(url.toString(), {
      method: "GET",
      json: false,
    });
    return {
      unreadCount: Number(data.unreadCount) || 0,
      items: Array.isArray(data.items) ? data.items : [],
    };
  },

  async markAllNotificationsRead(): Promise<void> {
    const url = resolveAdminUrl("/merchant/notifications/read-all");
    await adminFetchVoid(url, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
