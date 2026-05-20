import type { Express, Request, Response } from "express";
import type multer from "multer";
import {
  Prisma,
  ReturnReason,
  ReturnRequestStatus,
  SupportSenderType,
  SupportTicketStatus,
  SupportTicketType,
  MerchantNotificationKind,
} from "@prisma/client";
import { uploadImageBuffer } from "../media/cloudinary.js";
import { isCloudinaryConfigured } from "./cloudinary.js";
import { prisma } from "./db.js";
import {
  orderSupportPhase,
  type SupportPhase,
} from "../shared/supportPhase.js";
import {
  MERCHANT_PERM,
  type MerchantPermissionId,
} from "./merchantPermissions.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";
import { buildSupportSuggestions } from "./supportSuggestionService.js";

type Deps = {
  upload: multer.Multer;
  telegramIdFromRequest: (req: Request) => string | null;
  resolveCatalogBusinessId: (
    req: Request,
    res: Response
  ) => Promise<number | null>;
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<{ businessId: number } | null>;
};

function jsonWithBigInt<T>(data: T): unknown {
  return JSON.parse(
    JSON.stringify(data as object, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

const NOT_FOUND = "Не найдено";

function parseOrderId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function parseTicketIdParam(
  raw: string | string[] | undefined
): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function isTicketType(s: string): s is SupportTicketType {
  return (Object.values(SupportTicketType) as string[]).includes(s);
}

function isReturnReason(s: string): s is ReturnReason {
  return (Object.values(ReturnReason) as string[]).includes(s);
}

function isReturnStatus(s: string): s is ReturnRequestStatus {
  return (Object.values(ReturnRequestStatus) as string[]).includes(s);
}

function isTicketStatus(s: string): s is SupportTicketStatus {
  return (Object.values(SupportTicketStatus) as string[]).includes(s);
}

function allowedReturnTransition(
  from: ReturnRequestStatus,
  to: ReturnRequestStatus
): boolean {
  const m: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
    PENDING: ["APPROVED", "REJECTED"],
    APPROVED: ["REFUNDED", "RETURNED"],
    REJECTED: [],
    REFUNDED: [],
    RETURNED: [],
  };
  return m[from]?.includes(to) ?? false;
}

async function assertCustomerOrder(
  orderId: number,
  businessId: number,
  buyerUserId: number
) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      businessId,
      buyerUserId,
    },
    include: { items: true },
  });
}

type CustomerOrderWithItems = NonNullable<
  Awaited<ReturnType<typeof assertCustomerOrder>>
>;

function phaseLabelRu(phase: SupportPhase): string {
  switch (phase) {
    case "PROCESSING":
      return "в обработке";
    case "SHIPPING":
      return "в пути";
    case "DELIVERED":
      return "доставлен";
    case "CANCELLED":
      return "отменён";
    default:
      return phase;
  }
}

/** Temu-style auto-intro for GENERAL support tickets (Russian). */
function buildOrderSupportIntro(order: CustomerOrderWithItems): string {
  const phase = orderSupportPhase(String(order.status));
  const itemUnits = order.items.reduce((s, it) => s + it.quantity, 0);
  const lines: string[] = [];
  lines.push(
    `Здравствуйте! Чат поддержки магазина по заказу №${String(order.id)}.`
  );
  lines.push(
    `Сумма заказа: ${String(order.total)} сом · позиций: ${String(itemUnits)} · статус: ${phaseLabelRu(phase)}.`
  );
  const tr = order.tracking?.trim();
  if (tr) {
    lines.push(`Трек-номер отправления: ${tr}.`);
  }
  switch (phase) {
    case "PROCESSING":
      lines.push(
        "Заказ собирается. Можем помочь с отменой, обменом размера или уточнить срок отправки."
      );
      break;
    case "SHIPPING":
      lines.push(
        "Посылка в пути. Можем подсказать по треку, доставке или оформить вопрос по возврату до получения."
      );
      break;
    case "DELIVERED":
      lines.push(
        "Заказ доставлен. Доступны возврат, обмен и решение вопросов по качеству — напишите, что случилось."
      );
      break;
    case "CANCELLED":
      lines.push(
        "Заказ отменён. Если нужна помощь или уточнение по возврату средств — напишите здесь."
      );
      break;
    default:
      lines.push("Опишите вопрос — ответит магазин.");
  }
  lines.push("Напишите сообщение ниже.");
  return lines.join("\n\n");
}

