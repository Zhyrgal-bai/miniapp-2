import "dotenv/config";
import { PrismaClient, OrderStatus } from "@prisma/client";
import { buildCheckoutOrderItemRows } from "../dist/server/checkoutOrderWrite.js";

function fixDbUrl() {
  const u = process.env.DATABASE_URL ?? "";
  if (!u) return;
  try {
    const parsed = new URL(u.replace(/^postgresql:/i, "postgres:"));
    const host = parsed.hostname;
    if (/^dpg-[a-z0-9]+-a$/i.test(host)) {
      parsed.hostname = `${host}.oregon-postgres.render.com`;
      let out = parsed.toString().replace(/^postgres:/i, "postgresql:");
      if (!/sslmode=/i.test(out)) out += `${out.includes("?") ? "&" : "?"}sslmode=require`;
      process.env.DATABASE_URL = out;
    }
  } catch {
    /* ignore */
  }
}

fixDbUrl();
const prisma = new PrismaClient();

try {
  await prisma.$connect();
  const biz = await prisma.business.findFirst({
    where: { isActive: true, isBlocked: false },
    select: { id: true, name: true },
  });
  if (!biz) {
    console.log("no active business");
    process.exit(0);
  }
  const product = await prisma.product.findFirst({
    where: { businessId: biz.id },
    select: { id: true, name: true },
  });
  if (!product?.id) {
    console.log("no product for business", biz.id);
    process.exit(0);
  }
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    console.log("no user");
    process.exit(0);
  }

  const itemCreates = buildCheckoutOrderItemRows(
    biz.id,
    [
      {
        productId: product.id,
        name: product.name,
        size: "11",
        color: "",
        quantity: 1,
        unitPrice: 5000,
      },
    ],
    [{ packaging: "paper" }],
  );
  console.log("items payload:", JSON.stringify(itemCreates, null, 2));

  try {
    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          businessId: biz.id,
          buyerUserId: user.id,
          orderNumber: "9999-999",
          name: "Probe",
          phone: "+996700000001",
          address: "test",
          total: 5000,
          status: OrderStatus.NEW,
          paymentMethod: "finik",
          items: { create: itemCreates },
        },
        include: { items: true },
      });
    });
    console.log("ORDER OK id=", order.id, "items=", order.items.length);
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  } catch (e) {
    console.log("ORDER FAIL:", e?.constructor?.name);
    console.log(e?.message ?? e);
  }
} finally {
  await prisma.$disconnect();
}
