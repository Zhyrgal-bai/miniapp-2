import type { NextFunction, Request, Response } from "express";

/**
 * Для POST с ожидаемым JSON-объектом: отвергает отсутствие тела и `{}`.
 */
export function requireNonEmptyJsonBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const b = req.body;
  if (b === undefined || b === null) {
    res.status(400).json({ error: "Ожидался JSON в теле запроса" });
    return;
  }
  if (typeof b !== "object" || Array.isArray(b)) {
    res.status(400).json({ error: "Некорректное тело запроса" });
    return;
  }
  if (Object.keys(b as Record<string, unknown>).length === 0) {
    res.status(400).json({ error: "Пустое тело запроса" });
    return;
  }
  next();
}
