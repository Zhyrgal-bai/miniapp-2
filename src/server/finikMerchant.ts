import type { Express, Request, Response } from "express";
import { webhooksLimiter } from "../middleware/apiRateLimits.js";
import { prisma } from "./db.js";
import { verifiedTelegramIdFromRequest } from "../middleware/verifiedTelegramAuth.js";
import { notifyAfterOrderStatusChangeFromApi } from "./orderTelegramNotify.js";
import { logWebhookReject, logPaymentFailure, logWebhookProcessed, logCommerceEvent } from "./structuredLog.js";
import {
  verifyFinikWebhookSignature,
  isFinikWebhookReplay,
} from "./finikWebhookCrypto.js";
import { correlationIdFromRequest } from "../middleware/correlationId.js";
import { logFinikOrderPaymentSync } from "./finik/finikCreateLogging.js";
import {
  buildFinikWebhookUrl,
  finikHasAccountId,
  finikHasApiKey,
  finikHasSecret,
  finikUseMockForBusiness,
  isFinikCredentialsReady,
  isFinikLegacyHttpReady,
  isMerchantFinikPlatformManaged,
} from "../shared/finikReady.js";
import {
  isPlatformFinikOfficialReady,
  platformFinikUseMockForCreate,
  PLATFORM_FINIK_OFFICIAL_UNAVAILABLE_ERROR,
} from "../shared/platformFinik.js";
import { buildPlatformSubscriptionFinikCreateContext } from "./finik/buildPlatformSubscriptionFinikCreateContext.js";
import { mockCreateAdapter } from "./finik/mockCreateAdapter.js";
import { officialAcquiringCreateAdapter } from "./finik/officialAcquiringCreateAdapter.js";
import {
  extractFinikWebhookPaymentIds,
  parseFinikWebhookPayload,
} from "./finik/finikWebhookPayload.js";
import { verifyFinikWebhookAdmission } from "./finik/finikWebhookVerify.js";
import { fetchFinikPaymentStatusRouted } from "./finik/finikStatusRouter.js";
import {
  effectiveMerchantPermissions,
  merchantHasPermission,
  MERCHANT_PERM,
} from "./merchantPermissions.js";

async function merchantStaffHasFinikSettingsAccess(
  businessId: number,
  telegramStr: string,
): Promise<boolean> {
  const staff = await prisma.businessStaff.findFirst({
    where: { businessId, user: { telegramId: telegramStr } },
    select: { role: true, permissions: true },
  });
  if (!staff) return false;
  const perms = effectiveMerchantPermissions(staff.role, staff.permissions ?? []);
  return merchantHasPermission(perms, MERCHANT_PERM.settingsManage);
}

/** Base URL для REST Finik (укажите реальный домен вашего аккаунта разработчика). */
function finikApiBase(): string {
  return (process.env.FINIK_API_BASE_URL || "https://api.finik.kg").trim().replace(
    /\/$/,
    ""
  );
}

/** Путь создания платежа относительно base (можно переопределить через env). */
function finikCreatePaymentsPath(): string {
  const p = (
    process.env.FINIK_API_CREATE_PAYMENT_PATH || "/payments"
  ).trim();
  return p.startsWith("/") ? p : `/${p}`;
}

/** Публичный URL API без хвоста slash — для webhook. */
export function publicApiOrigin(): string {
  const manual = (process.env.API_URL ?? "").trim();
  if (manual) return manual.replace(/\/$/, "");
  /** Render.com задаёт автоматически, если не задан API_URL. */
  const render = (process.env.RENDER_EXTERNAL_URL ?? "").trim();
  return render ? render.replace(/\/$/, "") : "";
}

/**
 * Создание платежа через Finik аккаунт клиента:
 * ключи только из строки Business, не платформы.
 *
 * Если `FINIK_USE_MOCK=true` или у бизнеса нет ключей — возвращает мок (только dev).
 */
export async function createFinikMerchantSession(
  business: {
    id: number;
    finikApiKey: string | null;
    finikAccountId: string | null;
    finikSecret: string | null;
  },
  input: { orderId: number; amount: number; currency?: string }
): Promise<
  | { ok: true; paymentId: string; paymentUrl: string }
  | { ok: false; error: string }
