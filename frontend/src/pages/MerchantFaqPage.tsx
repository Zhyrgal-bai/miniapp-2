import { useNavigate } from "react-router-dom";
import { ArchaFaqView } from "../components/faq/ArchaFaqView";
import {
  ARCHA_FAQ_CATEGORIES,
  ARCHA_FAQ_ITEMS,
  ARCHA_FAQ_SUPPORT_TELEGRAM_URL,
} from "../content/archaFaqContent";
import "./MerchantFaqPage.css";

export default function MerchantFaqPage() {
  const navigate = useNavigate();

  return (
    <div className="merchant-faq-page">
      <header className="merchant-faq-page__top">
        <button
          type="button"
          className="merchant-faq-page__back"
          onClick={() => navigate(-1)}
        >
          ← Назад
        </button>
      </header>
      <ArchaFaqView
        className="archa-faq--platform"
        title="Вопросы и ответы"
        subtitle="Всё для старта и работы магазина на ARCHA"
        items={ARCHA_FAQ_ITEMS}
        categories={ARCHA_FAQ_CATEGORIES}
        supportTelegramUrl={ARCHA_FAQ_SUPPORT_TELEGRAM_URL}
      />
    </div>
  );
}
