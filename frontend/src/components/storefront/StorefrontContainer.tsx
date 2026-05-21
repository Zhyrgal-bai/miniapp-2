import { StorefrontRenderer } from "./StorefrontRenderer";
import { useStorefrontPayload } from "./runtime/StorefrontPayloadContext";
import { t } from "../../i18n";

export function StorefrontContainer(): React.ReactElement {
  const { payload, error, loading, refresh } = useStorefrontPayload();

  if (error) {
    return (
      <div className="sf-container-state">
        <p>{error}</p>
        <button type="button" className="sf-container-state__retry" onClick={() => void refresh()}>
          {t("common.retry")}
        </button>
      </div>
    );
  }
  if (loading || !payload) {
    return <div className="sf-container-state">Загрузка…</div>;
  }

  return <StorefrontRenderer payload={payload} />;
}
