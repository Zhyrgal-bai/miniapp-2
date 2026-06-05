import { useEffect, useState } from "react";
import { ARCHA_BRAND } from "../../config/brandAssets";

type Props = {
  message?: string | null;
  onRetry?: () => void;
  /** Show slow hint + retry after this many ms. */
  slowAfterMs?: number;
  /** Platform splash (ARCHA) vs minimal tenant loader. */
  variant?: "platform" | "tenant";
};

export default function TenantBootScreen({
  message = "Открываем витрину…",
  onRetry,
  slowAfterMs = 12_000,
  variant = "tenant",
}: Props): React.ReactElement {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(t);
  }, [slowAfterMs]);

  if (variant === "platform") {
    return (
      <div className="tenant-boot tenant-boot--platform" role="status" aria-live="polite">
        <div
          className="tenant-boot__platform-bg"
          style={{ backgroundImage: `url(${ARCHA_BRAND.background})` }}
          aria-hidden
        />
        <div className="tenant-boot__platform-inner">
          <img
            className="tenant-boot__platform-logo"
            src={ARCHA_BRAND.logoMark}
            alt={ARCHA_BRAND.name}
            width={120}
            height={120}
          />
          <p className="tenant-boot__platform-name">{ARCHA_BRAND.name}</p>
          <p className="tenant-boot__platform-tagline">{ARCHA_BRAND.tagline}</p>
          {message ? <p className="tenant-boot__message tenant-boot__message--platform">{message}</p> : null}
          <div className="tenant-boot__spinner tenant-boot__spinner--platform" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-boot" role="status" aria-live="polite">
      <img
        className="tenant-boot__mark"
        src={ARCHA_BRAND.favicon}
        alt=""
        width={48}
        height={48}
        aria-hidden
      />
      <p className="tenant-boot__name">{ARCHA_BRAND.name}</p>
      <div className="tenant-boot__spinner" aria-hidden />
      <p className="tenant-boot__message">{message}</p>
      {slow ? (
        <>
          <p className="tenant-boot__hint">
            Загрузка занимает дольше обычного. Проверьте интернет или подождите ещё немного.
          </p>
          {onRetry ? (
            <button type="button" className="tenant-boot__retry" onClick={onRetry}>
              Повторить
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
