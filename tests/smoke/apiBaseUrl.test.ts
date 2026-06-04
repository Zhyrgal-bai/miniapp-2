import { describe, expect, it } from "vitest";
import {
  resolveRequestApiBase,
  resolveRuntimeApiFallbackBase,
} from "../../frontend/src/services/apiBaseUrl.ts";

describe("apiBaseUrl", () => {
  it("uses current origin on Render host", () => {
    const loc = {
      hostname: "miniapp-2-qipd.onrender.com",
      origin: "https://miniapp-2-qipd.onrender.com",
    };
    expect(
      resolveRuntimeApiFallbackBase({ envFallbackUrl: "", ...loc }),
    ).toBe("https://miniapp-2-qipd.onrender.com");
    expect(
      resolveRequestApiBase({ builtInApiBase: "", envFallbackUrl: "", ...loc }),
    ).toBe("https://miniapp-2-qipd.onrender.com");
  });

  it("does not fall back to legacy miniapp-store on Vercel without env", () => {
    const loc = {
      hostname: "miniapp-2-tau.vercel.app",
      origin: "https://miniapp-2-tau.vercel.app",
    };
    expect(resolveRuntimeApiFallbackBase({ envFallbackUrl: "", ...loc })).toBe(
      "",
    );
    expect(
      resolveRequestApiBase({ builtInApiBase: "", envFallbackUrl: "", ...loc }),
    ).toBe("");
  });

  it("prefers VITE_API_URL baked into bundle", () => {
    expect(
      resolveRequestApiBase({
        builtInApiBase: "https://miniapp-2-qipd.onrender.com",
        envFallbackUrl: "",
        hostname: "miniapp-2-tau.vercel.app",
        origin: "https://miniapp-2-tau.vercel.app",
      }),
    ).toBe("https://miniapp-2-qipd.onrender.com");
  });
});
