import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  CheckoutStepError,
  checkoutFailureResponse,
  surfaceCheckoutError,
} from "../../src/server/checkoutErrorSurface.js";

describe("surfaceCheckoutError", () => {
  it("maps missing table to RU migration hint", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Table not found", {
      code: "P2021",
      clientVersion: "5.22.0",
      meta: { table: "ProductStock" },
    });
    const out = surfaceCheckoutError(err, "test");
    expect(out.statusCode).toBe(503);
    expect(out.error).toContain("ProductStock");
    expect(out.error).toContain("миграц");
  });

  it("maps missing column to RU migration hint", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Column not found", {
      code: "P2022",
      clientVersion: "5.22.0",
      meta: { column: "options" },
    });
    const out = surfaceCheckoutError(err, "test");
    expect(out.statusCode).toBe(503);
    expect(out.error).toContain("options");
  });

  it("maps unique constraint to conflict message", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "5.22.0",
      meta: {},
    });
    const out = surfaceCheckoutError(err, "test");
    expect(out.statusCode).toBe(409);
    expect(out.error).toContain("Конфликт");
  });

  it("does not expose stack traces in client message", () => {
    const err = new Error("secret internal at foo.ts:99");
    const out = surfaceCheckoutError(err, "test");
    expect(out.error).not.toContain("foo.ts");
    expect(out.error).not.toContain("secret internal");
  });

  it("checkoutFailureResponse includes failedStep from CheckoutStepError", () => {
    const prismaErr = new Prisma.PrismaClientValidationError("bad field", {
      clientVersion: "5.22.0",
    });
    const wrapped = new CheckoutStepError("stock_reserved", prismaErr);
    const out = checkoutFailureResponse(wrapped, "test");
    expect(out.statusCode).toBe(400);
    expect(out.body.failedStep).toBe("stock_reserved");
    expect(out.body.error).toContain("Некорректные данные заказа");
  });
});

describe("coffee checkout options validation (lenient)", () => {
  it("accepts empty options when volume is in size column", async () => {
    const { validateOrderOptionsForCheckout } = await import(
      "../../src/server/templateValidation.js"
    );
    const v = validateOrderOptionsForCheckout("coffee" as any, {});
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.sugar).toBe("50");
    }
  });

  it("accepts hot/cold order options", async () => {
    const { validateOrderOptionsForCheckout } = await import(
      "../../src/server/templateValidation.js"
    );
    const v = validateOrderOptionsForCheckout("coffee" as any, {
      hotOrCold: "hot",
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.hotOrCold).toBe("hot");
    }
  });
});
