import StoreThemeEditor from "../../components/admin/StoreThemeEditor";
import { InlineDesignStudio } from "./InlineDesignStudio";

export default function AdminSettingsPage() {
  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Оформление витрины</h1>
        <p className="admin-dash-page__subtitle">
          Design Studio: тема, шрифты, плотность и визуальный конструктор секций.
        </p>
      </header>

      <section className="admin-dash-section">
        <div className="admin-dash-card">
          <StoreThemeEditor />
        </div>
      </section>

      <section className="admin-dash-section">
        <div className="admin-dash-card">
          <h3 className="admin-dash-section__title">Design Studio (новое)</h3>
          <p className="admin-form-hint">
            Здесь те самые новые настройки: Presets / Hero / Layout / Typography / Chips / Buttons / Cart / Drawer.
          </p>
          <InlineDesignStudio />
        </div>
      </section>

      <section className="admin-dash-section">
        <div className="admin-dash-card admin-pm-settings-card">
          <p className="admin-form-hint admin-pm-settings-hint">
            Откройте визуальный конструктор — изменения сразу видны в preview.
          </p>
          <a href="#/merchant/builder" className="admin-pm-cta">
            Открыть конструктор витрины
          </a>
        </div>
      </section>
    </div>
  );
}