> {
  const useMock = finikUseMockForBusiness(business);

  if (useMock) {
    const paymentId = `finik_${Date.now()}_${input.orderId}`;
    const paymentUrl = `https://pay.finik.kg/?amount=${input.amount}&orderId=${encodeURIComponent(paymentId)}`;
    return { ok: true, paymentId, paymentUrl };
  }

  const origin = publicApiOrigin();
  if (!origin) {
    return {
      ok: false,
      error: "Сервер: задайте API_URL (публичный URL) для callback Finik",
    };
  }

  const callbackUrl = `${origin}/finik/webhook/${business.id}`;

  const url = `${finikApiBase()}${finikCreatePaymentsPath()}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${business.finikApiKey!.trim()}`,
        "X-Api-Secret": business.finikSecret!.trim(),
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency ?? "KGS",
        order_id: String(input.orderId),
        external_id: `${business.id}:${input.orderId}`,
        callback_url: callbackUrl,
        return_url: callbackUrl,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("Finik create payment HTTP", res.status, json);
      return {
        ok: false,
        error: "Finik API отклонил запрос (проверьте ключи и URL API)",
      };
    }

    const paymentId =
      (typeof json.payment_id === "string" && json.payment_id) ||
      (typeof json.id === "string" && json.id) ||
      (typeof json.paymentId === "string" && json.paymentId) ||
      "";
    const paymentUrl =
      (typeof json.payment_url === "string" && json.payment_url) ||
      (typeof json.url === "string" && json.url) ||
      (typeof json.checkout_url === "string" && json.checkout_url) ||
      "";

    if (!paymentId || !paymentUrl) {
      console.error("Finik create payment: unexpected body", json);
      return {
        ok: false,
        error: "Finik: неверный ответ API (ожидаются payment id и url)",
      };
    }

    return { ok: true, paymentId, paymentUrl };
  } catch (e) {
    console.error("Finik create payment fetch:", e);
    return { ok: false, error: "Ошибка сети при обращении к Finik" };
  }
}

/**
 * Платёж за SaaS-подписку: callback `POST /api/payments/finik-webhook` (не заказ витрины).
 */
export async function createFinikSaasSubscriptionSession(
  business: {
    id: number;
    finikApiKey: string | null;
    finikAccountId: string | null;
    finikSecret: string | null;
  },
  input: {
    /** ID строки `SubscriptionFinikPayment` */
    subscriptionPaymentRowId: number;
    amountSom: number;
    currency?: string;
  },
): Promise<
  | { ok: true; paymentId: string; paymentUrl: string }
  | { ok: false; error: string }
> {
  const useMock = finikUseMockForBusiness(business);

  if (useMock) {
    const paymentId = `finik_sub_${Date.now()}_${input.subscriptionPaymentRowId}`;
    const paymentUrl = `https://pay.finik.kg/?amount=${input.amountSom}&orderId=${encodeURIComponent(paymentId)}`;
    return { ok: true, paymentId, paymentUrl };
  }

  const origin = publicApiOrigin();
  if (!origin) {
    return {
      ok: false,
      error: "Сервер: задайте API_URL (публичный URL) для callback Finik",
    };
  }

  const callbackUrl = `${origin}/api/payments/finik-webhook`;
  const ext = `saas_sub:${input.subscriptionPaymentRowId}`;

  const url = `${finikApiBase()}${finikCreatePaymentsPath()}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${business.finikApiKey!.trim()}`,
        "X-Api-Secret": business.finikSecret!.trim(),
      },
      body: JSON.stringify({
        amount: input.amountSom,
        currency: input.currency ?? "KGS",
        order_id: ext,
        external_id: ext,
        callback_url: callbackUrl,
        return_url: callbackUrl,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("Finik subscription payment HTTP", res.status, json);
      return {
        ok: false,
        error: "Finik API отклонил запрос (проверьте ключи и URL API)",
      };
    }

    const paymentId =
      (typeof json.payment_id === "string" && json.payment_id) ||
      (typeof json.id === "string" && json.id) ||
      (typeof json.paymentId === "string" && json.paymentId) ||
      "";
    const paymentUrl =
      (typeof json.payment_url === "string" && json.payment_url) ||
      (typeof json.url === "string" && json.url) ||
      (typeof json.checkout_url === "string" && json.checkout_url) ||
      "";

    if (!paymentId || !paymentUrl) {
      console.error("Finik subscription payment: unexpected body", json);
      return {
        ok: false,
        error: "Finik: неверный ответ API (ожидаются payment id и url)",
      };
    }

    return { ok: true, paymentId, paymentUrl };
  } catch (e) {
    console.error("Finik subscription payment fetch:", e);
    return { ok: false, error: "Ошибка сети при обращении к Finik" };
  }
}

/**
 * Платёж за SaaS-подписку через Finik **платформы** (Official Acquiring RSA).
 * Webhook: `POST /api/platform/subscription-finik-webhook`.
 */
export async function createFinikPlatformSubscriptionSession(input: {
  subscriptionPaymentRowId: number;
  amountSom: number;
  currency?: string;
}): Promise<
  | { ok: true; paymentId: string; paymentUrl: string }
  | { ok: false; error: string }
> {
  const built = buildPlatformSubscriptionFinikCreateContext({
    subscriptionPaymentRowId: input.subscriptionPaymentRowId,
    amountSom: input.amountSom,
    ...(input.currency != null ? { currency: input.currency } : {}),
  });
  if (!built.ok) {
    return { ok: false, error: built.error };
  }

  const useMock = platformFinikUseMockForCreate();
  const result = useMock
    ? await mockCreateAdapter.createPaymentSession(built.ctx)
    : !isPlatformFinikOfficialReady()
      ? {
          ok: false as const,
          error: PLATFORM_FINIK_OFFICIAL_UNAVAILABLE_ERROR,
        }
      : await officialAcquiringCreateAdapter.createPaymentSession(built.ctx);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    paymentId: result.paymentId,
    paymentUrl: result.paymentUrl,
  };
}

