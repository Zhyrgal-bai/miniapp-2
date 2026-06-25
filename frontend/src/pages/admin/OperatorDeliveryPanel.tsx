import DeliveryPage from "./DeliveryPage";

type OperatorDeliveryPanelProps = {
  operatorToken: string;
};

export default function OperatorDeliveryPanel({
  operatorToken,
}: OperatorDeliveryPanelProps) {
  return (
    <DeliveryPage
      mode="operator"
      operatorToken={operatorToken}
      canManageSettings={false}
    />
  );
}
