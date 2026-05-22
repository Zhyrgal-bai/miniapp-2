import { useEffect, useState } from "react";

type Props = {
  message?: string | null;
  onRetry?: () => void;
  /** Show slow hint + retry after this many ms. */
  slowAfterMs?: number;
};

export default function TenantBootScreen({
  message = "Открываем витрину…",
  onRetry,
  slowAfterMs = 12_000,
}: Props): React.ReactElement {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(t);
  }, [slowAfterMs]);

  return (
    <div className="tenant-boot" role="status" aria-live="polite">
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
