/**
 * Platform onboarding funnel — batched ingest for release validation.
 */
import { apiAbsoluteUrl } from "./api";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";

export type PlatformFunnelStep =
  | "platform_view"
  | "onboarding_step_1"
  | "onboarding_step_2"
  | "onboarding_step_3"
  | "onboarding_complete"
  | "register_start"
  | "register_submit"
  | "store_open"
  | "settings_open"
  | "admin_open";

type Queued = {
  step: PlatformFunnelStep;
  businessId?: number;
  meta?: Record<string, unknown>;
};

const queue: Queued[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPlatformFunnel();
  }, 600);
}

export function trackPlatformFunnel(
  step: PlatformFunnelStep,
  opts?: { businessId?: number; meta?: Record<string, unknown> },
): void {
  queue.push({
    step,
    businessId: opts?.businessId,
    meta: opts?.meta,
  });
  scheduleFlush();
}

async function flushPlatformFunnel(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, 16);
  try {
    await fetch(apiAbsoluteUrl("/api/platform/funnel/events"), {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...telegramWebAppInitDataHeader(),
      },
      body: JSON.stringify({
        events: batch.map((ev) => ({
          step: ev.step,
          businessId: ev.businessId,
          meta: ev.meta ?? {},
        })),
      }),
    });
  } catch {
    // Non-blocking — release metrics must not break UX
  }
}
