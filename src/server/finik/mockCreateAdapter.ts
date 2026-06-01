import type {
  FinikCreateContext,
  FinikCreatePort,
  FinikCreateResult,
} from "./finikCreateTypes.js";

export const mockCreateAdapter: FinikCreatePort = {
  apiMode: "mock",

  async createPaymentSession(ctx: FinikCreateContext): Promise<FinikCreateResult> {
    const suffix =
      ctx.flow === "storefront_order"
        ? ctx.orderId
        : ctx.externalId.replace(/[^\w-]/g, "_");
    const paymentId = `finik_mock_${Date.now()}_${suffix}`;
    const paymentUrl = `https://pay.finik.kg/?amount=${ctx.amount}&orderId=${encodeURIComponent(paymentId)}`;
    return { ok: true, paymentId, paymentUrl, apiMode: "mock" };
  },
};