/** Reservation deposit payment (Phase 6E). */
export async function createFinikReservationDepositSession(
  business: {
    id: number;
    finikApiKey: string | null;
    finikAccountId: string | null;
    finikSecret: string | null;
  },
  input: { reservationId: number; amountSom: number; currency?: string },
): Promise<
  | { ok: true; paymentId: string; paymentUrl: string }
  | { ok: false; error: string }
> {
  const { reservationDepositExternalId } = await import(
    "../shared/reservationDeposit.js"
  );
  const ext = reservationDepositExternalId(input.reservationId);

  const useMock = finikUseMockForBusiness(business);

  if (useMock) {
    const paymentId = `finik_dep_${Date.now()}_${input.reservationId}`;
    const paymentUrl = `https://pay.finik.kg/?amount=${input.amountSom}&orderId=${encodeURIComponent(paymentId)}`;
    return { ok: true, paymentId, paymentUrl };
  }

  const origin = publicApiOrigin();
  if (!origin) {
    return {
      ok: false,
      error: "Сервер: задайте API_URL (публичный URL) для callback Finik",
    };
  }

  const callbackUrl = `${origin}/finik/webhook/${business.id}`;
  const url = `${finikApiBase()}${finikCreatePaymentsPath()}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${business.finikApiKey!.trim()}`,
        "X-Api-Secret": business.finikSecret!.trim(),
      },
      body: JSON.stringify({
        amount: input.amountSom,
        currency: input.currency ?? "KGS",
        order_id: ext,
        external_id: ext,
        callback_url: callbackUrl,
        return_url: callbackUrl,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("Finik deposit payment HTTP", res.status, json);
      return {
        ok: false,
        error: "Finik API отклонил запрос (проверьте ключи и URL API)",
      };
    }

    const paymentId =
      (typeof json.payment_id === "string" && json.payment_id) ||
      (typeof json.id === "string" && json.id) ||
      (typeof json.paymentId === "string" && json.paymentId) ||
      "";
    const paymentUrl =
      (typeof json.payment_url === "string" && json.payment_url) ||
      (typeof json.url === "string" && json.url) ||
      (typeof json.checkout_url === "string" && json.checkout_url) ||
      "";

    if (!paymentId || !paymentUrl) {
      console.error("Finik deposit payment: unexpected body", json);
      return {
        ok: false,
        error: "Finik: неверный ответ API (ожидаются payment id и url)",
      };
    }

    return { ok: true, paymentId, paymentUrl };
  } catch (e) {
    console.error("Finik deposit payment fetch:", e);
    return { ok: false, error: "Ошибка сети при обращении к Finik" };
  }
}

function finikUseMock(business: {
  finikApiKey: string | null;
  finikAccountId: string | null;
  finikSecret: string | null;
}): boolean {
  return finikUseMockForBusiness(business);
}

const FINIK_SUCCESS_STATUSES = new Set([
  "success",
  "paid",
  "completed",
  "succeeded",
]);

const FINIK_FAILED_STATUSES = new Set([
  "failed",
  "cancelled",
  "canceled",
  "declined",
  "expired",
  "error",
]);

export { parseFinikWebhookPayload } from "./finik/finikWebhookPayload.js";

type FinikOrderRow = {
  id: number;
  businessId: number;
  total: number;
  status: string;
  paymentId: string | null;
  paymentMethod: string | null;
  reservationId: number | null;
  buyerUser: { telegramId: string } | null;
};

function mapPrismaOrderToFinikRow(order: {
  id: number;
  businessId: number;
  total: number;
  status: string;
  paymentId: string | null;
  paymentMethod: string | null;
  reservationId: number | null;
  buyerUser: { telegramId: string } | null;
}): FinikOrderRow {
  return {
    id: order.id,
    businessId: order.businessId,
    total: order.total,
    status: order.status,
    paymentId: order.paymentId,
    paymentMethod: order.paymentMethod,
    reservationId: order.reservationId,
    buyerUser: order.buyerUser,
  };
}

async function findOrderByFinikPaymentCandidates(
  businessId: number,
  paymentIdCandidates: readonly string[],
): Promise<FinikOrderRow | null> {
  for (const paymentId of paymentIdCandidates) {
    const order = await prisma.order.findFirst({
      where: { paymentId, businessId },
      include: { buyerUser: true },
    });
    if (order) return mapPrismaOrderToFinikRow(order);
  }
  return null;
}

async function findOrderByFinikExternalId(
  businessId: number,
  externalId: string | null,
): Promise<FinikOrderRow | null> {
  if (externalId == null || externalId.trim() === "") return null;
  const match = /^(\d+):(\d+)$/.exec(externalId.trim());
  if (!match) return null;
  const bid = Number(match[1]);
  const orderId = Number(match[2]);
  if (!Number.isInteger(bid) || bid !== businessId || !Number.isInteger(orderId) || orderId <= 0) {
    return null;
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { buyerUser: true },
  });
  if (!order || !isFinikOrderPaymentMethod(order.paymentMethod)) return null;
  return mapPrismaOrderToFinikRow(order);
}

