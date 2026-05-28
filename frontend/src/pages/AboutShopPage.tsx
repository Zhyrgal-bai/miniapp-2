import type { ReactElement } from "react";
import "../components/ui/FAQPage.css";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { TableBookingCta } from "../components/tableBooking/TableBookingCta";
import "../components/tableBooking/tableBooking.css";

export default function AboutShopPage(): ReactElement {
  const { payload } = useStorefrontPayload();
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };
  const title = readTxt("titleAboutShop", "О магазине");
  const lead = readTxt(
    "aboutShopLead",
    "Мы рады видеть вас в нашем магазине. Здесь вы найдёте актуальный каталог и удобное оформление заказа прямо в Telegram.",
  );
  const storeName =
    payload?.storeName && payload.storeName.trim() !== ""
      ? payload.storeName.trim()
      : readTxt("aboutShopNameFallback", "Наш магазин");
  const showTableBooking = businessTypeSupportsTableReservations(payload?.businessType);

  return (
    <div className="faq faq-page about-shop-page">
      <h1 className="faq-page__title">🏪 {title}</h1>
      <div className="faq-page__list">
        <section className="faq-page__card">
          <h2 className="faq-page__card-title">{storeName}</h2>
          <p className="faq-page__card-body">{lead}</p>
        </section>
        {showTableBooking ? (
          <section className="faq-page__card faq-page__card--flush">
            <TableBookingCta
              onPress={() => window.dispatchEvent(new CustomEvent("sf:openTableBooking"))}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
