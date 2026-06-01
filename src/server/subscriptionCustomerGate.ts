import type { Response } from "express";
import {
  type SubscriptionGateFields,
  customerOrdersRejectionReason,
} from "./subscriptionAccess.js";

/** Ответить 403/404, если покупательские операции запрещены. Возвращает true, если ответ уже отправлен. */
export function rejectUnlessCanAcceptCustomerOrders(
  res: Response,
  business: SubscriptionGateFields | null | undefined,
): boolean {
  const reason = customerOrdersRejectionReason(business);
  if (reason == null) return false;
  const status = business == null ? 404 : 403;
  res.status(status).json({ error: reason });
  return true;
}
