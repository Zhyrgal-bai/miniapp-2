import { StorefrontRenderer } from "./StorefrontRenderer";
import { useStorefrontPayload } from "./runtime/StorefrontPayloadContext";

export function StorefrontContainer(): React.ReactElement {
  const { payload, error, loading } = useStorefrontPayload();

  if (error) return <div style={{ padding: 16, opacity: 0.8 }}>{error}</div>;
  if (loading || !payload) {
    return <div style={{ padding: 16, opacity: 0.8 }}>Загрузка…</div>;
  }

  return <StorefrontRenderer payload={payload} />;
}

