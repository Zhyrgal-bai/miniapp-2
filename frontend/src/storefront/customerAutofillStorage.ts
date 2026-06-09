type DeliveryType = "delivery" | "pickup";

type AutofillProfile = {
  name: string | null;
  phone: string | null;
  address: string | null;
  deliveryType: DeliveryType | null;
};

type AutofillAddressBook = {
  home: string | null;
  work: string | null;
  last: string | null;
};

export type AutofillRecipient = {
  name: string;
  phone: string;
};

type CustomerAutofillRecord = {
  version: 1;
  businessId: number;
  updatedAt: number;
  profile: AutofillProfile;
  addresses: AutofillAddressBook;
  recentAddresses: string[];
  recentRecipients: AutofillRecipient[];
  verticalPresets: Record<string, Record<string, unknown>>;
};

type CheckoutAutofillSource = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
};

type CheckoutAutofillInput = {
  explicit?: CheckoutAutofillSource;
  saved?: CheckoutAutofillSource;
  recentOrder?: CheckoutAutofillSource;
  telegram?: CheckoutAutofillSource;
};

const STORAGE_PREFIX = "sf:customerAutofill:v1:";
const MAX_RECENT_ADDRESSES = 8;
const MAX_RECENT_RECIPIENTS = 8;

function storageKey(businessId: number): string {
  return `${STORAGE_PREFIX}${Math.trunc(businessId)}`;
}

function normalizeBusinessId(businessId: number): number | null {
  const bid = Math.trunc(Number(businessId));
  return Number.isFinite(bid) && bid > 0 ? bid : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : null;
}

function normalizeDeliveryType(value: unknown): DeliveryType | null {
  return value === "pickup" || value === "delivery" ? value : null;
}

function uniqueStrings(input: Array<string | null | undefined>, max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const value = normalizeString(raw);
    if (value == null) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeRecipient(value: unknown): AutofillRecipient | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const name = normalizeString(obj.name);
  const phone = normalizeString(obj.phone);
  if (name == null || phone == null) return null;
  return { name, phone };
}

function emptyRecord(businessId: number): CustomerAutofillRecord {
  return {
    version: 1,
    businessId,
    updatedAt: 0,
    profile: {
      name: null,
      phone: null,
      address: null,
      deliveryType: null,
    },
    addresses: {
      home: null,
      work: null,
      last: null,
    },
    recentAddresses: [],
    recentRecipients: [],
    verticalPresets: {},
  };
}

function sanitizeVerticalPreset(
  value: unknown,
  depth = 0,
): Record<string, unknown> | null {
  if (depth > 2) return null;
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (raw == null) continue;
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      out[key] = raw;
      continue;
    }
    if (Array.isArray(raw)) {
      const normalized = raw
        .filter((x) => typeof x === "string" || typeof x === "number")
        .map((x) => String(x))
        .slice(0, 24);
      if (normalized.length > 0) out[key] = normalized;
      continue;
    }
    const nested = sanitizeVerticalPreset(raw, depth + 1);
    if (nested && Object.keys(nested).length > 0) {
      out[key] = nested;
    }
  }
  return out;
}

