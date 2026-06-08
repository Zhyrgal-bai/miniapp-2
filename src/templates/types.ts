import type { BusinessTypeId } from "../shared/businessTypes.js";
import type { ThemePatchPayload } from "../shared/storeTheme.js";

export type SchemaFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date";

export type BaseFieldSchema = {
  type: SchemaFieldType;
  label: string;
  required?: boolean;
  /** Default value applied by backend normalizer */
  default?: unknown;
};

export type TextFieldSchema = BaseFieldSchema & {
  type: "text";
  maxLen?: number;
  pattern?: string;
};

export type NumberFieldSchema = BaseFieldSchema & {
  type: "number";
  min?: number;
  max?: number;
};

export type BooleanFieldSchema = BaseFieldSchema & {
  type: "boolean";
};

export type SelectFieldSchema = BaseFieldSchema & {
  type: "select";
  values: string[];
};

export type MultiSelectFieldSchema = BaseFieldSchema & {
  type: "multiselect";
  values: string[];
};

export type DateFieldSchema = BaseFieldSchema & {
  type: "date";
};

export type FieldSchema =
  | TextFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema
  | SelectFieldSchema
  | MultiSelectFieldSchema
  | DateFieldSchema;

export type SchemaObject = Record<string, FieldSchema>;

export type CategoryTemplateNode = {
  /** Stable key within template (used to map configs/demo). */
  key: string;
  name: string;
  children?: CategoryTemplateNode[];
  /** Category-level config (dynamic fields/order options, etc.) */
  config?: Record<string, unknown>;
};

export type TemplateThemeConfig = {
  /** Uses existing store theme system: templateId + themeConfig patch */
  templateId: string | null;
  themeConfig: ThemePatchPayload;
};

export type TemplateDemoProduct = {
  categoryKey: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  attributes?: Record<string, unknown>;
};

export type TemplateCardRendererId =
  | "clothing"
  | "flowers"
  | "coffee"
  | "fastfood"
  | "electronics"
  | "autoparts"
  | "cosmetics"
  | "furniture"
  | "generic";

export type TemplateModalRendererId = "product-experience-v2" | "generic-v2";

export type TemplateVariantEditor =
  | "clothing_matrix"
  | "tier_stock"
  | "bouquet_tiers"
  | "none";

export type TemplateVariantPolicy = {
  mode: "sku_matrix" | "single_axis" | "metadata_only";
  /** Storage adapter currently maps to OrderItem.size/ProductStock.size. */
  primaryAxisKey: "size";
  primaryAxisLabel: string;
  /** Storage adapter currently maps to OrderItem.color; null disables selector. */
  secondaryAxisKey: "color" | null;
  secondaryAxisLabel: string | null;
  showFashionVariantMatrix: boolean;
  showOrderOptionsOnStorefront: boolean;
  variantEditor: TemplateVariantEditor;
  defaultPrimaryValues: string[];
};

export type TemplateCatalogBehavior = {
  cardPlaceholder: string;
  supportsTableReservations: boolean;
  imageRatioHint: "portrait" | "square" | "landscape";
  imageFitHint: "cover" | "contain";
};

export type TemplateModalBehavior = {
  mode: "centered_v2";
  maxWidth: "sm" | "md" | "lg";
  stickyActionBar: boolean;
};

export type BusinessTemplateDescriptor = {
  businessType: BusinessTypeId;
  templateVersion: number;
  theme: TemplateThemeConfig;
  defaultCategories: CategoryTemplateNode[];
  merchantConfig: Record<string, unknown>;
  productSchema: SchemaObject;
  merchantSettingsSchema: SchemaObject;
  orderOptionsSchema: SchemaObject;
  demoProducts: TemplateDemoProduct[];
  variantPolicy: TemplateVariantPolicy;
  cardRendererId: TemplateCardRendererId;
  modalRendererId: TemplateModalRendererId;
  catalogBehavior: TemplateCatalogBehavior;
  modalBehavior: TemplateModalBehavior;
};

/** Backward-compatible alias during migration to template registry contracts. */
export type BusinessTemplateConfig = BusinessTemplateDescriptor;

