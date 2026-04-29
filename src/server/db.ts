import { PrismaClient, Prisma } from "@prisma/client";

export const prisma = new PrismaClient();

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