function normalizeRecord(businessId: number, raw: unknown): CustomerAutofillRecord {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyRecord(businessId);
  }
  const obj = raw as Record<string, unknown>;
  const profileRaw =
    obj.profile != null && typeof obj.profile === "object" && !Array.isArray(obj.profile)
      ? (obj.profile as Record<string, unknown>)
      : {};
  const addressesRaw =
    obj.addresses != null && typeof obj.addresses === "object" && !Array.isArray(obj.addresses)
      ? (obj.addresses as Record<string, unknown>)
      : {};
  const verticalPresetsRaw =
    obj.verticalPresets != null &&
    typeof obj.verticalPresets === "object" &&
    !Array.isArray(obj.verticalPresets)
      ? (obj.verticalPresets as Record<string, unknown>)
      : {};
  const verticalPresets: Record<string, Record<string, unknown>> = {};
  for (const [key, preset] of Object.entries(verticalPresetsRaw)) {
    const safe = sanitizeVerticalPreset(preset);
    if (safe && Object.keys(safe).length > 0) {
      verticalPresets[String(key).trim().toLowerCase()] = safe;
    }
  }
  const recipientsRaw = Array.isArray(obj.recentRecipients) ? obj.recentRecipients : [];
  const recentRecipients = recipientsRaw
    .map((item) => normalizeRecipient(item))
    .filter((x): x is AutofillRecipient => x != null);
  const recentAddressesRaw = Array.isArray(obj.recentAddresses) ? obj.recentAddresses : [];
  return {
    version: 1,
    businessId,
    updatedAt:
      typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt) ? obj.updatedAt : 0,
    profile: {
      name: normalizeString(profileRaw.name),
      phone: normalizeString(profileRaw.phone),
      address: normalizeString(profileRaw.address),
      deliveryType: normalizeDeliveryType(profileRaw.deliveryType),
    },
    addresses: {
      home: normalizeString(addressesRaw.home),
      work: normalizeString(addressesRaw.work),
      last: normalizeString(addressesRaw.last),
    },
    recentAddresses: uniqueStrings(
      recentAddressesRaw.map((x) => (typeof x === "string" ? x : null)),
      MAX_RECENT_ADDRESSES,
    ),
    recentRecipients: recentRecipients.slice(0, MAX_RECENT_RECIPIENTS),
    verticalPresets,
  };
}

function loadRecord(businessId: number): CustomerAutofillRecord {
  const bid = normalizeBusinessId(businessId);
  if (bid == null) return emptyRecord(0);
  try {
    const raw = localStorage.getItem(storageKey(bid));
    if (raw == null || raw.trim() === "") return emptyRecord(bid);
    return normalizeRecord(bid, JSON.parse(raw));
  } catch {
    return emptyRecord(bid);
  }
}

function saveRecord(record: CustomerAutofillRecord): void {
  const bid = normalizeBusinessId(record.businessId);
  if (bid == null) return;
  try {
    localStorage.setItem(storageKey(bid), JSON.stringify(record));
  } catch {
    /* ignore localStorage errors */
  }
}

export function resolveAutofillField(
  explicit: string | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string {
  const explicitValue = normalizeString(explicit);
  if (explicitValue != null) return explicitValue;
  for (const candidate of fallbacks) {
    const normalized = normalizeString(candidate);
    if (normalized != null) return normalized;
  }
  return "";
}

export function resolveCheckoutAutofill(input: CheckoutAutofillInput): {
  name: string;
  phone: string;
  address: string;
} {
  return {
    name: resolveAutofillField(
      input.explicit?.name,
      input.saved?.name,
      input.recentOrder?.name,
      input.telegram?.name,
    ),
    phone: resolveAutofillField(
      input.explicit?.phone,
      input.saved?.phone,
      input.recentOrder?.phone,
      input.telegram?.phone,
    ),
    address: resolveAutofillField(
      input.explicit?.address,
      input.saved?.address,
      input.recentOrder?.address,
      input.telegram?.address,
    ),
  };
}

export function readCheckoutAutofillHints(businessId: number): {
  profile: AutofillProfile;
  addresses: AutofillAddressBook;
  recentAddresses: string[];
  recentRecipients: AutofillRecipient[];
} {
  const record = loadRecord(businessId);
  return {
    profile: record.profile,
    addresses: record.addresses,
    recentAddresses: [...record.recentAddresses],
    recentRecipients: [...record.recentRecipients],
  };
}

export function rememberCheckoutAutofill(
  businessId: number,
  data: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    deliveryType?: DeliveryType | null;
  },
): void {
  const bid = normalizeBusinessId(businessId);
  if (bid == null) return;
  const record = loadRecord(bid);
  const nextName = normalizeString(data.name) ?? record.profile.name;
  const nextPhone = normalizeString(data.phone) ?? record.profile.phone;
  const nextAddress = normalizeString(data.address);
  const recentAddresses = uniqueStrings(
    [nextAddress, ...record.recentAddresses, record.addresses.last, record.profile.address],
    MAX_RECENT_ADDRESSES,
  );
  const recipientSeed =
    nextName != null && nextPhone != null ? [{ name: nextName, phone: nextPhone }] : [];
  const recentRecipients = [
    ...recipientSeed,
    ...record.recentRecipients,
  ].filter(
    (item, idx, arr) =>
      arr.findIndex(
        (x) =>
          x.phone.toLowerCase() === item.phone.toLowerCase() &&
          x.name.toLowerCase() === item.name.toLowerCase(),
      ) === idx,
  );
  const previousHome = record.addresses.home;
  const previousWork = record.addresses.work;
  const inferredHome = previousHome ?? nextAddress ?? record.addresses.last;
  const inferredWork =
    previousWork ??
    (nextAddress != null && inferredHome != null && nextAddress !== inferredHome
      ? nextAddress
      : null);
  const next: CustomerAutofillRecord = {
    ...record,
    updatedAt: Date.now(),
    profile: {
      name: nextName,
      phone: nextPhone,
      address: nextAddress ?? record.profile.address,
      deliveryType: normalizeDeliveryType(data.deliveryType) ?? record.profile.deliveryType,
    },
    addresses: {
      home: inferredHome ?? null,
      work: inferredWork ?? previousWork ?? null,
      last: nextAddress ?? record.addresses.last,
    },
    recentAddresses,
    recentRecipients: recentRecipients.slice(0, MAX_RECENT_RECIPIENTS),
  };
  saveRecord(next);
}

