import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { isOrderAnalyticsSuccessStatus } from "../shared/orderAnalytics.js";

export type MerchantLifetimeAnalyticsSnapshot = {
  createdOrders: number;
  successfulOrders: number;
  successfulRevenue: number;
  completedOrders: number;
  cancelledOrders: number;
};

function emptySnapshot(): MerchantLifetimeAnalyticsSnapshot {
  return {
    createdOrders: 0,
    successfulOrders: 0,
    successfulRevenue: 0,
    completedOrders: 0,
    cancelledOrders: 0,
  };
}

function toSnapshot(
  row:
    | {
        createdOrders: number;
        successfulOrders: number;
        successfulRevenue: number;
        completedOrders: number;
        cancelledOrders: number;
      }
    | null,
): MerchantLifetimeAnalyticsSnapshot {
  if (row == null) return emptySnapshot();
  return {
    createdOrders: row.createdOrders,
    successfulOrders: row.successfulOrders,
    successfulRevenue: row.successfulRevenue,
    completedOrders: row.completedOrders,
    cancelledOrders: row.cancelledOrders,
  };
}

export async function getMerchantLifetimeAnalytics(
  businessId: number,
): Promise<MerchantLifetimeAnalyticsSnapshot> {
  const db = prisma as any;
  const row = await db.merchantLifetimeAnalytics.findUnique({
    where: { businessId },
    select: {
      createdOrders: true,
      successfulOrders: true,
      successfulRevenue: true,
      completedOrders: true,
      cancelledOrders: true,
    },
  });
  return toSnapshot(row);
}

export async function registerLifetimeOrderCreated(input: {
  tx: Prisma.TransactionClient;
  businessId: number;
  orderId: number;
  initialStatus: OrderStatus;
}): Promise<void> {
  const tx = input.tx as any;
  const existing = await tx.merchantLifetimeOrderState.findUnique({
    where: { orderId: input.orderId },
    select: { orderId: true },
  });
  if (existing) return;
  await tx.merchantLifetimeOrderState.create({
    data: {
      businessId: input.businessId,
      orderId: input.orderId,
      status: input.initialStatus,
      countedRevenue: 0,
    },
  });
  await tx.merchantLifetimeAnalytics.upsert({
    where: { businessId: input.businessId },
    create: {
      businessId: input.businessId,
      createdOrders: 1,
      successfulOrders: 0,
      successfulRevenue: 0,
      completedOrders: 0,
      cancelledOrders: 0,
    },
    update: {
      createdOrders: { increment: 1 },
    },
  });
}

export async function applyLifetimeStatusTransition(input: {
  tx: Prisma.TransactionClient;
  businessId: number;
  orderId: number;
  from: OrderStatus;
  to: OrderStatus;
  total: number;
}): Promise<void> {
  const tx = input.tx as any;
  const state = await tx.merchantLifetimeOrderState.findUnique({
    where: { orderId: input.orderId },
    select: { status: true, countedRevenue: true },
  });
  const prevStatus = state?.status ?? input.from;
  const prevSuccessful = isOrderAnalyticsSuccessStatus(prevStatus);
  const nextSuccessful = isOrderAnalyticsSuccessStatus(input.to);
  const prevRevenue = state?.countedRevenue ?? (prevSuccessful ? input.total : 0);
  const nextRevenue = nextSuccessful ? input.total : 0;

  const deltaSuccessfulOrders =
    (nextSuccessful ? 1 : 0) - (prevSuccessful ? 1 : 0);
  const deltaSuccessfulRevenue = nextRevenue - prevRevenue;
  const deltaCompleted =
    prevStatus !== "DELIVERED" && input.to === "DELIVERED" ? 1 : 0;
  const deltaCancelled =
    prevStatus !== "CANCELLED" && input.to === "CANCELLED" ? 1 : 0;

  const shouldUpdateAnalytics =
    deltaSuccessfulOrders !== 0 ||
    deltaSuccessfulRevenue !== 0 ||
    deltaCompleted !== 0 ||
    deltaCancelled !== 0;

  if (shouldUpdateAnalytics) {
    await tx.merchantLifetimeAnalytics.upsert({
      where: { businessId: input.businessId },
      create: {
        businessId: input.businessId,
        createdOrders: 0,
        successfulOrders: Math.max(0, deltaSuccessfulOrders),
        successfulRevenue: Math.max(0, deltaSuccessfulRevenue),
        completedOrders: Math.max(0, deltaCompleted),
        cancelledOrders: Math.max(0, deltaCancelled),
      },
      update: {
        successfulOrders: { increment: deltaSuccessfulOrders },
        successfulRevenue: { increment: deltaSuccessfulRevenue },
        completedOrders: { increment: deltaCompleted },
        cancelledOrders: { increment: deltaCancelled },
      },
    });
  }

  await tx.merchantLifetimeOrderState.upsert({
    where: { orderId: input.orderId },
    create: {
      businessId: input.businessId,
      orderId: input.orderId,
      status: input.to,
      countedRevenue: nextRevenue,
    },
    update: {
      status: input.to,
      countedRevenue: nextRevenue,
    },
  });
}
