import { prisma } from "./db.js";

export type MerchantWorkloadSummary = {
  unreadNotifications: number;
  pendingSupport: number;
  pendingCancelRequests: number;
  pendingRefundRequests: number;
  pendingReturnRequests: number;
  ordersAwaitingAction: number;
  priorityScore: number;
};

export async function buildMerchantWorkload(
  businessId: number
): Promise<MerchantWorkloadSummary> {
  const [
    unreadNotifications,
    pendingSupport,
    pendingCancelRequests,
    pendingRefundRequests,
    pendingReturnRequests,
    newOrders,
    paidPending,
  ] = await Promise.all([
    prisma.merchantNotification.count({
      where: { businessId, readAt: null },
    }),
    prisma.supportTicket.count({
      where: { businessId, status: "PENDING_MERCHANT" },
    }),
    prisma.cancelRequest.count({
      where: { businessId, status: "PENDING" },
    }),
    prisma.refundRequest.count({
      where: {
        businessId,
        status: { in: ["REQUESTED", "REVIEWING", "APPROVED"] },
      },
    }),
    prisma.returnRequest.count({
      where: { businessId, status: { in: ["PENDING", "APPROVED"] } },
    }),
    prisma.order.count({ where: { businessId, status: "NEW" } }),
    prisma.order.count({ where: { businessId, status: "PAID_PENDING" } }),
  ]);

  const ordersAwaitingAction = newOrders + paidPending;
  const priorityScore =
    pendingSupport * 3 +
    pendingCancelRequests * 2 +
    pendingRefundRequests * 2 +
    pendingReturnRequests * 2 +
    ordersAwaitingAction;

  return {
    unreadNotifications,
    pendingSupport,
    pendingCancelRequests,
    pendingRefundRequests,
    pendingReturnRequests,
    ordersAwaitingAction,
    priorityScore,
  };
}
