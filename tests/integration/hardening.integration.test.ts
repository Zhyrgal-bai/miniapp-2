/**
 * Integration tests — require DATABASE_URL.
 * Run: DATABASE_URL=... npm run test:integration
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  reserveOrderStock,
  releaseOrderStock,
  syncProductStockFromVariants,
  loadStockRowsByProductIds,
} from "../../src/server/inventoryService.js";
import { releaseStaleUnpaidOrders } from "../../src/server/staleOrderService.js";
import { toPublicProduct } from "../../src/shared/productDto.js";
import { verifyFinikWebhookSignature } from "../../src/server/finikWebhookCrypto.js";
import { createHmac } from "node:crypto";

const dbUrl = process.env.DATABASE_URL?.trim();
const describeIntegration = dbUrl ? describe : describe.skip;

describeIntegration("inventory integration (real DB)", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sync + catalog read uses ProductStock.available", async () => {
    const business = await prisma.business.findFirst({
      select: { id: true, businessType: true },
    });
    if (!business) return;

    const product = await prisma.product.findFirst({
      where: { businessId: business.id },
      select: { id: true, attributes: true },
    });
    if (!product) return;

    await syncProductStockFromVariants({
      businessId: business.id,
      productId: product.id,
      variants: [{ color: "test", sizes: [{ size: "IT-M", stock: 3 }] }],
    });

    const stockMap = await loadStockRowsByProductIds(business.id, [product.id]);
    const dto = toPublicProduct(
      {
        id: product.id,
        name: "it",
        price: 100,
        image: null,
        attributes: product.attributes,
      },
      { businessType: business.businessType, stockRows: stockMap.get(product.id) ?? [] },
    );

    const row = dto.variants
      .flatMap((v) => v.sizes)
      .find((s) => s.size === "IT-M");
    expect(row?.stock).toBe(3);
  });

  it("last unit reserve blocks second client", async () => {
    const business = await prisma.business.findFirst({ select: { id: true } });
    if (!business) return;

    const product = await prisma.product.create({
      data: {
        name: `IT ${Date.now()}`,
        price: 100,
        businessId: business.id,
        categoryId: (
          await prisma.category.findFirst({
            where: { businessId: business.id },
            select: { id: true },
          })
        )!.id,
        attributes: {},
      },
    });

    await syncProductStockFromVariants({
      businessId: business.id,
      productId: product.id,
      variants: [{ color: "", sizes: [{ size: "ONE", stock: 1 }] }],
    });

    const order1 = await prisma.order.create({
      data: {
        businessId: business.id,
        name: "A",
        phone: "+996700000001",
        address: "—",
        total: 100,
        status: "NEW",
      },
    });

    await prisma.$transaction(async (tx) => {
      const r1 = await reserveOrderStock(tx, business.id, order1.id, [
        { productId: product.id, size: "ONE", color: "", quantity: 1 },
      ]);
      expect(r1.ok).toBe(true);
    });

    const order2 = await prisma.order.create({
      data: {
        businessId: business.id,
        name: "B",
        phone: "+996700000002",
        address: "—",
        total: 100,
        status: "NEW",
      },
    });

    await prisma.$transaction(async (tx) => {
      const r2 = await reserveOrderStock(tx, business.id, order2.id, [
        { productId: product.id, size: "ONE", color: "", quantity: 1 },
      ]);
      expect(r2.ok).toBe(false);
    });

    await prisma.$transaction(async (tx) => {
      await releaseOrderStock(tx, business.id, order1.id, [
        { productId: product.id, size: "ONE", color: "", quantity: 1 },
      ]);
    });

    await prisma.product.delete({ where: { id: product.id } });
    await prisma.order.deleteMany({
      where: { id: { in: [order1.id, order2.id] } },
    });
  });

  it("stale unpaid order releases reserved stock", async () => {
    const business = await prisma.business.findFirst({ select: { id: true } });
    if (!business) return;

    const category = await prisma.category.findFirst({
      where: { businessId: business.id },
      select: { id: true },
    });
    if (!category) return;

    const product = await prisma.product.create({
      data: {
        name: `Stale IT ${Date.now()}`,
        price: 100,
        businessId: business.id,
        categoryId: category.id,
        attributes: {},
      },
    });

    await syncProductStockFromVariants({
      businessId: business.id,
      productId: product.id,
      variants: [{ color: "", sizes: [{ size: "ONE", stock: 2 }] }],
    });

    const order = await prisma.order.create({
      data: {
        businessId: business.id,
        name: "Stale",
        phone: "+996700000099",
        address: "—",
        total: 100,
        status: "NEW",
        createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      },
    });

    await prisma.$transaction(async (tx) => {
      const r = await reserveOrderStock(tx, business.id, order.id, [
        { productId: product.id, size: "ONE", color: "", quantity: 1 },
      ]);
      expect(r.ok).toBe(true);
    });

    const released = await releaseStaleUnpaidOrders({
      businessId: business.id,
      maxAgeMs: 60 * 60 * 1000,
    });
    expect(released).toBe(1);

    const stockMap = await loadStockRowsByProductIds(business.id, [product.id]);
    const available = stockMap.get(product.id)?.[0]?.available ?? 0;
    expect(available).toBe(2);

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    expect(updated?.status).toBe("CANCELLED");

    await prisma.product.delete({ where: { id: product.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });
});

describe("Finik webhook signature (production mode)", () => {
  it("rejects when signature header configured but missing on request", () => {
    const prev = process.env.NODE_ENV;
    const prevHdr = process.env.FINIK_WEBHOOK_SIGNATURE_HEADER;
    process.env.NODE_ENV = "production";
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = "x-finik-signature";

    const ok = verifyFinikWebhookSignature("secret123", { headers: {} } as any, "");
    expect(ok).toBe(false);

    process.env.NODE_ENV = prev;
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = prevHdr;
  });

  it("accepts HMAC of raw body", () => {
    const prev = process.env.NODE_ENV;
    const prevHdr = process.env.FINIK_WEBHOOK_SIGNATURE_HEADER;
    process.env.NODE_ENV = "production";
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = "x-finik-signature";

    const secret = "secret123";
    const rawBody = '{"paymentId":"abc","status":"PAID"}';
    const sig = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const ok = verifyFinikWebhookSignature(
      secret,
      { headers: { "x-finik-signature": sig } } as any,
      rawBody,
    );
    expect(ok).toBe(true);

    process.env.NODE_ENV = prev;
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = prevHdr;
  });
});
