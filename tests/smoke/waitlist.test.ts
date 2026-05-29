import { describe, expect, it } from "vitest";
import { parseWaitlistCallbackData } from "../../src/bot/waitlistCallbacks.js";
import {
  WAITLIST_INVITE_TIMEOUT_MINUTES,
  waitlistStatusLabel,
} from "../../src/shared/waitlist.js";
import { computeWaitlistInviteExpiresAt } from "../../src/server/tableReservationWaitlistService.js";

describe("waitlist telegram callbacks", () => {
  it("parses accept callback", () => {
    expect(parseWaitlistCallbackData("waitlist_accept_12")).toEqual({
      action: "accept",
      entryId: 12,
    });
  });

  it("parses decline callback", () => {
    expect(parseWaitlistCallbackData("waitlist_decline_7")).toEqual({
      action: "decline",
      entryId: 7,
    });
  });

  it("ignores unrelated callbacks", () => {
    expect(parseWaitlistCallbackData("reservation_confirm_1")).toBeNull();
  });
});

describe("waitlist statuses", () => {
  it("labels queue states", () => {
    expect(waitlistStatusLabel("WAITING")).toBe("В очереди");
    expect(waitlistStatusLabel("INVITED")).toBe("Приглашён");
    expect(waitlistStatusLabel("SEATED")).toBe("Посажен");
  });

  it("uses 15 minute invite window", () => {
    expect(WAITLIST_INVITE_TIMEOUT_MINUTES).toBe(15);
    const now = new Date("2026-06-28T18:00:00.000Z");
    expect(computeWaitlistInviteExpiresAt(now).toISOString()).toBe(
      "2026-06-28T18:15:00.000Z",
    );
  });
});
