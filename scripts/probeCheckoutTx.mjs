import "dotenv/config";
import { PrismaClient, OrderStatus } from "@prisma/client";
import { buildCheckoutOrderItemRows, parseCheckoutDeliveryMode } from "../dist/server/checkoutOrderWrite.js";
import { priceCheckoutLines } from "../dist/server/checkoutPricing.js";
import { reserveOrderStock } from "../dist/server/inventoryService.js";
import { initializeOrderDelivery } from "../dist/server/deliveryService.js";
import { allocateHumanOrderNumber } from "../dist/server/orderNumber.js";

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

const bizName = process.argv[2] ?? "100";

try {
  await prisma.$connect();
  const businesses = await prisma.business.findMany({
    where: { isActive: true, isBlocked: false },
    select: { id: true, name: true, businessType: true },
  });
  const biz =
    businesses.find((b) =>
      String(b.name).toLowerCase().includes(bizName.toLowerCase()),
    ) ?? businesses[0];
  if (!biz) {
    console.log("no business");
    process.exit(0);
  }
  console.log("business:", biz.id, biz.name, biz.businessType);

  const products = await prisma.product.findMany({
    where: { businessId: biz.id },
    select: { id: true, name: true, price: true },
    take: 5,
  });
  console.log(
    "products:",
    products.map((p) => `${p.id}:${p.name}`).join(", "),
  );

  const red =
    products.find((p) => /red/i.test(p.name)) ?? products[0];
  if (!red?.id) {
    console.log("no product");
    process.exit(0);
  }

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    console.log("no user");
    process.exit(0);
  }

  const lines = [
    {
      productId: red.id,
      size: "11",
      color: "",
      quantity: 1,
      options: { packaging: "paper" },
    },
  ];

  try {
    await prisma.$transaction(async (tx) => {
      const priced = await priceCheckoutLines(
        tx,
        biz.id,
        String(biz.businessType),
        lines,
      );
      if (!priced.ok) {
        console.log("PRICE FAIL", priced);
        throw new Error("PRICE");
      }
      console.log("priced ok", priced.lines);

      const orderNumber = await allocateHumanOrderNumber(tx, biz.id);
      const itemCreates = buildCheckoutOrderItemRows(
        biz.id,
        priced.lines,
        [{ packaging: "paper" }],
      );

      const order = await tx.order.create({
        data: {
          businessId: biz.id,
          buyerUserId: user.id,
          orderNumber,
          name: "Probe",
          phone: "+996700000001",
          address: "test addr",
          total: priced.subtotal,
          status: OrderStatus.NEW,
          paymentMethod: "finik",
          items: { create: itemCreates },
        },
        include: { items: true },
      });
      console.log("order_created ok", order.id);

      const stockLines = order.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        size: it.size,
        color: it.color,
        quantity: it.quantity,
      }));
      const reserved = await reserveOrderStock(
        tx,
        biz.id,
        order.id,
        stockLines,
      );
      if (!reserved.ok) {
        console.log("STOCK FAIL", reserved);
        throw new Error("STOCK");
      }
      console.log("stock_reserved ok");

      const deliveryMode = parseCheckoutDeliveryMode({ deliveryType: "delivery" });
      await initializeOrderDelivery(tx, order.id, { deliveryMode });
      console.log("delivery_init ok");

      throw new Error("ROLLBACK_PROBE");
    });
  } catch (e) {
    if (e?.message === "ROLLBACK_PROBE") {
      console.log("FULL TX OK (rolled back)");
    } else {
      console.log("TX FAIL:", e?.constructor?.name);
      console.log(e?.message ?? e);
    }
  }
} finally {
  await prisma.$disconnect();
}
