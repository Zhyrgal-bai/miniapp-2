import { randomUUID } from "node:crypto";
import type { YandexDeliveryConfig } from "../services/yandexDeliveryConfig.js";
import {
  logYandexDeliveryRequest,
  logYandexDeliveryResponse,
} from "../utils/yandexDeliveryLogging.js";

export type YandexHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type YandexHttpFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export type YandexHttpRequestOptions = {
  method: YandexHttpMethod;
  path: string;
  body?: unknown;
  requestId?: string;
  correlationId?: string;
  headers?: Record<string, string>;
};

export type YandexHttpSuccess<T> = {
  ok: true;
  status: number;
  data: T;
  requestId: string;
  durationMs: number;
};

export type YandexHttpFailure = {
  ok: false;
  kind: "timeout" | "network" | "http" | "parse_error";
  error: string;
  requestId: string;
  durationMs: number;
  status?: number;
  retryable?: boolean;
  rawBody?: string;
};

export type YandexHttpResult<T> = YandexHttpSuccess<T> | YandexHttpFailure;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function backoffMs(baseMs: number, attempt: number): number {
  const exp = baseMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(exp + jitter, 8_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
}

export type YandexHttpClient = {
  request<T>(options: YandexHttpRequestOptions): Promise<YandexHttpResult<T>>;
  post<T>(
    path: string,
    body: unknown,
    options?: { requestId?: string; correlationId?: string },
  ): Promise<YandexHttpResult<T>>;
};

export function createYandexHttpClient(
  config: YandexDeliveryConfig,
  options?: { fetchImpl?: YandexHttpFetch },
): YandexHttpClient {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const maxAttempts = config.maxRetries + 1;

  async function executeOnce<T>(
    options: YandexHttpRequestOptions,
    attempt: number,
  ): Promise<YandexHttpResult<T>> {
    const requestId = options.requestId?.trim() || randomUUID();
    const started = Date.now();
    const endpoint = options.path;

    logYandexDeliveryRequest({
      requestId,
      method: options.method,
      endpoint,
      attempt,
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.oauthToken}`,
        Accept: "application/json",
        "Accept-Language": "ru",
        "X-Request-Id": requestId,
        ...options.headers,
      };

      const init: RequestInit = {
        method: options.method,
        headers,
        signal: controller.signal,
      };

      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(options.body);
      }

      const res = await fetchImpl(buildUrl(config.apiBaseUrl, options.path), init);
      const text = await res.text();
      const durationMs = Date.now() - started;

      if (!res.ok) {
        const retryable = isRetryableStatus(res.status);
        logYandexDeliveryResponse({
          requestId,
          method: options.method,
          endpoint,
          httpStatus: res.status,
          durationMs,
          attempt,
          ok: false,
          retryable,
          errorKind: "http",
          ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        });
        return {
          ok: false,
          kind: "http",
          error: `HTTP ${res.status}`,
          requestId,
          durationMs,
          status: res.status,
          retryable,
          rawBody: text,
        };
      }

      if (text.trim() === "") {
        logYandexDeliveryResponse({
          requestId,
          method: options.method,
          endpoint,
          httpStatus: res.status,
          durationMs,
          attempt,
          ok: true,
          ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        });
        return {
          ok: true,
          status: res.status,
          data: {} as T,
          requestId,
          durationMs,
        };
      }

      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        logYandexDeliveryResponse({
          requestId,
          method: options.method,
          endpoint,
          httpStatus: res.status,
          durationMs,
          attempt,
          ok: false,
          errorKind: "parse_error",
          ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        });
        return {
          ok: false,
          kind: "parse_error",
          error: "Non-JSON response from Yandex API",
          requestId,
          durationMs,
          status: res.status,
          retryable: false,
        };
      }

      logYandexDeliveryResponse({
        requestId,
        method: options.method,
        endpoint,
        httpStatus: res.status,
        durationMs,
        attempt,
        ok: true,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      });

      return {
        ok: true,
        status: res.status,
        data,
        requestId,
        durationMs,
      };
    } catch (e) {
      const durationMs = Date.now() - started;
      if (e instanceof Error && e.name === "AbortError") {
        logYandexDeliveryResponse({
          requestId,
          method: options.method,
          endpoint,
          durationMs,
          attempt,
          ok: false,
          retryable: true,
          errorKind: "timeout",
          ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        });
        return {
          ok: false,
          kind: "timeout",
          error: `Request timed out after ${config.timeoutMs}ms`,
          requestId,
          durationMs,
          retryable: true,
        };
      }

      const message = e instanceof Error ? e.message : String(e);
      logYandexDeliveryResponse({
        requestId,
        method: options.method,
        endpoint,
        durationMs,
        attempt,
        ok: false,
        retryable: true,
        errorKind: "network",
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      });
      return {
        ok: false,
        kind: "network",
        error: message,
        requestId,
        durationMs,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function request<T>(
    options: YandexHttpRequestOptions,
  ): Promise<YandexHttpResult<T>> {
    let lastResult: YandexHttpResult<T> | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await executeOnce<T>(options, attempt + 1);
      lastResult = result;

      if (result.ok) return result;

      const canRetry = result.retryable === true && attempt < maxAttempts - 1;
      if (!canRetry) return result;

      await sleep(backoffMs(config.retryBaseMs, attempt));
    }

    return (
      lastResult ?? {
        ok: false,
        kind: "network",
        error: "Request failed",
        requestId: options.requestId ?? randomUUID(),
        durationMs: 0,
        retryable: false,
      }
    );
  }

  return {
    request,
    post<T>(
      path: string,
      body: unknown,
      postOptions?: { requestId?: string; correlationId?: string },
    ): Promise<YandexHttpResult<T>> {
      return request<T>({
        method: "POST",
        path,
        body,
        ...(postOptions?.requestId ? { requestId: postOptions.requestId } : {}),
        ...(postOptions?.correlationId
          ? { correlationId: postOptions.correlationId }
          : {}),
      });
    },
  };
}
