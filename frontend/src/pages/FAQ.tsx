import { useMemo } from "react";
import { ArchaFaqView } from "../components/faq/ArchaFaqView";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import {
  buildStoreFaqItems,
  STORE_FAQ_CATEGORIES,
} from "../content/storeFaqContent";

export default function FAQ() {
  const { payload } = useStorefrontPayload();
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  const items = useMemo(
    () =>
      buildStoreFaqItems({
        storeName: payload?.storeName ?? undefined,
      }),
    [payload?.storeName],
  );

  return (
    <ArchaFaqView
      title={readTxt("titleFaq", "Вопросы и ответы")}
      subtitle="Помощь покупателям этого магазина"
      items={items}
      categories={STORE_FAQ_CATEGORIES}
      showSupportCta={false}
    />
  );
}
