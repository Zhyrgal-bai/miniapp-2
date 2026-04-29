import { PrismaClient, Prisma } from "@prisma/client";

/**
 * На Render Postgres почти всегда нужен TLS. Дополняем URL только на Render и если ssl
 * ещё не задан — локальный `localhost` без RENDER не трогаем.
 */
function ensurePostgresUrlSsl(): void {
  if (!process.env.RENDER) return;
  const u = process.env.DATABASE_URL ?? "";
  if (u === "") return;
  if (!/^(postgresql|postgres):\/\//i.test(u)) return;
  if (/\bsslmode=/i.test(u) || /\bsslmode%3D/i.test(u)) return;
  if (/\bssl=true\b/i.test(u) || /[?&]ssl=1\b/i.test(u)) return;
  const joiner = u.includes("?") ? "&" : "?";
  process.env.DATABASE_URL = `${u}${joiner}sslmode=require`;
  console.log("[db] DATABASE_URL: добавлен sslmode=require (Render)");
}

ensurePostgresUrlSsl();

function warnPostgresSslIfNeeded(): void {
  const u = process.env.DATABASE_URL ?? "";
  if (u === "") return;
  if (!/^(postgresql|postgres):\/\//i.test(u)) return;
  if (/\bsslmode=require\b/i.test(u) || /\bssl=/i.test(u)) return;

  console.warn(
    "[db] DATABASE_URL: для облачного PostgreSQL часто нужен параметр sslmode=require (Render/Neon/Supabase)."
  );
}

warnPostgresSslIfNeeded();

export const prisma = new PrismaClient();

/**
 * Полный лог Prisma-исключений: code / meta / stack (для логов Render).
 */
export function logPrismaError(context: string, err: unknown): void {
  console.error(`[prisma] ${context}`);
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("  code:", err.code);
    console.error("  message:", err.message);
    console.error("  meta:", JSON.stringify(err.meta));
    console.error(err.stack ?? "");
    return;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error("  errorCode:", err.errorCode);
    console.error("  message:", err.message);
    console.error(err.stack ?? "");
    return;
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error("  message:", err.message);
    return;
  }
  if (err instanceof Error) {
    console.error("  message:", err.message);
    console.error(err.stack ?? "");
    return;
  }
  console.error(err);
}

/**
 * Вызывать один раз перед `app.listen` — упадём с кодом 1, если БД недоступна.
 */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}