async function findOrderByFinikAmountFallback(
  businessId: number,
  amount: number | null,
): Promise<FinikOrderRow | null> {
  if (amount == null || !Number.isFinite(amount)) return null;
  const total = Math.round(amount);
  const orders = await prisma.order.findMany({
    where: {
      businessId,
      paymentMethod: "finik",
      status: "NEW",
      total,
    },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { buyerUser: true },
  });
  if (orders.length !== 1) return null;
  return mapPrismaOrderToFinikRow(orders[0]!);
}

async function resolveFinikWebhookOrder(
  businessId: number,
  parsed: ReturnType<typeof parseFinikWebhookPayload>,
): Promise<FinikOrderRow | null> {
  const byPayment = await findOrderByFinikPaymentCandidates(
    businessId,
    parsed.paymentIdCandidates,
  );
  if (byPayment) return byPayment;
  const byExternal = await findOrderByFinikExternalId(businessId, parsed.externalId);
  if (byExternal) return byExternal;
  return findOrderByFinikAmountFallback(businessId, parsed.amount);
}

export function isFinikOrderPaymentMethod(
  paymentMethod: string | null | undefined
): boolean {
  return String(paymentMethod ?? "").trim().toLowerCase() === "finik";
}

/** Merchant must not manually mark Finik orders as paid — webhook/sync only. */
export function blocksManualFinikPaymentConfirm(input: {
  paymentMethod: string | null | undefined;
  targetStatus: string;
}): boolean {
  return (
    isFinikOrderPaymentMethod(input.paymentMethod) &&
    String(input.targetStatus).trim().toUpperCase() === "CONFIRMED"
  );
}

const FINIK_PAID_ORDER_STATUSES = new Set([
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
]);

async function applyFinikPaymentSuccess(
  order: FinikOrderRow,
  opts?: { expectedAmount?: number | null; finikTransactionId?: string | null },
): Promise<
  | { ok: true; duplicate: boolean; order: FinikOrderRow }
  | { ok: false; error: string; statusCode: number }
> {
  if (!isFinikOrderPaymentMethod(order.paymentMethod)) {
    return { ok: false, statusCode: 400, error: "Not a Finik order" };
  }

  if (
    opts?.expectedAmount != null &&
    Number.isFinite(opts.expectedAmount) &&
    Math.round(opts.expectedAmount) !== order.total
  ) {
    return { ok: false, statusCode: 400, error: "Amount mismatch" };
  }

  const cur = String(order.status ?? "").toUpperCase();
  if (FINIK_PAID_ORDER_STATUSES.has(cur)) {
    return { ok: true, duplicate: true, order };
  }
  if (cur === "CANCELLED") {
    return { ok: false, statusCode: 400, error: "Order cancelled" };
  }

  const finikTx = opts?.finikTransactionId?.trim() ?? "";
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CONFIRMED",
      ...(finikTx !== "" && finikTx !== (order.paymentId?.trim() ?? "")
        ? { paymentId: finikTx }
        : {}),
    },
    include: { buyerUser: true },
  });

  const { onOrderPaidConfirmed } = await import("./orderInventoryHooks.js");
  await onOrderPaidConfirmed(order.id, cur as import("./orderStatus.js").OrderStatus);

  if (!FINIK_PAID_ORDER_STATUSES.has(cur)) {
    const { consumePromoForPaidOrder } = await import("./promoRepo.js");
    const { invalidateStorefrontCache } = await import("./storefrontCache.js");
    try {
      await consumePromoForPaidOrder(prisma, order.id);
      invalidateStorefrontCache(order.businessId);
    } catch (e) {
      console.error("[finik] consumePromoForPaidOrder:", e);
    }
    const { notifyMerchantOnNewPaidOrder } = await import(
      "./orderTelegramNotify.js"
    );
    void notifyMerchantOnNewPaidOrder(order.id);
  }

  if (order.reservationId != null) {
    const { scheduleReservationPreorderAfterPayment } = await import(
      "./reservationPreorderKitchenScheduler.js"
    );
    await scheduleReservationPreorderAfterPayment(order.id);
  } else {
    void notifyAfterOrderStatusChangeFromApi({
      id: updated.id,
      orderNumber: updated.orderNumber,
      businessId: updated.businessId,
      status: updated.status,
      total: updated.total,
      buyerUser: updated.buyerUser,
      paymentMethod: updated.paymentMethod,
    });
  }

  return {
    ok: true,
    duplicate: false,
    order: {
      id: updated.id,
      businessId: updated.businessId,
      total: updated.total,
      status: updated.status,
      paymentId: updated.paymentId,
      paymentMethod: updated.paymentMethod,
      reservationId: order.reservationId,
      buyerUser: updated.buyerUser,
    },
  };
}

async function fetchFinikPaymentStatus(
  business: {
    finikApiKey: string | null;
    finikAccountId: string | null;
    finikSecret: string | null;
  },
  paymentId: string,
  queryContext?: { businessId?: number; orderId?: number },
): Promise<
  | { ok: true; status: string; amount: number | null }
  | { ok: false; error: string }
