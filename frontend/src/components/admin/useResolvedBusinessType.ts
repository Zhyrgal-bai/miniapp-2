import { useEffect, useState } from "react";
import { verticalProfileFor, isKnownBusinessType } from "@repo-shared/businessCommerce";
import { adminService } from "../../services/admin.service";
import { useStorefrontPayload } from "../storefront/runtime/StorefrontPayloadContext";
import type { SchemaObject as DynamicSchemaObject } from "./DynamicFieldRenderer";

export function useResolvedBusinessType() {
  const { payload } = useStorefrontPayload();
  const payloadType = String(payload?.businessType ?? "").trim();
  const [schemaType, setSchemaType] = useState<string | null>(null);
  const [productSchema, setProductSchema] = useState<DynamicSchemaObject>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const schema = await adminService.getMerchantSchemas();
        if (!cancelled) {
          setSchemaType(String(schema.businessType ?? "").trim() || null);
          setProductSchema(
            schema.productSchema as unknown as DynamicSchemaObject,
          );
        }
      } catch {
        // storefront payload is the fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const businessType = schemaType || payloadType;
  const resolved = isKnownBusinessType(businessType);
  const profile = resolved ? verticalProfileFor(businessType) : null;
  const variantEditor = profile?.variantEditor ?? null;

  return {
    businessType,
    productSchema,
    loading,
    resolved,
    variantEditor,
    showClothingVariants: resolved && variantEditor === "clothing_matrix",
    showTierStock:
      resolved &&
      (variantEditor === "tier_stock" || variantEditor === "bouquet_tiers"),
  };
}
