import type { NextFunction, Request, Response } from "express";

/** Strip stack traces from JSON error responses (defense in depth). */
export function safeErrorEnvelopeMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const originalJson = res.json.bind(res);
  res.json = function safeJson(body: unknown) {
    if (body != null && typeof body === "object" && !Array.isArray(body)) {
      const o = body as Record<string, unknown>;
      if ("stack" in o) {
        const { stack: _s, ...rest } = o;
        return originalJson(rest);
      }
    }
    return originalJson(body);
  } as typeof res.json;
  next();
}
