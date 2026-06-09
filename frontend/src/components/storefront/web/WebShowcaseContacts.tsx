import type { WebProfileView } from "../../../utils/webProfileUx";
import { resolveSocialLinks } from "../../../utils/webProfileUx";
import "./webShowcase.css";

type StoreAddress = {
  addressLine: string;
  city: string;
};

type Props = {
  profile: WebProfileView | null;
  storeAddress?: StoreAddress | null;
  telegramOpenUrl?: string | null;
};

/** Public contacts + social + Telegram CTA block (web mode only). */
export function WebShowcaseContacts({
  profile,
  storeAddress,
  telegramOpenUrl,
}: Props): React.ReactElement | null {
  const socials = resolveSocialLinks(profile);
  const hasAddress = storeAddress != null && storeAddress.addressLine.trim() !== "";
  if (socials.length === 0 && !hasAddress && !telegramOpenUrl) return null;

  return (
    <section className="sf-showcase-contacts" aria-label="Контакты">
      <h2 className="sf-showcase-contacts__title">Контакты</h2>
      {hasAddress ? (
        <p className="sf-showcase-contacts__address">
          {storeAddress!.addressLine}
          {storeAddress!.city ? `, ${storeAddress!.city}` : ""}
        </p>
      ) : null}
      {socials.length > 0 ? (
        <div className="sf-showcase-contacts__socials">
          {socials.map((s) => (
            <a
              key={s.id}
              className="sf-showcase-contacts__social"
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.label}
            </a>
          ))}
        </div>
      ) : null}
      {telegramOpenUrl ? (
        <a
          className="sf-showcase-contacts__tg"
          href={telegramOpenUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть в Telegram
        </a>
      ) : null}
    </section>
  );
}
