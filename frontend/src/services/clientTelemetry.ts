/**
 * Lightweight client error reporting for beta / release validation.
 */
import { api } from "./api";

export function reportClientError(input: {
  message: string;
  page?: string;
  component?: string;
}): void {
  const message = String(input.message ?? "").trim();
  if (message.length < 2) return;
  void api
    .post("/api/telemetry/client-error", {
      message: message.slice(0, 500),
      page: input.page?.slice(0, 128),
      component: input.component?.slice(0, 64),
    })
    .catch(() => undefined);
}
