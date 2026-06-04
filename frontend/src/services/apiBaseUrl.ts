/** Pure helpers for API base URL resolution (no axios / shared imports). */

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function normalizeApiRoot(url: string): string {
  const trimmed = normalizeBaseUrl(url);
  if (trimmed.endsWith("/api")) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

export function resolveRuntimeApiFallbackBase(opts: {
  envFallbackUrl: string;
  hostname: string;
  origin: string;
}): string {
  if (opts.envFallbackUrl !== "") {
    return normalizeApiRoot(opts.envFallbackUrl);
  }
  if (/\.onrender\.com$/i.test(opts.hostname)) {
    return normalizeApiRoot(opts.origin);
  }
  if (/\.vercel\.app$/i.test(opts.hostname)) {
    return "";
  }
  return normalizeApiRoot(opts.origin);
}

export function resolveRequestApiBase(opts: {
  builtInApiBase: string;
  envFallbackUrl: string;
  hostname: string;
  origin: string;
}): string {
  const built =
    opts.builtInApiBase !== "" ? normalizeBaseUrl(opts.builtInApiBase) : "";
  if (built !== "") return built;
  return normalizeBaseUrl(
    resolveRuntimeApiFallbackBase({
      envFallbackUrl: opts.envFallbackUrl,
      hostname: opts.hostname,
      origin: opts.origin,
    }),
  );
}