> {
  if (finikUseMock(business)) {
    return { ok: false, error: "Finik mock: статус только через webhook" };
  }

  const remote = await fetchFinikPaymentStatusRouted(
    business,
    paymentId,
    queryContext,
  );
  if (!remote.ok) {
    if (remote.apiMode === "legacy" || remote.apiMode === "official") {
      console.error(
        "Finik get payment",
        remote.apiMode,
        remote.error,
      );
    }
    return { ok: false, error: remote.error };
  }
  return {
    ok: true,
    status: remote.status,
    amount: remote.amount,
  };
}

export type SyncFinikReservationDepositResult =
  | {
      ok: true;
      paymentState: "paid" | "pending" | "failed";
      duplicate?: boolean;
    }
  | { ok: false; statusCode: number; error: string };

export async function syncFinikReservationDepositPayment(
  reservationId: number,
  businessId: number,
  paymentId: string,
): Promise<SyncFinikReservationDepositResult> {
  const reservation = await prisma.tableReservation.findFirst({
    where: { id: reservationId, businessId },
    select: { id: true, depositStatus: true, depositAmount: true },
  });
  if (!reservation) {
    return { ok: false, statusCode: 404, error: "Бронь не найдена" };
  }
  if (reservation.depositStatus === "DEPOSIT_PAID") {
    return { ok: true, paymentState: "paid", duplicate: true };
  }
  if (reservation.depositStatus !== "DEPOSIT_PENDING") {
    return { ok: false, statusCode: 409, error: "Депозит не ожидает оплаты" };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { finikApiKey: true, finikAccountId: true, finikSecret: true },
  });
  if (!business) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }

  const remote = await fetchFinikPaymentStatus(business, paymentId);
  if (!remote.ok) {
    return { ok: false, statusCode: 502, error: remote.error };
  }

  if (FINIK_FAILED_STATUSES.has(remote.status)) {
    return { ok: true, paymentState: "failed" };
  }
  if (!FINIK_SUCCESS_STATUSES.has(remote.status)) {
    return { ok: true, paymentState: "pending" };
  }

  if (
    remote.amount != null &&
    reservation.depositAmount != null &&
    Math.round(remote.amount) !== reservation.depositAmount
  ) {
    return { ok: false, statusCode: 400, error: "Amount mismatch" };
  }

  const { applyReservationDepositPaid } = await import(
    "./tableReservationDeposit.js"
  );
  const applied = await applyReservationDepositPaid(reservationId, paymentId);
  if (!applied.ok) {
    return { ok: false, statusCode: applied.statusCode, error: applied.error };
  }

  return {
    ok: true,
    paymentState: "paid",
    duplicate: applied.duplicate,
  };
}

async function tryApplyFinikReservationDepositWebhook(input: {
  businessId: number;
  paymentId: string;
  externalId: string | null;
  amount: number | null;
}): Promise<
  | { handled: true; duplicate: boolean; reservationId: number }
  | { handled: false }
> {
  const { parseReservationDepositExternalId } = await import(
    "../shared/reservationDeposit.js"
  );
  const { applyReservationDepositPaid } = await import(
    "./tableReservationDeposit.js"
  );

  let reservationId = parseReservationDepositExternalId(input.externalId);
  if (reservationId == null) {
    const byPayment = await prisma.tableReservation.findFirst({
      where: {
        businessId: input.businessId,
        depositPaymentId: input.paymentId,
      },
      select: { id: true, depositAmount: true },
    });
    if (!byPayment) return { handled: false };
    reservationId = byPayment.id;
    if (
      input.amount != null &&
      byPayment.depositAmount != null &&
      Math.round(input.amount) !== byPayment.depositAmount
    ) {
      throw new Error("DEPOSIT_AMOUNT_MISMATCH");
    }
  } else {
    const row = await prisma.tableReservation.findFirst({
      where: { id: reservationId, businessId: input.businessId },
      select: { depositAmount: true },
    });
    if (!row) return { handled: false };
    if (
      input.amount != null &&
      row.depositAmount != null &&
      Math.round(input.amount) !== row.depositAmount
    ) {
      throw new Error("DEPOSIT_AMOUNT_MISMATCH");
    }
  }

  const applied = await applyReservationDepositPaid(reservationId, input.paymentId);
  if (!applied.ok) {
    if (applied.error === "Reservation not found") return { handled: false };
    throw new Error(applied.error);
  }

  return {
    handled: true,
    duplicate: applied.duplicate,
    reservationId,
  };
}

export type SyncFinikOrderPaymentResult =
  | {
      ok: true;
      paymentState: "paid" | "pending" | "failed";
      duplicate?: boolean;
      order: unknown;
    }
  | { ok: false; statusCode: number; error: string };

