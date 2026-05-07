import type { BusinessType } from "@prisma/client";
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

export type BusinessTemplateConfig = {
  businessType: BusinessType;
  templateVersion: number;
  theme: TemplateThemeConfig;
  defaultCategories: CategoryTemplateNode[];
  merchantConfig: Record<string, unknown>;
  productSchema: SchemaObject;
  merchantSettingsSchema: SchemaObject;
  orderOptionsSchema: SchemaObject;
  demoProducts: TemplateDemoProduct[];
};

