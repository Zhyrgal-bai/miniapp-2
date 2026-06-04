import { ArchaFaqView } from "../components/faq/ArchaFaqView";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";

export default function FAQ() {
  const { payload } = useStorefrontPayload();
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  return (
    <ArchaFaqView
      title={readTxt("titleFaq", "Вопросы и ответы")}
      subtitle="ARCHA для владельцев магазинов — регистрация, оплата, доставка и Telegram Mini App"
    />
  );
}