/** Merchant fallback: query Finik API — never manual confirm. */
export async function syncFinikOrderPayment(
  orderId: number,
  businessId: number
): Promise<SyncFinikOrderPaymentResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { buyerUser: true },
  });
  if (!order) {
    return { ok: false, statusCode: 404, error: "Заказ не найден" };
  }
  if (!isFinikOrderPaymentMethod(order.paymentMethod)) {
    return { ok: false, statusCode: 400, error: "Заказ не через Finik" };
  }
  if (!order.paymentId?.trim()) {
    return { ok: false, statusCode: 400, error: "Нет paymentId Finik" };
  }

  logFinikOrderPaymentSync({
    phase: "start",
    businessId,
    orderId,
    paymentId: order.paymentId.trim(),
    paymentMethod: order.paymentMethod,
  });

  const cur = String(order.status ?? "").toUpperCase();
  if (FINIK_PAID_ORDER_STATUSES.has(cur)) {
    return {
      ok: true,
      paymentState: "paid",
      duplicate: true,
      order,
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { finikApiKey: true, finikAccountId: true, finikSecret: true },
  });
  if (!business) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }

  const remote = await fetchFinikPaymentStatus(
    business,
    order.paymentId.trim(),
    { businessId, orderId },
  );
  if (!remote.ok) {
    logFinikOrderPaymentSync({
      phase: "apply_failed",
      businessId,
      orderId,
      paymentId: order.paymentId.trim(),
      paymentMethod: order.paymentMethod,
      error: remote.error,
    });
    return { ok: false, statusCode: 502, error: remote.error };
  }

  const successMapping: "paid" | "pending" | "failed" = FINIK_FAILED_STATUSES.has(
    remote.status,
  )
    ? "failed"
    : FINIK_SUCCESS_STATUSES.has(remote.status)
      ? "paid"
      : "pending";

  logFinikOrderPaymentSync({
    phase: "status_fetched",
    businessId,
    orderId,
    paymentId: order.paymentId.trim(),
    paymentMethod: order.paymentMethod,
    paymentState: remote.status,
    successMapping,
  });

  if (FINIK_FAILED_STATUSES.has(remote.status)) {
    return { ok: true, paymentState: "failed", order };
  }

  if (!FINIK_SUCCESS_STATUSES.has(remote.status)) {
    return { ok: true, paymentState: "pending", order };
  }

  const applied = await applyFinikPaymentSuccess(
    {
      id: order.id,
      businessId: order.businessId,
      total: order.total,
      status: order.status,
      paymentId: order.paymentId,
      paymentMethod: order.paymentMethod,
      reservationId: order.reservationId,
      buyerUser: order.buyerUser,
    },
    { expectedAmount: remote.amount ?? order.total }
  );

  if (!applied.ok) {
    logFinikOrderPaymentSync({
      phase: "apply_failed",
      businessId,
      orderId,
      paymentId: order.paymentId.trim(),
      paymentMethod: order.paymentMethod,
      error: applied.error,
    });
    return {
      ok: false,
      statusCode: applied.statusCode,
      error: applied.error,
    };
  }

  logFinikOrderPaymentSync({
    phase: "apply_success",
    businessId,
    orderId,
    paymentId: order.paymentId.trim(),
    paymentMethod: order.paymentMethod,
    oldStatus: order.status,
    newStatus: "CONFIRMED",
  });

  const fresh = await prisma.order.findUnique({
    where: { id: order.id },
    include: { buyerUser: true },
  });

  return {
    ok: true,
    paymentState: "paid",
    duplicate: applied.duplicate,
    order: fresh ?? order,
  };
}

/**
 * @deprecated Import from finikWebhookCrypto.js — re-export for tests.
 */
export { verifyFinikWebhookSignature } from "./finikWebhookCrypto.js";

