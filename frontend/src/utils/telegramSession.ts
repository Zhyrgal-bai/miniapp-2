import { getTelegramWebApp } from "./telegram";
import { ensureTelegramMobileUx } from "./telegramWebAppBootstrap";
import { logTelegramSession } from "./telegramSessionLog";

export type TelegramInitDataAssessment =
  | "empty"
  | "loading"
  | "invalid"
  | "stale"
  | "ready";

export type TelegramSessionFailureReason =
  | "empty"
  | "invalid"
  | "stale"
  | "timeout";

export type InitDataMeta = {
  hash: string;
  userId: string | null;
  authDate: number | null;
  ageSec: number | null;
};

const DEFAULT_MIN_LENGTH = 20;
const DEFAULT_MAX_AGE_SEC = 86_400;

function maxInitDataAgeSec(): number {
  const raw = import.meta.env.VITE_TG_INITDATA_MAX_AGE_SEC;
  if (raw == null || String(raw).trim() === "") return DEFAULT_MAX_AGE_SEC;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_AGE_SEC;
}

/** True only inside a real Telegram Mini App host (not bare browser with SDK script). */
export function isTelegramMiniAppEnv(): boolean {
  if (typeof window === "undefined") return false;
  const tg = window.Telegram?.WebApp;
  if (tg == null) return false;

  const initData = tg.initData?.trim() ?? "";
  if (initData.length > 0) return true;

  const user = tg.initDataUnsafe?.user;
  if (user != null && typeof user.id === "number" && user.id > 0) {
    return true;
  }

  const platform = String(tg.platform ?? "").trim().toLowerCase();
  if (
    platform !== "" &&
    platform !== "unknown" &&
    platform !== "web" /* telegram.org in desktop browser, not Mini App */
  ) {
    return true;
  }

  return false;
}

/** Signed initData string from Telegram WebApp (never initDataUnsafe). */
export function readTelegramInitData(): string {
  return getTelegramWebApp()?.initData?.trim() ?? "";
}

export function parseInitDataMeta(initData: string): InitDataMeta | null {
  const raw = initData.trim();
  if (raw === "") return null;
  try {
    const params = new URLSearchParams(raw);
    const hash = params.get("hash")?.trim() ?? "";
    const authRaw = params.get("auth_date")?.trim() ?? "";
    const authDate =
      authRaw !== "" && /^\d+$/.test(authRaw) ? Number(authRaw) : null;
    let userId: string | null = null;
    const userJson = params.get("user")?.trim() ?? "";
    if (userJson !== "") {
      try {
        const u = JSON.parse(userJson) as { id?: unknown };
        if (typeof u.id === "number" && Number.isFinite(u.id) && u.id > 0) {
          userId = String(Math.trunc(u.id));
        }
      } catch {
        /* ignore */
      }
    }
    const ageSec =
      authDate != null && Number.isFinite(authDate)
        ? Math.max(0, Math.floor(Date.now() / 1000) - authDate)
        : null;
    return { hash, userId, authDate, ageSec };
  } catch {
    return null;
  }
}

export function assessTelegramInitData(
  initData: string,
  opts?: { minLength?: number; maxAgeSec?: number },
): TelegramInitDataAssessment {
  const minLength = opts?.minLength ?? DEFAULT_MIN_LENGTH;
  const trimmed = initData.trim();

  if (trimmed === "") {
    if (isTelegramMiniAppEnv()) {
      const unsafe = getTelegramWebApp()?.initDataUnsafe;
      if (unsafe?.user != null) return "loading";
    }
    return "empty";
  }

  if (trimmed.length < minLength) return "invalid";

  const meta = parseInitDataMeta(trimmed);
  if (meta == null) return "invalid";
  if (!/^[0-9a-f]{64}$/i.test(meta.hash)) return "invalid";
  if (meta.userId == null) return "invalid";

  const maxAge = opts?.maxAgeSec ?? maxInitDataAgeSec();
  if (meta.ageSec != null && meta.ageSec > maxAge) return "stale";

  return "ready";
}

export function hasVerifiedTelegramInitData(initData: string): boolean {
  return assessTelegramInitData(initData) === "ready";
}

export function telegramSessionFailureMessage(
  reason: TelegramSessionFailureReason,
): string {
  switch (reason) {
    case "empty":
      return "Откройте магазин через Telegram Mini App из бота.";
    case "stale":
      return "Сессия Telegram устарела. Закройте Mini App и откройте снова из бота.";
    case "invalid":
      return "Данные Telegram повреждены. Обновите страницу или переоткройте Mini App.";
    case "timeout":
      return "Не удалось получить данные Telegram. Подождите секунду и обновите страницу.";
    default:
      return "Требуется авторизация Telegram Mini App.";
  }
}

