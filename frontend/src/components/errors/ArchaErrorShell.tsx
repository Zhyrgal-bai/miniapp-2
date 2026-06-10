import { Link } from "react-router-dom";
import { ARCHA_BRAND } from "../../config/brandAssets";
import {
  ARCHA_ERROR_COPY,
  storeNotFoundCopy,
  type ErrorKind,
} from "./errorCopy";
import "./archaError.css";

export type ArchaErrorAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "ghost";
};

type Props = {
  kind: ErrorKind;
  /** Override title (e.g. store slug context). */
  title?: string;
  /** Override hint / body message. */
  message?: string | null;
  /** Optional slug or identifier shown as code. */
  slug?: string | null;
  /** Extra detail (e.g. API error, crash message). */
  detail?: string | null;
  /** Custom action buttons; defaults to home link. */
  actions?: ArchaErrorAction[];
  /** Show 404 code badge. */
  showCode?: boolean;
};

function defaultActions(kind: ErrorKind, onRetry?: () => void): ArchaErrorAction[] {
  const acts: ArchaErrorAction[] = [];
  if (onRetry) {
    acts.push({ label: "Повторить", onClick: onRetry, variant: "primary" });
  } else if (kind === "crash" || kind === "load_failed") {
    acts.push({
      label: "Повторить",
      onClick: () => window.location.reload(),
      variant: "primary",
    });
  }
  if (kind === "no_tenant") {
    acts.push({
      label: "Обновить",
      onClick: () => window.location.reload(),
      variant: "ghost",
    });
    acts.push({
      label: "Открыть через Telegram",
      onClick: () => {
        const tg = (window as Window & { Telegram?: { WebApp?: { close?: () => void } } })
          .Telegram?.WebApp;
        if (typeof tg?.close === "function") {
          tg.close();
        } else {
          window.location.reload();
        }
      },
      variant: "ghost",
    });
  }
  acts.push({ label: "На ARCHA", href: "/merchant", variant: "ghost" });
  return acts;
}

export default function ArchaErrorShell({
  kind,
  title,
  message,
  slug,
  detail,
  actions,
  showCode = true,
}: Props): React.ReactElement {
  const copy =
    kind === "merchant_not_found" || (kind === "not_found" && slug)
      ? storeNotFoundCopy(slug)
      : ARCHA_ERROR_COPY[kind];

  const resolvedTitle = title ?? copy.title;
  const resolvedHint = message?.trim() || copy.hint;
  const resolvedActions = actions ?? defaultActions(kind);

  return (
    <div className="archa-error" role="alert">
      <div
        className="archa-error__bg"
        style={{ backgroundImage: `url(${ARCHA_BRAND.background})` }}
        aria-hidden
      />
      <div className="archa-error__inner">
        <img
          className="archa-error__logo"
          src={ARCHA_BRAND.logoIcon}
          alt={ARCHA_BRAND.name}
          width={96}
          height={96}
        />
        {showCode && copy.code !== "—" ? (
          <p className="archa-error__code">{copy.code}</p>
        ) : null}
        <h1 className="archa-error__title">{resolvedTitle}</h1>
        {slug?.trim() ? (
          <p className="archa-error__slug">
            <code title={slug.trim()}>{slug.trim()}</code>
          </p>
        ) : null}
        <p className="archa-error__hint">{resolvedHint}</p>
        {detail?.trim() ? <p className="archa-error__detail">{detail.trim()}</p> : null}
        <div className="archa-error__actions">
          {resolvedActions.map((a) => {
            const cls = a.variant === "primary" ? "archa-btn-primary" : "archa-btn-ghost";
            if (a.href) {
              return (
                <Link key={a.label} to={a.href} className={cls}>
                  {a.label}
                </Link>
              );
            }
            return (
              <button key={a.label} type="button" className={cls} onClick={a.onClick}>
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Re-export for StoreNotFoundScreen wrapper with retry. */
export function ArchaErrorShellWithRetry({
  kind,
  onRetry,
  ...rest
}: Omit<Props, "actions"> & { onRetry?: () => void }): React.ReactElement {
  const acts = defaultActions(kind, onRetry);
  return <ArchaErrorShell kind={kind} actions={acts} {...rest} />;
}
