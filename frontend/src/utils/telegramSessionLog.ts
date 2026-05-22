type LogFields = Record<string, unknown>;

const DEV_SESSION_LOG =
  typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

/** Structured client session events — verbose logs only in dev. */
export function logTelegramSession(event: string, fields: LogFields = {}): void {
  if (typeof console === "undefined") return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "telegram_session",
    event,
    ...fields,
  });
  const isProblem =
    event === "initData_wait_timeout" ||
    event === "telegram_session_invalid" ||
    event === "initData_empty";
  if (!DEV_SESSION_LOG && !isProblem) return;
  if (isProblem) {
    console.warn(line);
    return;
  }
  console.log(line);
}
