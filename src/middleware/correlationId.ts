import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/** Propagate or assign x-correlation-id for commerce lifecycle tracing. */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.headers["x-correlation-id"];
  const incoming =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0].trim()
        : "";
  const id =
    incoming !== "" && incoming.length <= 64 ? incoming : randomUUID();
  req.correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
}

export function correlationIdFromRequest(req: Request): string | undefined {
  return req.correlationId;
}
