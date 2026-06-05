import { StorefrontRenderer } from "./StorefrontRenderer";
import { useStorefrontPayload } from "./runtime/StorefrontPayloadContext";
import { StorefrontLoadingSkeleton } from "../ui/Skeleton";
import "../ui/skeleton.css";
import { ErrorState } from "../ui/ErrorState";
import "../ui/errorState.css";

export function StorefrontContainer(): React.ReactElement {
  const { payload, error, loading, refresh } = useStorefrontPayload();

  if (error) {
    return (
      <div className="sf-container-state">
        <ErrorState
          title="Не удалось загрузить витрину"
          message={error}
          onRetry={() => void refresh()}
          onBack={() => window.history.back()}
          backLabel="Назад"
        />
      </div>
    );
  }
  if (loading || !payload) {
    return (
      <div className="sf-container-state sf-container-state--loading">
        <StorefrontLoadingSkeleton />
      </div>
    );
  }

  return <StorefrontRenderer payload={payload} />;
}
