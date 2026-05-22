import { describe, expect, it } from "vitest";
import {
  assessTelegramInitData,
  parseInitDataMeta,
  telegramSessionFailureMessage,
} from "../../frontend/src/utils/telegramSession.ts";

function sampleInitData(authDateSec: number): string {
  const user = encodeURIComponent(JSON.stringify({ id: 12345, first_name: "T" }));
  const hash = "a".repeat(64);
  return `user=${user}&auth_date=${authDateSec}&hash=${hash}`;
}

describe("telegram session assessment (client)", () => {
  it("parses user id and auth_date", () => {
    const now = Math.floor(Date.now() / 1000);
    const meta = parseInitDataMeta(sampleInitData(now));
    expect(meta?.userId).toBe("12345");
    expect(meta?.authDate).toBe(now);
    expect(meta?.ageSec).toBeGreaterThanOrEqual(0);
  });

  it("marks fresh signed initData as ready", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(assessTelegramInitData(sampleInitData(now))).toBe("ready");
  });

  it("marks old auth_date as stale", () => {
    const old = Math.floor(Date.now() / 1000) - 200_000;
    expect(assessTelegramInitData(sampleInitData(old), { maxAgeSec: 86_400 })).toBe(
      "stale",
    );
  });

  it("marks empty string as empty", () => {
    expect(assessTelegramInitData("")).toBe("empty");
  });

  it("marks malformed payload as invalid", () => {
    expect(assessTelegramInitData("user=broken&hash=short")).toBe("invalid");
  });

  it("exposes RU failure messages", () => {
    expect(telegramSessionFailureMessage("stale")).toMatch(/устарел/i);
    expect(telegramSessionFailureMessage("timeout")).toMatch(/обновите/i);
  });
});
