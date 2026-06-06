import { useEffect, useState } from "react";
import { verticalProfileFor, isKnownBusinessType } from "@repo-shared/businessCommerce";
import { adminService } from "../../services/admin.service";
import { useStorefrontPayload } from "../storefront/runtime/StorefrontPayloadContext";
import type { SchemaObject as DynamicSchemaObject } from "./DynamicFieldRenderer";

export function useResolvedBusinessType() {
  const { payload } = useStorefrontPayload();
  const payloadType = String(payload?.businessType ?? "").trim();
  const payloadMerchantConfig =
    payload?.merchantConfig != null &&
    typeof payload.merchantConfig === "object" &&
    !Array.isArray(payload.merchantConfig)
      ? (payload.merchantConfig as Record<string, unknown>)
      : {};
  const [schemaType, setSchemaType] = useState<string | null>(null);
  const [productSchema, setProductSchema] = useState<DynamicSchemaObject>({});
  const [merchantConfig, setMerchantConfig] = useState<Record<string, unknown>>({});
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
          setMerchantConfig(schema.merchantConfig ?? {});
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
  const resolvedMerchantConfig =
    Object.keys(merchantConfig).length > 0 ? merchantConfig : payloadMerchantConfig;
  const resolved = isKnownBusinessType(businessType);
  const profile = resolved
    ? verticalProfileFor(businessType, resolvedMerchantConfig)
    : null;
  const variantEditor = profile?.variantEditor ?? null;

  return {
    businessType,
    productSchema,
    merchantConfig: resolvedMerchantConfig,
    loading,
    resolved,
    variantEditor,
    showClothingVariants: resolved && variantEditor === "clothing_matrix",
    showTierStock:
      resolved &&
      (variantEditor === "tier_stock" || variantEditor === "bouquet_tiers"),
  };
}
