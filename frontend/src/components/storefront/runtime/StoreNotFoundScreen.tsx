import { ArchaErrorShellWithRetry } from "../../errors/ArchaErrorShell";

type Props = {
  slug?: string | null;
  message?: string | null;
  onRetry?: () => void;
};

/** Branded store-not-found — thin wrapper over universal ARCHA error shell. */
export default function StoreNotFoundScreen({
  slug,
  message,
  onRetry,
}: Props): React.ReactElement {
  return (
    <ArchaErrorShellWithRetry
      kind="merchant_not_found"
      slug={slug}
      message={message}
      onRetry={onRetry}
    />
  );
}
