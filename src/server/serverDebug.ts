/** Gate verbose server logs — production stays quiet unless explicitly enabled. */
export function isVerboseServerLogging(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.TELEGRAM_INIT_DEBUG === "1";
}

export function logVerbose(...args: unknown[]): void {
  if (isVerboseServerLogging()) {
    console.log(...args);
  }
}
