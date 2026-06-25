const PII_FIELD_PATTERN =
  /address|phone|fullname|coordinates|latitude|longitude|token|authorization|secret|password/i;

/** Strip PII-bearing keys from a shallow object before logging. */
export function sanitizeLogFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (PII_FIELD_PATTERN.test(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Endpoint path only — never log full URL with query or host credentials. */
export function sanitizeEndpointPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") return "/";
  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}
