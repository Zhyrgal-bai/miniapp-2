import type React from "react";
import {
  filterStorefrontOrderOptionsSchema,
  verticalProfileFor,
} from "@repo-shared/businessCommerce";
import {
  DynamicFieldRenderer,
  type SchemaObject,
} from "../components/admin/DynamicFieldRenderer";

type Props = {
  businessType: string | null | undefined;
  merchantConfig?: Record<string, unknown> | null;
  schema: SchemaObject;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

/** Storefront order options (checkout extras) — not admin styling. */
export function VerticalOrderOptionsFields({
  businessType,
  merchantConfig,
  schema,
  value,
  onChange,
}: Props): React.ReactElement | null {
  const profile = verticalProfileFor(businessType, merchantConfig);
  if (!profile.showOrderOptionsOnStorefront) return null;

  const filtered = filterStorefrontOrderOptionsSchema(
    businessType,
    schema as Record<string, unknown>,
  ) as SchemaObject;

  if (Object.keys(filtered).length === 0) return null;

  return (
    <div className="sf-order-options">
      <DynamicFieldRenderer schema={filtered} value={value} onChange={onChange} />
    </div>
  );
}
