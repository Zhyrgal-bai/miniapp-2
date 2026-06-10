/** Magic-byte sniffing for upload validation (supplements client-reported MIME). */

const SIG_JPEG = [0xff, 0xd8, 0xff] as const;
const SIG_PNG = [0x89, 0x50, 0x4e, 0x47] as const;
const SIG_WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const;
const SIG_PDF = [0x25, 0x50, 0x44, 0x46] as const; // %PDF

function startsWith(buf: Buffer, sig: readonly number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

export type SniffedKind = "jpeg" | "png" | "webp" | "pdf" | "unknown";

export function sniffBufferKind(buffer: Buffer): SniffedKind {
  if (buffer.length < 4) return "unknown";
  if (startsWith(buffer, SIG_JPEG)) return "jpeg";
  if (startsWith(buffer, SIG_PNG)) return "png";
  if (startsWith(buffer, SIG_PDF)) return "pdf";
  if (
    startsWith(buffer, SIG_WEBP_RIFF) &&
    buffer.length >= 12 &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return "unknown";
}

export function sniffMatchesMime(
  buffer: Buffer,
  mimetype: string,
): boolean {
  const mt = mimetype.trim().toLowerCase();
  const kind = sniffBufferKind(buffer);
  if (kind === "unknown") return false;
  if (mt === "image/jpeg" || mt === "image/jpg") return kind === "jpeg";
  if (mt === "image/png") return kind === "png";
  if (mt === "image/webp") return kind === "webp";
  if (mt === "application/pdf" || mt === "application/x-pdf") return kind === "pdf";
  return false;
}

export function isSafeUploadFilename(name: string | undefined): boolean {
  const n = (name ?? "").trim();
  if (n === "") return true;
  if (n.includes("..") || n.includes("/") || n.includes("\\")) return false;
  if (/[\x00-\x1f\x7f]/.test(n)) return false;
  return true;
}