export type WaitForInitDataOptions = {
  /** Total wait budget (ms). Default 4500. */
  timeoutMs?: number;
  pollMs?: number;
  /** Consecutive stable ready reads required. Default 2. */
  stableTicks?: number;
  minLength?: number;
  maxAgeSec?: number;
  /** When true, throws on failure instead of returning partial initData. */
  required?: boolean;
};

export type WaitInitDataResult =
  | { ok: true; initData: string; assessment: "ready" }
  | {
      ok: false;
      reason: TelegramSessionFailureReason;
      initData: string;
      assessment: TelegramInitDataAssessment;
    };

export async function waitForTelegramInitDataResult(
  options: WaitForInitDataOptions = {},
): Promise<WaitInitDataResult> {
  const timeoutMs = options.timeoutMs ?? 4_500;
  const pollMs = options.pollMs ?? 100;
  const stableTicks = options.stableTicks ?? 2;
  const assessOpts = {
    minLength: options.minLength,
    maxAgeSec: options.maxAgeSec,
  };

  if (isTelegramMiniAppEnv()) {
    ensureTelegramMobileUx();
  }

  const deadline = Date.now() + timeoutMs;
  let lastReady = "";
  let readyStreak = 0;

  while (Date.now() < deadline) {
    const initData = readTelegramInitData();
    const assessment = assessTelegramInitData(initData, assessOpts);

    if (assessment === "ready") {
      if (initData === lastReady) readyStreak += 1;
      else {
        lastReady = initData;
        readyStreak = 1;
      }
      if (readyStreak >= stableTicks) {
        logTelegramSession("initData_loaded", {
          length: initData.length,
          stableTicks: readyStreak,
        });
        return { ok: true, initData, assessment: "ready" };
      }
    } else if (assessment === "stale") {
      logTelegramSession("initData_stale", {
        length: initData.length,
        ageSec: parseInitDataMeta(initData)?.ageSec ?? null,
      });
      return { ok: false, reason: "stale", initData, assessment };
    } else if (assessment === "invalid" && initData.trim().length >= (options.minLength ?? DEFAULT_MIN_LENGTH)) {
      logTelegramSession("telegram_session_invalid", {
        length: initData.length,
        phase: "wait_loop",
      });
      return { ok: false, reason: "invalid", initData, assessment };
    } else {
      readyStreak = 0;
      lastReady = "";
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  const initData = readTelegramInitData();
  const assessment = assessTelegramInitData(initData, assessOpts);

  if (assessment === "ready") {
    logTelegramSession("initData_loaded", {
      length: initData.length,
      stableTicks: 1,
      note: "deadline_without_full_stabilization",
    });
    return { ok: true, initData, assessment: "ready" };
  }

  if (assessment === "empty") {
    logTelegramSession("initData_empty", { waitedMs: timeoutMs });
  } else if (assessment === "stale") {
    logTelegramSession("initData_stale", {
      length: initData.length,
      ageSec: parseInitDataMeta(initData)?.ageSec ?? null,
    });
  } else if (assessment === "invalid") {
    logTelegramSession("telegram_session_invalid", {
      length: initData.length,
      phase: "wait_timeout",
    });
  }

  logTelegramSession("initData_wait_timeout", {
    waitedMs: timeoutMs,
    assessment,
    length: initData.length,
  });

  const reason: TelegramSessionFailureReason =
    assessment === "stale"
      ? "stale"
      : assessment === "invalid"
        ? "invalid"
        : "timeout";

  return { ok: false, reason, initData, assessment };
}

/** Waits for stable signed initData; throws when `required` and session is not ready. */
export async function waitForTelegramInitData(
  options: WaitForInitDataOptions = {},
): Promise<string> {
  const result = await waitForTelegramInitDataResult(options);
  if (result.ok) return result.initData;
  if (options.required === true) {
    throw new Error(telegramSessionFailureMessage(result.reason));
  }
  return result.initData;
}

/** Privileged API calls — fail fast with RU message instead of empty auth header. */
export async function requireTelegramInitData(
  options: Omit<WaitForInitDataOptions, "required"> = {},
): Promise<string> {
  return waitForTelegramInitData({ ...options, required: true });
}

/** Re-check session after foreground / long background (iOS WebView). */
export async function refreshTelegramSessionAssessment(): Promise<{
  assessment: TelegramInitDataAssessment;
  initData: string;
  wait: WaitInitDataResult;
}> {
  if (isTelegramMiniAppEnv()) {
    ensureTelegramMobileUx();
  }
  const wait = await waitForTelegramInitDataResult({
    timeoutMs: 2_500,
    pollMs: 80,
    stableTicks: 1,
  });
  if (wait.ok) {
    return { assessment: "ready", initData: wait.initData, wait };
  }
  return {
    assessment: wait.assessment,
    initData: wait.initData,
    wait,
  };
}
