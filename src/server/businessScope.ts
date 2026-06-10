/**
 * Tenant isolation helper — businessId-first validation for resource access.
 */

export class BusinessScopeError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(message: string, httpStatus = 404, code = "not_found") {
    super(message);
    this.name = "BusinessScopeError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export function assertBusinessScope(params: {
  authenticatedBusinessId: number;
  resourceBusinessId: number | null | undefined;
  resourceId?: number | string;
}): void {
  const auth = params.authenticatedBusinessId;
  const resource = params.resourceBusinessId;
  if (!Number.isSafeInteger(auth) || auth <= 0) {
    throw new BusinessScopeError("Invalid tenant context", 403, "forbidden");
  }
  if (resource == null || !Number.isSafeInteger(resource) || resource <= 0) {
    throw new BusinessScopeError("Ресурс не найден", 404, "not_found");
  }
  if (resource !== auth) {
    throw new BusinessScopeError("Ресурс не найден", 404, "not_found");
  }
}

/** Express-friendly: send unified 404 for cross-tenant mismatch. */
export function respondBusinessScopeError(
  res: { status: (n: number) => { json: (b: object) => void } },
  err: unknown,
  notFoundMessage = "Не найдено",
): boolean {
  if (!(err instanceof BusinessScopeError)) return false;
  res.status(err.httpStatus).json({ error: notFoundMessage });
  return true;
}
