import { describe, expect, it } from "vitest";
import {
  ARCHA_FOUNDERS,
  buildArchaAboutMessage,
  buildArchaFoundersFaqAnswer,
  archaAboutInlineKeyboard,
} from "../../src/bot/archaAboutContent.js";

describe("archaAboutContent (registration bot)", () => {
  it("includes founders with verified Instagram URLs", () => {
    expect(ARCHA_FOUNDERS).toHaveLength(3);
    expect(ARCHA_FOUNDERS[0]?.instagramUrl).toBe(
      "https://instagram.com/zhyrgal4_ik",
    );
    expect(ARCHA_FOUNDERS[1]?.instagramUrl).toBe(
      "https://instagram.com/umar09r_",
    );
    expect(ARCHA_FOUNDERS[2]?.instagramUrl).toBe(
      "https://instagram.com/_sharshenbekov_kg",
    );
  });

  it("builds about message under Telegram limit", () => {
    const text = buildArchaAboutMessage();
    expect(text).toMatch(/ARCHA/);
    expect(text).toMatch(/Кыргызстан/);
    expect(text.length).toBeLessThan(4096);
  });

  it("adds Instagram url buttons and back", () => {
    const kb = archaAboutInlineKeyboard();
    expect(kb.inline_keyboard).toHaveLength(4);
    expect(kb.inline_keyboard[0]?.[0]).toMatchObject({
      url: "https://instagram.com/zhyrgal4_ik",
    });
    expect(kb.inline_keyboard[3]?.[0]).toMatchObject({
      callback_data: "saas_back_menu",
    });
  });

  it("FAQ answer mentions founders", () => {
    const ans = buildArchaFoundersFaqAnswer();
    expect(ans).toMatch(/Жыргалбек/);
    expect(ans).toMatch(/@zhyrgal4_ik/);
  });
});
