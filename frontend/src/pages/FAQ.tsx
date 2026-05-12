import "../components/ui/FAQPage.css";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";

const FAQ_ITEMS = [
  {
    title: "Как заказать?",
    body: "Выберите товар, размер и цвет, добавьте в корзину и оформите заказ.",
  },
  {
    title: "Как оплатить?",
    body: "После принятия заказа вы получите реквизиты и сможете оплатить удобным способом.",
  },
  {
    title: "Сколько доставка?",
    body: "По Бишкеку 1–2 часа. Точные условия согласуем при оформлении.",
  },
  {
    title: "Как связаться?",
    body: "Нажмите «Поддержка» в меню и напишите нам в Telegram.",
  },
] as const;

export default function FAQ() {
  const { payload } = useStorefrontPayload();
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };
  const pageTitle = readTxt("titleFaq", "FAQ");

  return (
    <div className="faq faq-page">
      <h1 className="faq-page__title">❓ {pageTitle}</h1>

      <div className="faq-page__list">
        {FAQ_ITEMS.map((item) => (
          <section key={item.title} className="faq-page__card">
            <h2 className="faq-page__card-title">{item.title}</h2>
            <p className="faq-page__card-body">{item.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
