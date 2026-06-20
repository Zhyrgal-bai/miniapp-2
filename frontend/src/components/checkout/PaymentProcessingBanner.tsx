import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearPendingFinikOrder,
  readPendingFinikOrder,
  releasePendingFinikCheckout,
} from "../../utils/pendingFinikOrder";
import {
  dispatchFinikPaymentPaid,
  FINIK_PAYMENT_POLL_MS,
  FINIK_PAYMENT_TIMEOUT_MS,
} from "../../utils/finikPaymentEvents";
import { fetchMyOrders } from "../../services/myOrdersApi";
import { getTelegramWebAppUserId } from "../../utils/telegram";
import { buildCatalogRequestParams } from "../../utils/storeParams";
import { openTelegramExternalLink } from "../../utils/telegramWebAppBootstrap";
import { t } from "../../i18n";
import "./PaymentProcessingBanner.css";

const PAID_STATUSES = new Set(["CONFIRMED", "SHIPPED", "DELIVERED"]);

type BannerState = "checking" | "success" | "failed" | "hidden";

type Props = {
  businessId: number | null;
  onViewOrders?: () => void;
};

/** Polls order status after Finik redirect; shows success / retry UI. */
export default function PaymentProcessingBanner({
  businessId,
  onViewOrders,
}: Props) {
  const [state, setState] = useState<BannerState>("hidden");
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<(() => Promise<void>) | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const tick = async () => {
      const pend = readPendingFinikOrder();
      if (
        pend == null ||
        businessId == null ||
        pend.businessId !== businessId
      ) {
        setState("hidden");
        stopPoll();
        return;
      }

      if (Date.now() - pend.startedAt > FINIK_PAYMENT_TIMEOUT_MS) {
        releasePendingFinikCheckout();
        setState("failed");
        stopPoll();
        return;
      }

      setState((prev) => (prev === "success" ? prev : "checking"));

      const uid = getTelegramWebAppUserId();
      if (!Number.isFinite(uid) || uid <= 0) return;

      try {
        const rows = await fetchMyOrders(uid, buildCatalogRequestParams().shop);
        const order = rows.find((o) => o.id === pend.orderId);
        if (!order) return;

        const st = String(order.status ?? "").toUpperCase();
        if (PAID_STATUSES.has(st)) {
          setState("success");
          clearPendingFinikOrder();
          stopPoll();
          dispatchFinikPaymentPaid({
            orderId: pend.orderId,
            businessId: pend.businessId,
          });
        } else if (st === "CANCELLED") {
          releasePendingFinikCheckout();
          setState("failed");
          stopPoll();
        }
      } catch {
        /* keep polling */
      }
    };

    tickRef.current = tick;
    void tick();
    pollRef.current = window.setInterval(() => void tick(), FINIK_PAYMENT_POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        void tickRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const onPollTick = () => void tickRef.current?.();
    window.addEventListener("sf:paymentPollTick", onPollTick);

    return () => {
      stopPoll();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("sf:paymentPollTick", onPollTick);
    };
  }, [businessId, stopPoll]);

  const handleRetry = () => {
    const pend = readPendingFinikOrder();
    if (pend?.paymentUrl) {
      openTelegramExternalLink(pend.paymentUrl);
      setState("checking");
      return;
    }
    onViewOrders?.();
  };

  const handleDismissSuccess = () => {
    setState("hidden");
    onViewOrders?.();
  };

  const handleDismissFailed = () => {
    releasePendingFinikCheckout();
    setState("hidden");
  };

  if (state === "hidden") return null;

  return (
    <div
      className={`payment-processing-banner payment-processing-banner--${state}`}
      role="status"
      aria-live="polite"
    >
      {state === "checking" && (
        <>
          <span className="payment-processing-banner__dot" aria-hidden />
          <span>{t("checkout.paymentProcessing")}</span>
        </>
      )}
      {state === "success" && (
        <>
          <span className="payment-processing-banner__icon" aria-hidden>
            ✓
          </span>
          <span>{t("checkout.paymentSuccess")}</span>
          <button
            type="button"
            className="payment-processing-banner__action"
            onClick={handleDismissSuccess}
          >
            {t("checkout.paymentViewOrders")}
          </button>
        </>
      )}
      {state === "failed" && (
        <>
          <span className="payment-processing-banner__icon" aria-hidden>
            !
          </span>
          <span>{t("checkout.paymentFailed")}</span>
          <button
            type="button"
            className="payment-processing-banner__action"
            onClick={handleRetry}
          >
            {t("checkout.paymentRetry")}
          </button>
          <button
            type="button"
            className="payment-processing-banner__action payment-processing-banner__action--ghost"
            onClick={handleDismissFailed}
          >
            {t("common.cancel")}
          </button>
        </>
      )}
    </div>
  );
}
