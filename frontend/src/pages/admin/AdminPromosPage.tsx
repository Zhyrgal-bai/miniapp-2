import PromoCodesPanel from "../../components/admin/PromoCodesPanel";

export default function AdminPromosPage() {
  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Промокоды</h1>
        <p className="admin-dash-page__subtitle">
          Создавайте коды со скидкой и лимитом использований. Покупатель вводит код при
          оформлении заказа.
        </p>
      </header>
      <div className="admin-dash-card">
        <PromoCodesPanel />
      </div>
    </div>
  );
}