function customerFirstMessageForTicketType(
  type: SupportTicketType,
  fallbackText: string
): string {
  if (fallbackText.trim()) return fallbackText.trim();
  switch (type) {
    case SupportTicketType.CANCEL_REQUEST:
      return "Запрос на отмену заказа";
    case SupportTicketType.ADDRESS_CHANGE:
      return "Нужно изменить адрес доставки";
    case SupportTicketType.DELIVERY:
      return "Вопрос по доставке";
    case SupportTicketType.TRACKING:
      return "Вопрос по трек-номеру";
    case SupportTicketType.QUALITY:
      return "Вопрос по качеству товара";
    case SupportTicketType.RETURN:
      return "Вопрос по возврату";
    case SupportTicketType.EXCHANGE:
      return "Запрос на обмен";
    default:
      return "Обращение в поддержку";
  }
}

async function insertFirstTicketMessages(
  tx: Prisma.TransactionClient,
  opts: {
    ticketId: number;
    businessId: number;
    userId: number;
    type: SupportTicketType;
    text: string;
    order: CustomerOrderWithItems;
  }
): Promise<void> {
  const { ticketId, businessId, userId, type, text, order } = opts;
  if (type === SupportTicketType.GENERAL) {
    await tx.supportMessage.create({
      data: {
        ticketId,
        businessId,
        senderType: SupportSenderType.SYSTEM,
        senderId: null,
        text: buildOrderSupportIntro(order),
        attachments: [],
      },
    });
    const trimmed = text.trim();
    if (trimmed) {
      await tx.supportMessage.create({
        data: {
          ticketId,
          businessId,
          senderType: SupportSenderType.CUSTOMER,
          senderId: userId,
          text: trimmed,
          attachments: [],
        },
      });
    }
  } else {
    const firstText = customerFirstMessageForTicketType(type, text);
    await tx.supportMessage.create({
      data: {
        ticketId,
        businessId,
        senderType: SupportSenderType.CUSTOMER,
        senderId: userId,
        text: firstText,
        attachments: [],
      },
    });
  }
  await tx.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });
}

function stripInternal<T extends { internalNote?: string | null }>(
  row: T,
  merchant: boolean
): T {
  if (merchant) return row;
  const { internalNote: _i, ...rest } = row;
  return rest as T;
}

