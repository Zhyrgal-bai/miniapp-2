import { Prisma } from "@prisma/client";
import { logPrismaError } from "./db.js";
import { emitStructuredLog } from "./structuredLog.js";

export type CheckoutStepName =
  | "validated"
  | "pricing"
  | "promo"
  | "customer"
  | "cooldown"
  | "duplicate_check"
  | "order_number"
  | "order_created"
  | "stock_reserved"
  | "delivery_init"
  | "payment_session";

export function logCheckoutStep(fields: {
  step: CheckoutStepName;
  phase: "start" | "ok" | "fail";
  businessId: number;
  correlationId?: string;
  orderId?: number;
  detail?: string;
  error?: string;
}): void {
  emitStructuredLog(
    fields.phase === "fail" ? "error" : "info",
    "checkout_step",
    fields,
  );
}

export async function runCheckoutStep<T>(
  step: CheckoutStepName,
  businessId: number,
  fn: () => Promise<T>,
  ctx?: { correlationId?: string; orderId?: number },
): Promise<T> {
  logCheckoutStep({
    step,
    phase: "start",
    businessId,
    ...(ctx?.correlationId ? { correlationId: ctx.correlationId } : {}),
    ...(ctx?.orderId != null ? { orderId: ctx.orderId } : {}),
  });
  try {
    const result = await fn();
    logCheckoutStep({
      step,
      phase: "ok",
      businessId,
      ...(ctx?.correlationId ? { correlationId: ctx.correlationId } : {}),
      ...(ctx?.orderId != null ? { orderId: ctx.orderId } : {}),
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logCheckoutStep({
      step,
      phase: "fail",
      businessId,
      error: msg,
      ...(ctx?.correlationId ? { correlationId: ctx.correlationId } : {}),
      ...(ctx?.orderId != null ? { orderId: ctx.orderId } : {}),
    });
    throw err;
  }
}

function migrationHintFromPrisma(err: Prisma.PrismaClientKnownRequestError): string | null {
  const meta = err.meta ?? {};
  const table =
    typeof meta.table === "string"
      ? meta.table
      : typeof meta.modelName === "string"
        ? meta.modelName
        : null;
  const column = typeof meta.column === "string" ? meta.column : null;

  if (err.code === "P2021") {
    return table
      ? `База данных не обновлена: отсутствует таблица «${table}». Администратору нужно выполнить миграции.`
      : "База данных не обновлена: отсутствует таблица. Администратору нужно выполнить миграции.";
  }
  if (err.code === "P2022") {
    return column
      ? `База данных не обновлена: отсутствует колонка «${column}». Администратору нужно выполнить миграции.`
      : "База данных не обновлена: отсутствует колонка. Администратору нужно выполнить миграции.";
  }
  return null;
}

/** Map checkout failures to safe RU client messages (no stack traces). */
export function surfaceCheckoutError(
  err: unknown,
  context: string,
): { statusCode: number; error: string; internalCode?: string } {
  logPrismaError(context, err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const migrationHint = migrationHintFromPrisma(err);
    if (migrationHint) {
      return {
        statusCode: 503,
        error: migrationHint,
        internalCode: err.code,
      };
    }
    if (err.code === "P2002") {
      return {
        statusCode: 409,
        error: "Конфликт при создании заказа. Попробуйте ещё раз.",
        internalCode: err.code,
      };
    }
    if (err.code === "P2034") {
      return {
        statusCode: 503,
        error: "Временная ошибка базы данных. Попробуйте ещё раз.",
        internalCode: err.code,
      };
    }
    if (err.code === "P2025") {
      return {
        statusCode: 409,
        error: "Данные заказа устарели. Обновите корзину и попробуйте снова.",
        internalCode: err.code,
      };
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: 503,
      error: "Сервис базы данных временно недоступен. Попробуйте позже.",
      ...(err.errorCode ? { internalCode: err.errorCode } : {}),
    };
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 400,
      error: "Некорректные данные заказа. Обновите корзину и попробуйте снова.",
      internalCode: "validation",
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("column") &&
    (lower.includes("does not exist") || lower.includes("не существует"))
  ) {
    return {
      statusCode: 503,
      error:
        "База данных не обновлена (отсутствует колонка). Администратору нужно выполнить миграции.",
      internalCode: "schema_column",
    };
  }
  if (
    lower.includes("relation") &&
    (lower.includes("does not exist") || lower.includes("не существует"))
  ) {
    return {
      statusCode: 503,
      error:
        "База данных не обновлена (отсутствует таблица). Администратору нужно выполнить миграции.",
      internalCode: "schema_table",
    };
  }

  return {
    statusCode: 500,
    error: "Не удалось оформить заказ. Попробуйте ещё раз или обратитесь в поддержку.",
    internalCode: "unknown",
  };
}
