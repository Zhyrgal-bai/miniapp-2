import { Link } from "react-router-dom";
import { ARCHA_BRAND } from "../../../config/brandAssets";

type Props = {
  slug?: string | null;
  message?: string | null;
  onRetry?: () => void;
};

export default function StoreNotFoundScreen({
  slug,
  message,
  onRetry,
}: Props): React.ReactElement {
  const slugLabel = slug?.trim() ?? "";
  const detail =
    message?.trim() ||
    "Магазин не найден. Проверьте ссылку или откройте витрину через Telegram.";

  return (
    <div className="app app--store-not-found">
      <div className="store-not-found" role="alert">
        <div
          className="store-not-found__bg"
          style={{ backgroundImage: `url(${ARCHA_BRAND.background})` }}
          aria-hidden
        />
        <div className="store-not-found__inner">
          <img
            className="store-not-found__logo"
            src={ARCHA_BRAND.logoMark}
            alt={ARCHA_BRAND.name}
            width={96}
            height={96}
          />
          <p className="store-not-found__code">404</p>
          <h1 className="store-not-found__title">Магазин не найден</h1>
          {slugLabel !== "" ? (
            <p className="store-not-found__slug">
              <code>{slugLabel}</code>
            </p>
          ) : null}
          <p className="store-not-found__hint">{detail}</p>
          <div className="store-not-found__actions">
            {onRetry ? (
              <button type="button" className="store-not-found__btn store-not-found__btn--primary" onClick={onRetry}>
                Повторить
              </button>
            ) : null}
            <Link to="/merchant" className="store-not-found__btn store-not-found__btn--ghost">
              На ARCHA
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
