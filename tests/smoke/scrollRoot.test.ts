import { describe, expect, it } from "vitest";
import { SCROLL_ROOT_SELECTOR } from "../../frontend/src/utils/scrollRoot";

describe("scrollRoot", () => {
  it("targets storefront scroll container with data attribute", () => {
    expect(SCROLL_ROOT_SELECTOR).toContain("data-sf-scroll-root");
    expect(SCROLL_ROOT_SELECTOR).toContain(".sf-root.sf-app");
  });
});
