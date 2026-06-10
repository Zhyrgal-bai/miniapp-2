import type { Request } from "express";
import { resolveTenantHintFromRequest } from "./resolveTenantHint.js";

/** Tenant hint from request (not initData): query → header → JSON body. */
export function tenantBusinessIdFromRequest(req: Request): number | null {
  return resolveTenantHintFromRequest(req);
}
