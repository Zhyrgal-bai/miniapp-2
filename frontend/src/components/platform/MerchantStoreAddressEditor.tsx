import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import MapPicker from "../checkout/MapPicker";
import {
  formatMerchantStoreAddressDisplay,
  parseDisplayAddressInput,
  reverseGeocodeKg,
  type MerchantStoreAddressDraft,
  type ResolvedMerchantAddress,
} from "../../utils/nominatimGeocode";
import "./merchantStoreAddressEditor.css";

type Props = {
  value: MerchantStoreAddressDraft;
  onChange: (next: MerchantStoreAddressDraft) => void;
  disabled?: boolean;
  inputId?: string;
  error?: string | null;
  hint?: string | null;
  inputClassName?: string;
};

export function MerchantStoreAddressEditor(props: Props): ReactElement {
  const disabled = props.disabled ?? false;
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayValue = useMemo(
    () =>
      formatMerchantStoreAddressDisplay(
        props.value.city,
        props.value.addressLine,
      ),
    [props.value.city, props.value.addressLine],
  );

  const applyResolved = useCallback(
    (resolved: ResolvedMerchantAddress) => {
      props.onChange({
        city: resolved.city,
        addressLine: resolved.addressLine,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
    },
    [props],
  );

  const handleDisplayChange = (text: string) => {
    setLocalError(null);
    const parsed = parseDisplayAddressInput(text);
    props.onChange({
      city: parsed.city,
      addressLine: parsed.addressLine,
      latitude: null,
      longitude: null,
    });
  };

  const handleAutoDetect = () => {
    if (disabled || locating) return;
    if (!navigator.geolocation) {
      setLocalError("Геолокация не поддерживается в этом браузере");
      return;
    }
    setLocating(true);
    setLocalError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          try {
            const r = await reverseGeocodeKg(
              pos.coords.latitude,
              pos.coords.longitude,
            );
            if (!r.ok) {
              setLocalError(r.error);
              return;
            }
            applyResolved(r.value);
            setShowMap(true);
          } finally {
            setLocating(false);
          }
        })();
      },
      () => {
        setLocalError("Разрешите доступ к геолокации");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  };

  const showError = props.error ?? localError;

  return (
    <div className="msa-editor">
      <div className="msa-editor__field">
        <label className="msa-editor__label" htmlFor={props.inputId ?? "msa-address"}>
          Адрес магазина
        </label>
        <input
          id={props.inputId ?? "msa-address"}
          type="text"
          className={props.inputClassName ?? "msa-editor__input"}
          disabled={disabled}
          value={displayValue}
          maxLength={620}
          placeholder="Бишкек, ул. Чуй 123"
          onChange={(e) => handleDisplayChange(e.target.value)}
        />
      </div>

      <div className="msa-editor__actions">
        <button
          type="button"
          className="msa-editor__action"
          disabled={disabled || locating}
          onClick={handleAutoDetect}
        >
          {locating ? "Определяем…" : "📍 Определить автоматически"}
        </button>
        <button
          type="button"
          className="msa-editor__action"
          disabled={disabled}
          onClick={() => setShowMap((v) => !v)}
          aria-expanded={showMap}
        >
          {showMap ? "🗺 Скрыть карту" : "🗺 Выбрать на карте"}
        </button>
      </div>

      {showMap ? (
        <div className="msa-editor__map">
          <MapPicker
            lat={props.value.latitude}
            lng={props.value.longitude}
            setLat={(v) =>
              props.onChange({ ...props.value, latitude: v })
            }
            setLng={(v) =>
              props.onChange({ ...props.value, longitude: v })
            }
            setAddress={() => {}}
            onResolved={applyResolved}
          />
        </div>
      ) : null}

      {showError ? (
        <p className="msa-editor__error" role="alert">
          {showError}
        </p>
      ) : props.hint ? (
        <p className="msa-editor__hint">{props.hint}</p>
      ) : (
        <p className="msa-editor__hint">
          Укажите адрес вручную, определите по GPS или отметьте точку на карте.
        </p>
      )}
    </div>
  );
}
