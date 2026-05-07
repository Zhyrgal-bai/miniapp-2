import type { BusinessType } from "@prisma/client";
import type { FieldSchema, SchemaObject } from "../templates/types.js";
import { templateForBusinessType } from "../templates/index.js";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; details?: Record<string, string> };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function normalizeStringArray(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = String(v).trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function validateField(
  key: string,
  schema: FieldSchema,
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const required = schema.required === true;
  if (raw === undefined) {
    if (schema.default !== undefined) return { ok: true, value: schema.default };
    return required ? { ok: false, error: `Поле обязательно: ${schema.label}` } : { ok: true, value: undefined };
  }

  if (raw === null) {
    return required
      ? { ok: false, error: `Поле обязательно: ${schema.label}` }
      : { ok: true, value: null };
  }

  switch (schema.type) {
    case "text": {
      const s = String(raw);
      const t = s.trim();
      if (required && t === "") return { ok: false, error: `Поле обязательно: ${schema.label}` };
      if (schema.maxLen != null && t.length > schema.maxLen) {
        return { ok: false, error: `Слишком длинно: ${schema.label}` };
      }
      if (schema.pattern) {
        try {
          const re = new RegExp(schema.pattern);
          if (t !== "" && !re.test(t)) return { ok: false, error: `Неверный формат: ${schema.label}` };
        } catch {
          // broken pattern in template — treat as safe default: deny non-empty values
          if (t !== "") return { ok: false, error: `Шаблон поля повреждён: ${schema.label}` };
        }
      }
      return { ok: true, value: t };
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `Неверное число: ${schema.label}` };
      if (schema.min != null && n < schema.min) return { ok: false, error: `Меньше минимума: ${schema.label}` };
      if (schema.max != null && n > schema.max) return { ok: false, error: `Больше максимума: ${schema.label}` };
      return { ok: true, value: n };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true" || raw === "1" || raw === 1) return { ok: true, value: true };
      if (raw === "false" || raw === "0" || raw === 0) return { ok: true, value: false };
      return { ok: false, error: `Неверный boolean: ${schema.label}` };
    }
    case "select": {
      const s = String(raw).trim();
      const allowed = normalizeStringArray(schema.values);
      if (required && s === "") return { ok: false, error: `Поле обязательно: ${schema.label}` };
      if (s === "") return { ok: true, value: "" };
      if (!allowed.includes(s)) return { ok: false, error: `Недопустимое значение: ${schema.label}` };
      return { ok: true, value: s };
    }
    case "multiselect": {
      const allowed = normalizeStringArray(schema.values);
      const list: string[] = Array.isArray(raw) ? raw.map((x) => String(x).trim()) : [String(raw).trim()];
      const cleaned = normalizeStringArray(list).filter((x) => allowed.includes(x));
      if (required && cleaned.length === 0) return { ok: false, error: `Поле обязательно: ${schema.label}` };
      if (cleaned.length === 0) return { ok: true, value: [] };
      if (cleaned.length !== normalizeStringArray(list).length) {
        return { ok: false, error: `Недопустимое значение: ${schema.label}` };
      }
      return { ok: true, value: cleaned };
    }
    case "date": {
      const s = String(raw).trim();
      if (required && s === "") return { ok: false, error: `Поле обязательно: ${schema.label}` };
      if (s === "") return { ok: true, value: "" };
      // ISO date or datetime acceptable; store string normalized
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return { ok: false, error: `Неверная дата: ${schema.label}` };
      return { ok: true, value: d.toISOString() };
    }
    default:
      return { ok: false, error: `Неизвестный тип поля: ${key}` };
  }
}

function validateObjectAgainstSchema(
  schema: SchemaObject,
  raw: unknown,
): ValidationResult<Record<string, unknown>> {
  if (!isPlainObject(raw)) raw = {};
  const input = raw as Record<string, unknown>;

  const out: Record<string, unknown> = {};
  const details: Record<string, string> = {};

  // deny unknown keys
  for (const k of Object.keys(input)) {
    if (!(k in schema)) {
      details[k] = "Неизвестное поле";
    }
  }
  if (Object.keys(details).length > 0) {
    return { ok: false, error: "Есть неизвестные поля", details };
  }

  for (const [key, field] of Object.entries(schema)) {
    const v = input[key];
    const r = validateField(key, field, v);
    if (!r.ok) {
      details[key] = r.error;
      continue;
    }
    if (r.value !== undefined) {
      out[key] = r.value;
    }
  }

  if (Object.keys(details).length > 0) {
    return { ok: false, error: "Некорректные значения", details };
  }
  return { ok: true, value: out };
}

function safeSchemaFor(
  businessType: BusinessType,
  picker: (t: ReturnType<typeof templateForBusinessType>) => SchemaObject,
): SchemaObject {
  try {
    const tpl = templateForBusinessType(businessType);
    const s = picker(tpl);
    return s && typeof s === "object" ? s : {};
  } catch (e) {
    console.error("[templateValidation] template schema load failed:", {
      businessType,
      err: e,
    });
    return {};
  }
}

export function validateProductAttributes(
  businessType: BusinessType,
  attributes: unknown,
): ValidationResult<Record<string, unknown>> {
  const schema = safeSchemaFor(businessType, (t) => t.productSchema);
  return validateObjectAgainstSchema(schema, attributes);
}

export function validateMerchantConfig(
  businessType: BusinessType,
  merchantConfig: unknown,
): ValidationResult<Record<string, unknown>> {
  const schema = safeSchemaFor(businessType, (t) => t.merchantSettingsSchema);
  return validateObjectAgainstSchema(schema, merchantConfig);
}

export function validateOrderOptions(
  businessType: BusinessType,
  options: unknown,
): ValidationResult<Record<string, unknown>> {
  const schema = safeSchemaFor(businessType, (t) => t.orderOptionsSchema);
  return validateObjectAgainstSchema(schema, options);
}

