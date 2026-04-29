/** Strip angle brackets to reduce XSS when values are echoed in HTML/admin. */
export function cleanInput(text: unknown): string {
  return String(text ?? "")
    .replace(/</g, "")
    .replace(/>/g, "")
    .trim();
}

const KG_PHONE_REGEX = /^(\+996\d{9}|0\d{9})$/;

/** Kyrgyz mobile: +996 + 9 digits, or 0 + 9 digits (max length 13 for +996…). */
export function validateKgPhone(phone: string): boolean {
  const t = String(phone).trim();
  if (t.length > 13) return false;
  return KG_PHONE_REGEX.test(t);
}
