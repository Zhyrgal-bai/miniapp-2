import { StorefrontRenderer } from "./StorefrontRenderer";
import { useStorefrontPayload } from "./runtime/StorefrontPayloadContext";

export function StorefrontContainer(): React.ReactElement {
  const { payload, error, loading } = useStorefrontPayload();

  if (error) return <div className="sf-container-state">{error}</div>;
  if (loading || !payload) {
    return <div className="sf-container-state">Загрузка…</div>;
  }

  return <StorefrontRenderer payload={payload} />;
}

