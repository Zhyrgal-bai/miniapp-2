import type { NextFunction, Request, Response } from "express";

type JsonableError = NodeJS.ErrnoException & {
  status?: number;
  statusCode?: number;
  type?: string;
};

function isPayloadTooLarge(err: unknown): boolean {
  const e = err as JsonableError | undefined;
  if (e?.type === "entity.too.large") return true;
  if (typeof e?.status === "number" && e.status === 413) return true;
  if (typeof e?.statusCode === "number" && e.statusCode === 413) return true;
  return false;
}

function isMalformedJsonSyntax(err: unknown): boolean {
  return err instanceof SyntaxError && "body" in (err as object);
}

/**
 * Последний middleware: клиент не получает stack trace; ошибки только в stderr.
 */
export function apiSafeErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isPayloadTooLarge(err)) {
    console.warn("[api] payload-too-large:", req.method, req.path ?? req.url);
    res.status(413).json({ error: "Тело запроса слишком большое" });
    return;
  }

  if (isMalformedJsonSyntax(err)) {
    console.warn("[api] bad-json:", req.method, req.path ?? req.url);
    res.status(400).json({ error: "Некорректный JSON" });
    return;
  }

  const je = err as JsonableError;
  const fallbackCode =
    typeof je.status === "number"
      ? je.status
      : typeof je.statusCode === "number"
        ? je.statusCode
        : undefined;
  const code =
    fallbackCode !== undefined &&
    fallbackCode >= 400 &&
    fallbackCode < 600
      ? fallbackCode
      : 500;

  console.error(
    "[api:error]",
    req.method,
    req.path ?? req.url,
    err instanceof Error ? err.message : String(err),
  );

  res.status(code).json({ error: "Ошибка сервера" });
}
