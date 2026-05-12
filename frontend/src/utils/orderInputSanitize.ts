export function cleanInput(text: string): string {
  return String(text)
    .replace(/</g, "")
    .replace(/>/g, "")
    .trim();
}

const KG_PHONE_REGEX = /^(\+996\d{9}|0\d{9})$/;

export function validateKgPhone(phone: string): boolean {
  const t = phone.trim();
  if (t.length > 13) return false;
  return KG_PHONE_REGEX.test(t);
}