async function handleFinikWebhookForBusiness(
  businessId: number,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const rawBody =
      typeof req.rawBody === "string" && req.rawBody !== ""
        ? req.rawBody
        : typeof req.body === "object" && req.body !== null
          ? JSON.stringify(req.body)
          : String(req.body ?? "");

    const corrId = correlationIdFromRequest(req);

    const body = req.body as Record<string, unknown>;
    const webhookPath = `/finik/webhook/${businessId}`;

    const verify = await verifyFinikWebhookAdmission({
      finikSecret: business.finikSecret,
      finikApiKey: business.finikApiKey,
      finikAccountId: business.finikAccountId,
      req,
      rawBody,
      body,
      webhookPath,
    });
    if (!verify.ok) {
      logWebhookReject({
        provider: "finik",
        businessId,
        reason: verify.reason,
        paymentId: extractFinikWebhookPaymentIds(body)[0] ?? "",
        ...(corrId ? { correlationId: corrId } : {}),
      });
      const statusCode = verify.reason === "no_verify_credentials" ? 503 : 403;
      res.status(statusCode).json({
        error:
          verify.reason === "no_verify_credentials"
            ? "Webhook signature not configured"
            : "Invalid signature",
      });
      return;
    }
    const parsed = parseFinikWebhookPayload(body);

    if (!parsed.paymentId) {
      res.status(400).json({ error: "paymentId required" });
      return;
    }

    logCommerceEvent({
      phase: "payment_webhook",
      businessId,
      paymentId: parsed.paymentId,
      detail: `admitted:${verify.mode}${parsed.externalId ? `:ext=${parsed.externalId}` : ""}`,
      ...(corrId ? { correlationId: corrId } : {}),
    });

    if (
      isFinikWebhookReplay(businessId, parsed.paymentId, parsed.status)
    ) {
      logWebhookProcessed({
        provider: "finik",
        businessId,
        paymentId: parsed.paymentId,
        outcome: "replay",
        ...(corrId ? { correlationId: corrId } : {}),
      });
      res.json({ ok: true, duplicate: true, replay: true });
      return;
    }

    if (FINIK_FAILED_STATUSES.has(parsed.status)) {
      let order: { id: number; status: string; reservationId: number | null } | null =
        null;
      for (const pid of parsed.paymentIdCandidates) {
        const row = await prisma.order.findFirst({
          where: { paymentId: pid, businessId },
          select: { id: true, status: true, reservationId: true },
        });
        if (row) {
          order = row;
          break;
        }
      }
      if (order) {
        const cur = String(order.status ?? "").toUpperCase();
        if (cur === "NEW" || cur === "ACCEPTED" || cur === "PAID_PENDING") {
          const { loadOrderLinesForStock, releaseOrderStock } =
            await import("./inventoryService.js");
          const lines = await loadOrderLinesForStock(order.id);
          await prisma.$transaction(async (tx) => {
            await releaseOrderStock(tx, businessId, order.id, lines);
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: "CANCELLED",
                ...(order.reservationId != null
                  ? { preorderStatus: "PREORDER_CANCELLED" }
                  : {}),
              },
            });
          });
          logPaymentFailure({
            businessId,
            orderId: order.id,
            paymentId: parsed.paymentId,
            reason: "finik_webhook_failed",
            finikStatus: parsed.status,
          });
        }
      }
      logWebhookProcessed({
        provider: "finik",
        businessId,
        paymentId: parsed.paymentId,
        ...(order ? { orderId: order.id } : {}),
        outcome: "failed",
      });
      res.json({ ok: true, ignored: true, paymentState: "failed" });
      return;
    }

    if (!FINIK_SUCCESS_STATUSES.has(parsed.status)) {
      res.json({ ok: true, ignored: true, paymentState: "pending" });
      return;
    }

    try {
      const depositApplied = await tryApplyFinikReservationDepositWebhook({
        businessId,
        paymentId: parsed.paymentId,
        externalId: parsed.externalId,
        amount: parsed.amount,
      });
      if (depositApplied.handled) {
        logWebhookProcessed({
          provider: "finik",
          businessId,
          paymentId: parsed.paymentId,
          outcome: depositApplied.duplicate ? "duplicate" : "success",
        });
        res.json({ ok: true, duplicate: depositApplied.duplicate, kind: "deposit" });
        return;
      }
    } catch (depErr) {
      const msg = depErr instanceof Error ? depErr.message : String(depErr);
      if (msg === "DEPOSIT_AMOUNT_MISMATCH") {
        logPaymentFailure({
          businessId,
          paymentId: parsed.paymentId,
          reason: "deposit_amount_mismatch",
        });
        res.status(400).json({ error: "Amount mismatch" });
        return;
      }
      throw depErr;
    }

    const order = await resolveFinikWebhookOrder(businessId, parsed);

    if (!order) {
      logPaymentFailure({
        businessId,
        paymentId: parsed.paymentId,
        reason: "webhook_order_not_found",
      });
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (parsed.externalId != null) {
      const expected = `${businessId}:${order.id}`;
      if (parsed.externalId !== expected) {
        res.status(400).json({ error: "external_id mismatch" });
        return;
      }
    }

    if (
      parsed.paymentId !== "" &&
      order.paymentId !== parsed.paymentId &&
      parsed.paymentIdCandidates.includes(parsed.paymentId)
    ) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentId: parsed.paymentId },
      });
      order.paymentId = parsed.paymentId;
    }

    if (
      parsed.orderIdFromBody != null &&
      parsed.orderIdFromBody !== order.id
    ) {
      res.status(400).json({ error: "order_id mismatch" });
      return;
    }

    const applied = await applyFinikPaymentSuccess(
      {
        id: order.id,
        businessId: order.businessId,
        total: order.total,
        status: order.status,
        paymentId: order.paymentId,
        paymentMethod: order.paymentMethod,
        reservationId: order.reservationId,
        buyerUser: order.buyerUser,
      },
      {
        expectedAmount: parsed.amount ?? order.total,
        finikTransactionId: parsed.paymentId,
      },
    );

    if (!applied.ok) {
      if (applied.error === "Amount mismatch") {
        logPaymentFailure({
          businessId,
          orderId: order.id,
          paymentId: parsed.paymentId,
          reason: "amount_mismatch",
        });
      }
      res.status(applied.statusCode).json({ error: applied.error });
      return;
    }

    logWebhookProcessed({
      provider: "finik",
      businessId,
      orderId: order.id,
      paymentId: parsed.paymentId,
      outcome: applied.duplicate ? "duplicate" : "success",
    });

    res.json({ ok: true, duplicate: applied.duplicate });
  } catch (e) {
    console.error("FINIK WEBHOOK:", businessId, e);
    res.status(500).json({ error: "Webhook error" });
  }
}

/**
 * Регистрирует:
 * - `POST /finik/webhook/:businessId` — основной вебхук с идентификатором тенанта;
 * - `POST /finik/webhook` — legacy: по заказу по `paymentId` вызывает обработчик с верным businessId.
 */
