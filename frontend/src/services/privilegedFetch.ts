import { withTenantHeaders } from "./api";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";
import { requireTelegramInitData } from "../utils/telegramSession";

export type PrivilegedFetchInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  /** Explicit tenant; defaults to session shop id when route is tenant-scoped. */
  businessId?: number | null;
  /** When false, omit Content-Type (e.g. multipart FormData). Default true. */
  json?: boolean;
};

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const kv of headers) {
      if (Array.isArray(kv) && kv.length >= 2) {
        out[String(kv[0])] = String(kv[1]);
      }
    }
    return out;
  }
  if (typeof headers === "object") {
    Object.assign(out, headers as Record<string, string>);
  }
  return out;
}

/** Production-safe headers: verified initData + tenant id for scoped routes. */
export async function buildPrivilegedHeaders(
  url: string,
  opts?: { businessId?: number | null; json?: boolean },
): Promise<Record<string, string>> {
  await requireTelegramInitData();
  const base: Record<string, string> = {
    ...telegramWebAppInitDataHeader({ silent: true }),
  };
  if (opts?.json !== false) {
    base["Content-Type"] = "application/json";
  }
  const merged = withTenantHeaders(
    base,
    url,
    opts?.businessId != null ? { businessId: opts.businessId } : undefined,
  );
  return headersToRecord(merged);
}

/** fetch() wrapper for privileged API routes — always sends initData (+ tenant when needed). */
export async function privilegedFetch(
  url: string,
  init: PrivilegedFetchInit = {},
): Promise<Response> {
  const { businessId, json, headers: extraHeaders, ...rest } = init;
  const authHeaders = await buildPrivilegedHeaders(url, { businessId, json });
  const extra = headersToRecord(extraHeaders);
  const merged: Record<string, string> = { ...authHeaders, ...extra };
  if (json === false) {
    delete merged["Content-Type"];
  }
  return fetch(url, {
    ...rest,
    headers: merged,
  });
}
