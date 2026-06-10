import cors from "cors";

function parseAllowedOrigins(): string[] | "*" {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (raw == null || raw === "" || raw === "*") return "*";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : "*";
}

const allowed = parseAllowedOrigins();

/** CORS with env allowlist; default `*` preserves backward compatibility. */
export const corsMiddleware = cors({
  origin:
    allowed === "*"
      ? "*"
      : (origin, callback) => {
          if (origin == null || origin === "") {
            callback(null, true);
            return;
          }
          if (Array.isArray(allowed) && allowed.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error("CORS not allowed"), false);
        },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-telegram-id",
    "x-telegram-init-data",
    "x-business-id",
    "x-operator-session",
    "x-correlation-id",
  ],
});