export function mountFinikWebhookRoutes(app: Express): void {
  app.post(
    "/finik/webhook/:businessId",
    webhooksLimiter,
    async (req: Request, res: Response) => {
      const businessId = Number(req.params.businessId);
      if (!Number.isInteger(businessId) || businessId <= 0) {
        res.status(400).json({ error: "Invalid businessId" });
        return;
      }
      await handleFinikWebhookForBusiness(businessId, req, res);
    }
  );

  app.post("/finik/webhook", webhooksLimiter, async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const paymentIds = extractFinikWebhookPaymentIds(body);
      if (paymentIds.length === 0) {
        res.status(400).json({ error: "paymentId required" });
        return;
      }
      let order: { businessId: number } | null = null;
      for (const paymentId of paymentIds) {
        const row = await prisma.order.findFirst({
          where: { paymentId },
          select: { businessId: true },
        });
        if (row) {
          order = row;
          break;
        }
      }
      if (order) {
        await handleFinikWebhookForBusiness(order.businessId, req, res);
        return;
      }
      let reservation: { businessId: number } | null = null;
      for (const paymentId of paymentIds) {
        const row = await prisma.tableReservation.findFirst({
          where: { depositPaymentId: paymentId },
          select: { businessId: true },
        });
        if (row) {
          reservation = row;
          break;
        }
      }
      if (!reservation) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }
      await handleFinikWebhookForBusiness(reservation.businessId, req, res);
    } catch (e) {
      console.error("FINIK WEBHOOK LEGACY:", e);
      res.status(500).json({ error: "Webhook error" });
    }
  });
}

/**
 * Настройка Finik для магазина (только админ магазина). Ключи не возвращаются в ответе.
 */
export function mountFinikSettingsRoutes(app: Express): void {
  app.get("/integrations/finik", async (req: Request, res: Response) => {
    try {
      const businessId = Number(
        (req.query as { businessId?: string }).businessId
      );
      if (!Number.isInteger(businessId) || businessId <= 0) {
        res.status(400).json({ error: "Нужен query businessId" });
        return;
      }

      const b = await prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          finikApiKey: true,
          finikAccountId: true,
          finikSecret: true,
        },
      });
      if (!b) {
        res.status(404).json({ error: "Магазин не найден" });
        return;
      }

      const telegramStr = verifiedTelegramIdFromRequest(req);
      if (!telegramStr) {
        res.status(401).json({
          error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
        });
        return;
      }

      if (!(await merchantStaffHasFinikSettingsAccess(businessId, telegramStr))) {
        res.status(403).json({ error: "Нет доступа к этому магазину" });
        return;
      }

      const platformManaged = isMerchantFinikPlatformManaged({
        finikApiKey: b.finikApiKey,
        finikAccountId: b.finikAccountId,
        finikSecret: b.finikSecret,
      });
      const ready = isFinikCredentialsReady(
        b.finikApiKey,
        b.finikAccountId,
        b.finikSecret,
      );
      const legacyHttpReady = isFinikLegacyHttpReady(b.finikApiKey, b.finikSecret);
      res.json({
        businessId: b.id,
        finikConfigured: ready,
        finikReady: ready,
        finikHasApiKey: finikHasApiKey(b.finikApiKey),
        finikHasAccountId: finikHasAccountId(b.finikAccountId),
        finikLegacyHttpReady: legacyHttpReady,
        finikHasSecret: finikHasSecret(b.finikSecret),
        finikPlatformManaged: platformManaged,
        webhookUrl: buildFinikWebhookUrl(publicApiOrigin(), b.id),
      });
    } catch (e) {
      console.error("GET /integrations/finik:", e);
      res.status(500).json({ error: "failed" });
    }
  });

  app.post("/integrations/finik", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const businessId = Number(body.businessId);
      if (!Number.isInteger(businessId) || businessId <= 0) {
        res.status(400).json({ error: "Нужен body.businessId" });
        return;
      }

      const telegramStr = verifiedTelegramIdFromRequest(req);
      if (!telegramStr) {
        res.status(401).json({
          error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
        });
        return;
      }

      if (!(await merchantStaffHasFinikSettingsAccess(businessId, telegramStr))) {
        res.status(403).json({ error: "Нет доступа к этому магазину" });
        return;
      }

      const { savePlatformFinikForMerchant } = await import(
        "./platformMerchantStoreSettings.js"
      );
      const out = await savePlatformFinikForMerchant({
        telegramId: telegramStr,
        businessId,
        ...(body.finikApiKey !== undefined
          ? { finikApiKey: body.finikApiKey }
          : {}),
        ...(body.finikAccountId !== undefined
          ? { finikAccountId: body.finikAccountId }
          : {}),
        ...(body.finikSecret !== undefined
          ? { finikSecret: body.finikSecret }
          : {}),
      });
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.error });
        return;
      }
      res.json({
        ok: true,
        businessId,
        finikConfigured: out.finikReady,
        finikReady: out.finikReady,
        finikPlatformManaged: out.finikPlatformManaged,
        webhookUrl: out.finikWebhookUrl,
      });
    } catch (e) {
      console.error("POST /integrations/finik:", e);
      res.status(500).json({ error: "failed" });
    }
  });
}
