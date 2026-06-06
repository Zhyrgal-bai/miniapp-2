import { describe, expect, it } from "vitest";
import {
  canonicalStorePath,
  isStoreSlugAliasPath,
  mergeTenantIntoLocation,
  parseStoreSlugFromPath,
} from "../../frontend/src/utils/storeParams";

describe("storeParams canonical routing", () => {
  it("canonicalStorePath uses /s/ prefix", () => {
    expect(canonicalStorePath("100-rozes")).toBe("/s/100-rozes");
    expect(canonicalStorePath("CupCoffee")).toBe("/s/cupcoffee");
  });

  it("parseStoreSlugFromPath accepts /s/ and /store/", () => {
    expect(parseStoreSlugFromPath("/s/bars")).toBe("bars");
    expect(parseStoreSlugFromPath("/store/bars")).toBe("bars");
  });

  it("isStoreSlugAliasPath detects legacy /store/ only", () => {
    expect(isStoreSlugAliasPath("/store/bars")).toBe(true);
    expect(isStoreSlugAliasPath("/s/bars")).toBe(false);
    expect(isStoreSlugAliasPath("/")).toBe(false);
  });

  it("mergeTenantIntoLocation prefers /s/{slug}", () => {
    const out = mergeTenantIntoLocation({
      pathname: "/",
      rawSearch: "?shop=4&view=my-orders",
      shopIdString: "4",
      storefrontSlug: "100-rozes",
    });
    expect(out.pathname).toBe("/s/100-rozes");
    expect(out.search).toBe("?view=my-orders");
  });

  it("mergeTenantIntoLocation falls back to ?shop= without slug", () => {
    const out = mergeTenantIntoLocation({
      pathname: "/",
      rawSearch: "",
      shopIdString: "99",
      storefrontSlug: null,
    });
    expect(out.pathname).toBe("/");
    expect(out.search).toBe("?shop=99");
  });
});