export function attachSupportRoutes(app: Express, deps: Deps): void {
  const {
    upload,
    telegramIdFromRequest,
    resolveCatalogBusinessId,
    requireMerchantStaff,
  } = deps;

  async function customerUserId(
    req: Request,
    res: Response
  ): Promise<number | null> {
    const telegramId = telegramIdFromRequest(req);
    if (!telegramId) {
      res.status(400).json({ error: "Нужен userId (Telegram)" });
      return null;
    }
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ error: NOT_FOUND });
      return null;
    }
    return user.id;
  }

  app.get("/orders/my/:orderId", async (req: Request, res: Response) => {
    try {
      const userId = await customerUserId(req, res);
      if (userId == null) return;

      const businessId = await resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const orderId = parseOrderId(req.params.orderId);
      if (orderId == null) {
        return res.status(400).json({ error: "Неверный заказ" });
      }

      const order = await assertCustomerOrder(orderId, businessId, userId);
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND });
      }
      return res.json(jsonWithBigInt(order));
    } catch (e) {
      console.error("GET /orders/my/:orderId:", e);
      res.status(500).json({ error: "Ошибка загрузки заказа" });
    }
  });

  app.get("/support/tickets", async (req: Request, res: Response) => {
    try {
      const userId = await customerUserId(req, res);
      if (userId == null) return;
      const businessId = await resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const orderId = parseOrderId(
        Array.isArray(req.query.orderId) ? req.query.orderId[0] : req.query.orderId
      );
      if (orderId == null) {
        return res.status(400).json({ error: "Нужен orderId" });
      }

      const order = await assertCustomerOrder(orderId, businessId, userId);
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND });
      }

      const tickets = await prisma.supportTicket.findMany({
        where: { businessId, orderId, userId },
        orderBy: { id: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 50 },
        },
      });
      return res.json(
        jsonWithBigInt(tickets.map((t) => stripInternal(t, false)))
      );
    } catch (e) {
      console.error("GET /support/tickets:", e);
      res.status(500).json({ error: "Ошибка" });
    }
  });

  /** OPEN GENERAL ticket for order, or create with SYSTEM intro (Temu-style). */
  app.get("/support/session", async (req: Request, res: Response) => {
    try {
      const userId = await customerUserId(req, res);
      if (userId == null) return;
      const businessId = await resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const orderId = parseOrderId(
        Array.isArray(req.query.orderId) ? req.query.orderId[0] : req.query.orderId
      );
      if (orderId == null) {
        return res.status(400).json({ error: "Нужен orderId" });
      }

      const order = await assertCustomerOrder(orderId, businessId, userId);
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND });
      }

      const existing = await prisma.supportTicket.findFirst({
        where: {
          businessId,
          userId,
          orderId,
          status: SupportTicketStatus.OPEN,
          type: SupportTicketType.GENERAL,
        },
        orderBy: { id: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          order: { include: { items: true } },
        },
      });

      if (existing) {
        return res.json(jsonWithBigInt(stripInternal(existing, false)));
      }

      const ticket = await prisma.$transaction(async (tx) => {
        const t = await tx.supportTicket.create({
          data: {
            businessId,
            userId,
            orderId,
            type: SupportTicketType.GENERAL,
            status: SupportTicketStatus.OPEN,
          },
        });
        await insertFirstTicketMessages(tx, {
          ticketId: t.id,
          businessId,
          userId,
          type: SupportTicketType.GENERAL,
          text: "",
          order,
        });
        return t;
      });

      const full = await prisma.supportTicket.findFirst({
        where: { id: ticket.id, businessId, userId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          order: { include: { items: true } },
        },
      });
      return res.status(201).json(jsonWithBigInt(stripInternal(full!, false)));
    } catch (e) {
      console.error("GET /support/session:", e);
      res.status(500).json({ error: "Ошибка" });
    }
  });

  app.post("/support/tickets", async (req: Request, res: Response) => {
    try {
      const userId = await customerUserId(req, res);
      if (userId == null) return;
      const businessId = await resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const body = req.body as {
        orderId?: unknown;
        type?: unknown;
        text?: unknown;
      };
      const orderId = parseOrderId(body.orderId);
      const typeRaw = typeof body.type === "string" ? body.type.trim() : "";
      const text =
        typeof body.text === "string" ? body.text.trim().slice(0, 8000) : "";

      if (orderId == null) {
        return res.status(400).json({ error: "Нужен orderId" });
      }
      if (!isTicketType(typeRaw)) {
        return res.status(400).json({ error: "Неверный type тикета" });
      }

      const order = await assertCustomerOrder(orderId, businessId, userId);
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND });
      }

      const ticket = await prisma.$transaction(async (tx) => {
        const t = await tx.supportTicket.create({
          data: {
            businessId,
            userId,
            orderId,
            type: typeRaw,
            status: "OPEN",
          },
        });
        await insertFirstTicketMessages(tx, {
          ticketId: t.id,
          businessId,
          userId,
          type: typeRaw,
          text,
          order,
        });
        return t;
      });

      void createMerchantNotification({
        businessId,
        kind: MerchantNotificationKind.SUPPORT_TICKET,
        title: "Новый тикет поддержки",
        body: text.slice(0, 120) || `Заказ #${orderId}`,
        href: "/admin/support",
      });

      const full = await prisma.supportTicket.findFirst({
        where: { id: ticket.id, businessId, userId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          order: { include: { items: true } },
        },
      });
      return res.status(201).json(jsonWithBigInt(stripInternal(full!, false)));
    } catch (e) {
      console.error("POST /support/tickets:", e);
      res.status(500).json({ error: "Ошибка создания тикета" });
    }
  });

  app.get("/support/tickets/:ticketId", async (req: Request, res: Response) => {
    try {
      const userId = await customerUserId(req, res);
      if (userId == null) return;
      const businessId = await resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const ticketId = parseTicketIdParam(req.params.ticketId);
      if (ticketId == null) {
        return res.status(400).json({ error: "Неверный тикет" });
      }

      const ticket = await prisma.supportTicket.findFirst({
        where: { id: ticketId, businessId, userId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          order: { include: { items: true } },
        },
      });
      if (!ticket) {
        return res.status(404).json({ error: NOT_FOUND });
      }
      return res.json(jsonWithBigInt(stripInternal(ticket, false)));
    } catch (e) {
      console.error("GET /support/tickets/:id:", e);
      res.status(500).json({ error: "Ошибка" });
    }
  });

  app.post(
    "/support/tickets/:ticketId/messages",
    async (req: Request, res: Response) => {
      try {
        const userId = await customerUserId(req, res);
        if (userId == null) return;
        const businessId = await resolveCatalogBusinessId(req, res);
        if (!businessId) return;

        const ticketId = parseTicketIdParam(req.params.ticketId);
        if (ticketId == null) {
          return res.status(400).json({ error: "Неверный тикет" });
        }

        const body = req.body as { text?: unknown; attachments?: unknown };
        const text =
          typeof body.text === "string" ? body.text.trim().slice(0, 8000) : "";
        if (text === "") {
          return res.status(400).json({ error: "Нужен text" });
        }
        let attachments: Prisma.JsonArray = [];
        if (Array.isArray(body.attachments)) {
          attachments = body.attachments.filter(
            (x) => x != null && (typeof x === "string" || typeof x === "object")
          ) as Prisma.JsonArray;
        }

        const ticket = await prisma.supportTicket.findFirst({
          where: { id: ticketId, businessId, userId },
        });
        if (!ticket) {
          return res.status(404).json({ error: NOT_FOUND });
        }
        if (
          ticket.status === "CLOSED" ||
          ticket.status === "RESOLVED"
        ) {
          return res.status(400).json({ error: "Тикет закрыт" });
        }

        await prisma.supportMessage.create({
          data: {
            ticketId,
            businessId,
            senderType: SupportSenderType.CUSTOMER,
            senderId: userId,
            text,
            attachments,
          },
        });
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: {
            status:
              ticket.status === "PENDING_CUSTOMER"
                ? SupportTicketStatus.PENDING_MERCHANT
                : ticket.status,
            updatedAt: new Date(),
          },
        });

        void createMerchantNotification({
          businessId,
          kind: MerchantNotificationKind.SUPPORT_MESSAGE,
          title: "Сообщение от клиента",
          body: text.slice(0, 120),
          href: `/admin/support`,
        });

        const full = await prisma.supportTicket.findFirst({
          where: { id: ticketId, businessId, userId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
            order: { include: { items: true } },
          },
        });
        return res.json(jsonWithBigInt(stripInternal(full!, false)));
      } catch (e) {
        console.error("POST /support/tickets/:id/messages:", e);
        res.status(500).json({ error: "Ошибка" });
      }
    }
  );

  app.post(
    "/support/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const userId = await customerUserId(req, res);
        if (userId == null) return;
        const businessId = await resolveCatalogBusinessId(req, res);
        if (!businessId) return;

        if (!isCloudinaryConfigured()) {
          return res.status(503).json({ error: "Загрузка файлов недоступна" });
        }
        const file = req.file;
        if (!file?.buffer?.length) {
          return res.status(400).json({ error: "Нет файла" });
        }
        const orderId = parseOrderId(
          (req.body as { orderId?: unknown })?.orderId
        );
        if (orderId == null) {
          return res.status(400).json({ error: "Нужен orderId" });
        }
        const order = await assertCustomerOrder(orderId, businessId, userId);
        if (!order) {
          return res.status(404).json({ error: NOT_FOUND });
        }
        const mime = file.mimetype || "";
        if (!mime.startsWith("image/")) {
          return res.status(400).json({ error: "Только изображение" });
        }
        const out = await uploadImageBuffer({
          businessId,
          kind: "support",
          buffer: file.buffer,
          mimetype: mime,
        });
        return res.json({ url: out.url, publicId: out.publicId });
      } catch (e) {
        console.error("POST /support/upload:", e);
        res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  app.get("/support/returns", async (req: Request, res: Response) => {
    try {
      const userId = await customerUserId(req, res);
      if (userId == null) return;
      const businessId = await resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const orderId = parseOrderId(
        Array.isArray(req.query.orderId) ? req.query.orderId[0] : req.query.orderId
      );
      if (orderId == null) {
        return res.status(400).json({ error: "Нужен orderId" });
      }
      const order = await assertCustomerOrder(orderId, businessId, userId);
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND });
      }

      const rows = await prisma.returnRequest.findMany({
        where: { businessId, orderId, userId },
        orderBy: { id: "desc" },
        include: { orderItem: true },
      });
      return res.json(jsonWithBigInt(rows));
    } catch (e) {
      console.error("GET /support/returns:", e);
      res.status(500).json({ error: "Ошибка" });
    }
  });

  app.post("/support/returns", async (req: Request, res: Response) => {
    try {
      const userId = await customerUserId(req, res);
      if (userId == null) return;
      const businessId = await resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const body = req.body as {
        orderId?: unknown;
        orderItemId?: unknown;
        reason?: unknown;
        comment?: unknown;
        photos?: unknown;
      };
      const orderId = parseOrderId(body.orderId);
      const reasonRaw =
        typeof body.reason === "string" ? body.reason.trim() : "";
      const comment =
        typeof body.comment === "string"
          ? body.comment.trim().slice(0, 4000)
          : "";
      const orderItemIdRaw = body.orderItemId;
      const orderItemId =
        orderItemIdRaw === null || orderItemIdRaw === undefined
          ? null
          : parseOrderId(orderItemIdRaw);

      if (orderId == null) {
        return res.status(400).json({ error: "Нужен orderId" });
      }
      if (!isReturnReason(reasonRaw)) {
        return res.status(400).json({ error: "Неверная причина" });
      }

      const order = await assertCustomerOrder(orderId, businessId, userId);
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND });
      }
      if (order.status !== "DELIVERED") {
        return res
          .status(400)
          .json({ error: "Возврат доступен после доставки заказа" });
      }

      if (orderItemId != null) {
        const line = order.items.find((i) => i.id === orderItemId);
        if (!line) {
          return res.status(400).json({ error: "Неверная позиция заказа" });
        }
      }

      let photos: Prisma.JsonArray = [];
      if (Array.isArray(body.photos)) {
        photos = body.photos
          .filter((p) => typeof p === "string" && p.trim() !== "")
          .map((p) => p.trim())
          .slice(0, 8) as unknown as Prisma.JsonArray;
      }

      const created = await prisma.$transaction(async (tx) => {
        const ret = await tx.returnRequest.create({
          data: {
            businessId,
            orderId,
            userId,
            orderItemId,
            reason: reasonRaw,
            comment: comment || null,
            photos,
            status: "PENDING",
          },
        });
        const ticket = await tx.supportTicket.create({
          data: {
            businessId,
            userId,
            orderId,
            type: SupportTicketType.RETURN,
            status: "OPEN",
          },
        });
        await tx.supportMessage.create({
          data: {
            ticketId: ticket.id,
            businessId,
            senderType: SupportSenderType.SYSTEM,
            senderId: null,
            text: `Заявка на возврат #${ret.id} (${reasonRaw}).`,
            attachments: [],
          },
        });
        if (comment) {
          await tx.supportMessage.create({
            data: {
              ticketId: ticket.id,
              businessId,
              senderType: SupportSenderType.CUSTOMER,
              senderId: userId,
              text: comment,
              attachments: photos,
            },
          });
        }
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: { updatedAt: new Date() },
        });
        return ret;
      });

      void createMerchantNotification({
        businessId,
        kind: MerchantNotificationKind.SUPPORT_TICKET,
        title: "Заявка на возврат",
        body: reasonRaw.slice(0, 120),
        href: "/admin/support",
      });

      const full = await prisma.returnRequest.findFirst({
        where: { id: created.id, businessId, userId },
        include: { orderItem: true },
      });
      return res.status(201).json(jsonWithBigInt(full));
    } catch (e) {
      console.error("POST /support/returns:", e);
      res.status(500).json({ error: "Ошибка создания заявки" });
    }
  });

  // ——— Merchant ———

  app.get("/merchant/support/tickets", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.supportManage);
      if (!merchant) return;

      const statusQ = queryParamString(req.query.status);
      const where: Prisma.SupportTicketWhereInput = {
        businessId: merchant.businessId,
      };
      if (statusQ && isTicketStatus(statusQ)) {
        where.status = statusQ;
      }
      const orderId = parseOrderId(
        Array.isArray(req.query.orderId) ? req.query.orderId[0] : req.query.orderId
      );
      if (orderId != null) {
        where.orderId = orderId;
      }

      const tickets = await prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, telegramId: true, name: true } },
          order: { select: { id: true, status: true, total: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      return res.json(jsonWithBigInt(tickets));
    } catch (e) {
      console.error("GET /merchant/support/tickets:", e);
      res.status(500).json({ error: "Ошибка" });
    }
  });

  app.get(
    "/merchant/support/tickets/:ticketId",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.supportManage);
        if (!merchant) return;

        const ticketId = parseTicketIdParam(req.params.ticketId);
        if (ticketId == null) {
          return res.status(400).json({ error: "Неверный тикет" });
        }

        const ticket = await prisma.supportTicket.findFirst({
          where: { id: ticketId, businessId: merchant.businessId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
            order: { include: { items: true, buyerUser: true } },
            user: { select: { id: true, telegramId: true, name: true } },
          },
        });
        if (!ticket) {
          return res.status(404).json({ error: NOT_FOUND });
        }
        return res.json(jsonWithBigInt(ticket));
      } catch (e) {
        console.error("GET /merchant/support/tickets/:id:", e);
        res.status(500).json({ error: "Ошибка" });
      }
    }
  );

  app.get(
    "/merchant/support/tickets/:ticketId/suggestions",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.supportManage);
        if (!merchant) return;

        const ticketId = parseTicketIdParam(req.params.ticketId);
        if (ticketId == null) {
          return res.status(400).json({ error: "Неверный тикет" });
        }

        const ticket = await prisma.supportTicket.findFirst({
          where: { id: ticketId, businessId: merchant.businessId },
          include: {
            order: { select: { status: true } },
          },
        });
        if (!ticket) {
          return res.status(404).json({ error: NOT_FOUND });
        }

        const lastCustomer = await prisma.supportMessage.findFirst({
          where: {
            ticketId,
            businessId: merchant.businessId,
            senderType: SupportSenderType.CUSTOMER,
          },
          orderBy: { createdAt: "desc" },
          select: { text: true },
        });
        const suggestions = buildSupportSuggestions({
          ticketType: ticket.type,
          orderStatus: ticket.order?.status ?? null,
          lastCustomerText: lastCustomer?.text ?? null,
        });
        return res.json({ suggestions });
      } catch (e) {
        console.error("GET /merchant/support/tickets/:id/suggestions:", e);
        res.status(500).json({ error: "Ошибка" });
      }
    }
  );

  app.patch(
    "/merchant/support/tickets/:ticketId",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.supportManage);
        if (!merchant) return;

        const ticketId = parseTicketIdParam(req.params.ticketId);
        if (ticketId == null) {
          return res.status(400).json({ error: "Неверный тикет" });
        }

        const body = req.body as {
          status?: unknown;
          internalNote?: unknown;
        };
        const hasStatus =
          body.status !== undefined &&
          body.status !== null &&
          String(body.status).trim() !== "";
        const hasNote = Object.prototype.hasOwnProperty.call(
          body,
          "internalNote"
        );

        if (!hasStatus && !hasNote) {
          return res.status(400).json({ error: "Нет полей для обновления" });
        }

        const existing = await prisma.supportTicket.findFirst({
          where: { id: ticketId, businessId: merchant.businessId },
        });
        if (!existing) {
          return res.status(404).json({ error: NOT_FOUND });
        }

        let newStatus = existing.status;
        if (hasStatus) {
          const st = String(body.status).trim();
          if (!isTicketStatus(st)) {
            return res.status(400).json({ error: "Неверный status" });
          }
          newStatus = st;
        }

        const internalNote = hasNote
          ? body.internalNote === null || body.internalNote === undefined
            ? null
            : String(body.internalNote).slice(0, 8000)
          : undefined;

        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.supportTicket.update({
            where: { id: ticketId },
            data: {
              ...(hasStatus ? { status: newStatus } : {}),
              ...(internalNote !== undefined ? { internalNote } : {}),
              updatedAt: new Date(),
            },
          });
          if (hasStatus && newStatus !== existing.status) {
            await tx.supportMessage.create({
              data: {
                ticketId,
                businessId: merchant.businessId,
                senderType: SupportSenderType.SYSTEM,
                senderId: null,
                text: `Статус тикета: ${newStatus}`,
                attachments: [],
              },
            });
          }
          return u;
        });

        const full = await prisma.supportTicket.findFirst({
          where: { id: updated.id, businessId: merchant.businessId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
            order: { include: { items: true, buyerUser: true } },
            user: { select: { id: true, telegramId: true, name: true } },
          },
        });
        return res.json(jsonWithBigInt(full));
      } catch (e) {
        console.error("PATCH /merchant/support/tickets/:id:", e);
        res.status(500).json({ error: "Ошибка" });
      }
    }
  );

  app.post(
    "/merchant/support/tickets/:ticketId/messages",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.supportManage);
        if (!merchant) return;

        const telegramId = telegramIdFromRequest(req);
        if (!telegramId) {
          return res.status(400).json({ error: "Нужен userId (Telegram)" });
        }
        const staffUser = await prisma.user.findUnique({
          where: { telegramId },
          select: { id: true },
        });
        if (!staffUser) {
          return res.status(403).json({ error: "Нет доступа" });
        }

        const ticketId = parseTicketIdParam(req.params.ticketId);
        if (ticketId == null) {
          return res.status(400).json({ error: "Неверный тикет" });
        }

        const body = req.body as { text?: unknown };
        const text =
          typeof body.text === "string" ? body.text.trim().slice(0, 8000) : "";
        if (text === "") {
          return res.status(400).json({ error: "Нужен text" });
        }

        const ticket = await prisma.supportTicket.findFirst({
          where: { id: ticketId, businessId: merchant.businessId },
        });
        if (!ticket) {
          return res.status(404).json({ error: NOT_FOUND });
        }

        await prisma.supportMessage.create({
          data: {
            ticketId,
            businessId: merchant.businessId,
            senderType: SupportSenderType.MERCHANT,
            senderId: staffUser.id,
            text,
            attachments: [],
          },
        });
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: {
            status:
              ticket.status === "PENDING_MERCHANT"
                ? SupportTicketStatus.PENDING_CUSTOMER
                : ticket.status,
            updatedAt: new Date(),
          },
        });

        const full = await prisma.supportTicket.findFirst({
          where: { id: ticketId, businessId: merchant.businessId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
            order: { include: { items: true, buyerUser: true } },
            user: { select: { id: true, telegramId: true, name: true } },
          },
        });
        return res.json(jsonWithBigInt(full));
      } catch (e) {
        console.error("POST /merchant/support/tickets/:id/messages:", e);
        res.status(500).json({ error: "Ошибка" });
      }
    }
  );

  app.get("/merchant/support/returns", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.supportManage);
      if (!merchant) return;

      const statusQ = queryParamString(req.query.status);
      const where: Prisma.ReturnRequestWhereInput = {
        businessId: merchant.businessId,
      };
      if (statusQ && isReturnStatus(statusQ)) {
        where.status = statusQ;
      }

      const rows = await prisma.returnRequest.findMany({
        where,
        orderBy: { id: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, telegramId: true, name: true } },
          order: { select: { id: true, status: true, total: true } },
          orderItem: true,
        },
      });
      return res.json(jsonWithBigInt(rows));
    } catch (e) {
      console.error("GET /merchant/support/returns:", e);
      res.status(500).json({ error: "Ошибка" });
    }
  });

  app.patch(
    "/merchant/support/returns/:returnId",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.supportManage);
        if (!merchant) return;

        const returnId = parseTicketIdParam(req.params.returnId);
        if (returnId == null) {
          return res.status(400).json({ error: "Неверная заявка" });
        }

        const body = req.body as { status?: unknown; refundAmount?: unknown };
        const statusRaw =
          typeof body.status === "string" ? body.status.trim() : "";
        if (!isReturnStatus(statusRaw)) {
          return res.status(400).json({ error: "Нужен допустимый status" });
        }

        const existing = await prisma.returnRequest.findFirst({
          where: { id: returnId, businessId: merchant.businessId },
        });
        if (!existing) {
          return res.status(404).json({ error: NOT_FOUND });
        }

        if (!allowedReturnTransition(existing.status, statusRaw)) {
          return res.status(400).json({ error: "Неверный переход статуса" });
        }

        let refundAmount: number | null | undefined = undefined;
        if (Object.prototype.hasOwnProperty.call(body, "refundAmount")) {
          const r = body.refundAmount;
          if (r === null || r === undefined || r === "") {
            refundAmount = null;
          } else {
            const n = Number(r);
            if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
              return res.status(400).json({ error: "Неверная сумма возврата" });
            }
            refundAmount = n;
          }
        }

        if (statusRaw === "REFUNDED" && refundAmount === undefined) {
          refundAmount = existing.refundAmount ?? null;
        }

        const updated = await prisma.returnRequest.update({
          where: { id: returnId },
          data: {
            status: statusRaw,
            ...(refundAmount !== undefined ? { refundAmount } : {}),
          },
          include: {
            user: { select: { id: true, telegramId: true, name: true } },
            order: { select: { id: true, status: true, total: true } },
            orderItem: true,
          },
        });
        return res.json(jsonWithBigInt(updated));
      } catch (e) {
        console.error("PATCH /merchant/support/returns/:id:", e);
        res.status(500).json({ error: "Ошибка" });
      }
    }
  );
}

function queryParamString(raw: unknown): string | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t === "" ? null : t;
}
