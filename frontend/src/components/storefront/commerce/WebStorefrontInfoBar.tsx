import type { ReactElement } from "react";
import type { StorefrontStoreAddress } from "../StorefrontRenderer";
import { OpenInTelegramCta } from "./OpenInTelegramCta";

function formatAddress(addr: StorefrontStoreAddress): string {
  const city = addr.city.trim();
  const line = addr.addressLine.trim();
  if (city !== "" && line !== "") return `${city}, ${line}`;
  return city || line;
}

export function WebStorefrontInfoBar(props: {
  storeName?: string;
  storeAddress?: StorefrontStoreAddress;
  telegramOpenUrl?: string | null;
}): ReactElement {
  const name = String(props.storeName ?? "").trim();
  const addressText =
    props.storeAddress != null ? formatAddress(props.storeAddress) : "";

  return (
    <section className="sf-section sf-section--web-info sf-section--padded">
      <div className="sf-web-info">
        <p className="sf-web-info__kicker">📱 Полный функционал доступен в Telegram</p>
        {name !== "" ? <h2 className="sf-web-info__name">{name}</h2> : null}
        {addressText !== "" ? (
          <p className="sf-web-info__address">{addressText}</p>
        ) : null}
        <ul className="sf-web-info__features">
          <li>Заказы</li>
          <li>Оплата</li>
          <li>История заказов</li>
          <li>Уведомления</li>
        </ul>
        <OpenInTelegramCta
          telegramOpenUrl={props.telegramOpenUrl}
          variant="hero"
        />
      </div>
    </section>
  );
}
