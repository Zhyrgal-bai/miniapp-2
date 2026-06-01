import { describe, expect, it } from "vitest";
import {
  MSG_INVALID_BOT_TOKEN,
  precheckBotTokenBeforeOwnerChange,
} from "../../src/server/registrationTokenGate.js";

describe("precheckBotTokenBeforeOwnerChange", () => {
  it("rejects invalid token shape without hitting network-heavy paths early", async () => {
    const r = await precheckBotTokenBeforeOwnerChange("not-a-token", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(400);
      expect(r.error).toBe(MSG_INVALID_BOT_TOKEN);
    }
  });

  it("rejects empty trimmed token", async () => {
    const r = await precheckBotTokenBeforeOwnerChange("   ", 1);
    expect(r.ok).toBe(false);
  });
});