function normalizeFieldBySchema(
  field: Record<string, unknown>,
  value: unknown,
): unknown {
  const type = typeof field.type === "string" ? field.type : "text";
  if (type === "boolean") {
    return value === true ? true : undefined;
  }
  if (type === "multiselect") {
    if (!Array.isArray(value)) return undefined;
    const values = value
      .filter((x) => typeof x === "string" || typeof x === "number")
      .map((x) => String(x));
    return values.length > 0 ? values : undefined;
  }
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Number(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === "select" || type === "text" || type === "date") {
    const normalized = normalizeString(
      typeof value === "number" ? String(value) : value,
    );
    return normalized ?? undefined;
  }
  return undefined;
}

export function resolveVerticalPresetBySchema(
  businessId: number,
  businessType: string | null | undefined,
  schema: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const bid = normalizeBusinessId(businessId);
  const vertical = String(businessType ?? "").trim().toLowerCase();
  if (bid == null || vertical === "") return {};
  const record = loadRecord(bid);
  const preset = record.verticalPresets[vertical];
  if (preset == null || typeof preset !== "object") return {};
  if (schema == null || typeof schema !== "object" || Array.isArray(schema)) {
    return { ...preset };
  }
  const schemaObj = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, rawField] of Object.entries(schemaObj)) {
    if (
      rawField == null ||
      typeof rawField !== "object" ||
      Array.isArray(rawField) ||
      !(key in preset)
    ) {
      continue;
    }
    const normalized = normalizeFieldBySchema(
      rawField as Record<string, unknown>,
      preset[key],
    );
    if (normalized !== undefined) {
      out[key] = normalized;
    }
  }
  return out;
}

export function rememberVerticalPreset(
  businessId: number,
  businessType: string | null | undefined,
  value: Record<string, unknown>,
): void {
  const bid = normalizeBusinessId(businessId);
  const vertical = String(businessType ?? "").trim().toLowerCase();
  if (bid == null || vertical === "") return;
  const sanitized = sanitizeVerticalPreset(value);
  if (sanitized == null || Object.keys(sanitized).length === 0) return;
  const record = loadRecord(bid);
  const next: CustomerAutofillRecord = {
    ...record,
    updatedAt: Date.now(),
    verticalPresets: {
      ...record.verticalPresets,
      [vertical]: sanitized,
    },
  };
  saveRecord(next);
}
