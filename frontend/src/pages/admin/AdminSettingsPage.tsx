import PaymentDetailsPanel from "../../components/admin/PaymentDetailsPanel";
import PromoCodesPanel from "../../components/admin/PromoCodesPanel";

export default function AdminSettingsPage() {
  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Настройки</h1>
        <p className="admin-dash-page__subtitle">
          Реквизиты для оплаты и промокоды.
        </p>
      </header>

      <section className="admin-dash-section">
        <h2 className="admin-dash-section__title">Товары</h2>
        <div className="admin-dash-card admin-pm-settings-card">
          <p className="admin-form-hint admin-pm-settings-hint">
            Редактирование цен, фото, вариантов и скидок.
          </p>
          <a href="#/admin/products/manage" className="admin-pm-cta">
            Управление товарами
          </a>
        </div>
      </section>

      <section className="admin-dash-section">
        <div className="admin-dash-card">
          <PaymentDetailsPanel />
        </div>
      </section>

      <section className="admin-dash-section">
        <div className="admin-dash-card">
          <PromoCodesPanel />
        </div>
      </section>
    </div>
  );
}
