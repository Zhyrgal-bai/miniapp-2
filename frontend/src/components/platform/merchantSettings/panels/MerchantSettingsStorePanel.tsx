import type { ReactElement } from "react";
import { archa } from "../../../archa/archaUi";
import { MerchantStoreAddressEditor } from "../../MerchantStoreAddressEditor";
import {
  MerchantSettingsRenderer,
  type SchemaObject as MerchantSchemaObject,
} from "../../../merchant/MerchantSettingsRenderer";
import type { MerchantStoreAddressDraft } from "../../../../utils/nominatimGeocode";

type Props = {
  disabled?: boolean;
  settingsName: string;
  onSettingsNameChange: (v: string) => void;
  storeAddressDraft: MerchantStoreAddressDraft;
  onStoreAddressDraftChange: (v: MerchantStoreAddressDraft) => void;
  isPlatformAdmin: boolean;
  businessType: string;
  merchantSettingsSchema: MerchantSchemaObject;
  merchantConfigDraft: Record<string, unknown>;
  onMerchantConfigDraftChange: (v: Record<string, unknown>) => void;
};

export function MerchantSettingsStorePanel(props: Props): ReactElement {
  return (
    <div className="mp-settings-panel mp-settings-panel--compact">
      <div className="mp-settings-inline-card">
        <label htmlFor="platform-settings-name" className="mp-settings-inline-card__label">
          Название магазина
        </label>
        <input
          id="platform-settings-name"
          type="text"
          required
          minLength={2}
          maxLength={160}
          autoComplete="organization"
          disabled={props.disabled}
          value={props.settingsName}
          onChange={(e) => props.onSettingsNameChange(e.target.value)}
          className={archa.input}
        />
      </div>

      <div className="mp-settings-inline-card">
        <span className="mp-settings-inline-card__label">Адрес и карта</span>
        <MerchantStoreAddressEditor
          inputId="platform-settings-address"
          inputClassName={archa.input}
          disabled={props.disabled}
          value={props.storeAddressDraft}
          onChange={props.onStoreAddressDraftChange}
        />
      </div>

      {props.isPlatformAdmin &&
      Object.keys(props.merchantSettingsSchema ?? {}).length > 0 ? (
        <div className="mp-settings-inline-card">
          <span className="mp-settings-inline-card__label">
            Доп. настройки ({props.businessType})
          </span>
          <MerchantSettingsRenderer
            schema={props.merchantSettingsSchema}
            value={props.merchantConfigDraft}
            onChange={props.onMerchantConfigDraftChange}
          />
        </div>
      ) : null}
    </div>
  );
}
