import {
  customerOrderActions,
  orderCommercePhase,
  type CustomerOrderAction,
} from "@repo-shared/orderCommerce";
import "./supportUi.css";

type OrderCustomerActionsProps = {
  orderStatus: string;
  busy?: boolean;
  onAction: (action: CustomerOrderAction) => void;
};

export function OrderCustomerActions({
  orderStatus,
  busy = false,
  onAction,
}: OrderCustomerActionsProps) {
  const phase = orderCommercePhase(orderStatus);
  const actions = customerOrderActions(phase);

  return (
    <div className="sf-order-actions" role="group" aria-label="Действия по заказу">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className="sf-order-actions__btn"
          disabled={busy}
          onClick={() => onAction(action)}
        >
          {action.label}
          {action.description ? (
            <span className="sf-order-actions__btn-desc">{action.description}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
