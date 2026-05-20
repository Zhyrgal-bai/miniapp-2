import { useEffect, useState } from "react";
import { readPendingFinikOrder } from "../../utils/pendingFinikOrder";
import { t } from "../../i18n";
import "./PaymentProcessingBanner.css";

type Props = {
  businessId: number | null;
};

/** Shown while Finik payment is being confirmed after return to Mini App. */
export default function PaymentProcessingBanner({ businessId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const tick = () => {
      const pend = readPendingFinikOrder();
      setVisible(
        pend != null &&
          businessId != null &&
          pend.businessId === businessId,
      );
    };
    tick();
    const id = window.setInterval(tick, 1500);
    return () => window.clearInterval(id);
  }, [businessId]);

  if (!visible) return null;

  return (
    <div className="payment-processing-banner" role="status" aria-live="polite">
      <span className="payment-processing-banner__dot" aria-hidden />
      <span>{t("checkout.paymentProcessing")}</span>
    </div>
  );
}
