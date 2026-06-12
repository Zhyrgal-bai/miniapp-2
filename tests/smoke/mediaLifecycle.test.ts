import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildImagesMetaFromUrls,
  findNewAssets,
  parseImagesMeta,
} from "../../src/media/imagesMetaSync.js";
import {
  extractPublicIdFromCloudinaryUrl,
  resolvePublicIdsFromUrls,
} from "../../src/media/publicIdFromUrl.js";
import { resolveProductImagePublicIds } from "../../src/media/delete.js";
import { isProductVisibleOnStorefront } from "../../src/server/catalog/catalogProductService.js";

const destroyMock = vi.fn(async () => ({ ok: true as const }));
const referencedMock = vi.fn(async () => false);

vi.mock("../../src/media/delete.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/media/delete.js")>();
  return {
    ...actual,
    safeDeleteCloudinaryAsset: (...args: unknown[]) => destroyMock(...args),
  };
});

vi.mock("../../src/media/referenceIndex.js", () => ({
  isPublicIdReferenced: (...args: unknown[]) => referencedMock(...args),
  collectReferencedPublicIds: vi.fn(async () => new Set<string>()),
}));

describe("media lifecycle — imagesMeta sync", () => {
  it("buildImagesMetaFromUrls retains meta for kept URLs and adds new assets", () => {
    const prev = [
      {
        url: "https://res.cloudinary.com/x/image/upload/v1/business_1/products/a.jpg",
        publicId: "business_1/products/a",
        width: 100,
        height: 100,
      },
    ];
    const newAssets = [
      {
        url: "https://res.cloudinary.com/x/image/upload/v1/business_1/products/b.jpg",
        publicId: "business_1/products/b",
        width: 200,
        height: 150,
        format: "jpg",
      },
    ];
    const meta = buildImagesMetaFromUrls(
      [
        "https://res.cloudinary.com/x/image/upload/v1/business_1/products/b.jpg",
        "https://res.cloudinary.com/x/image/upload/v1/business_1/products/a.jpg",
      ],
      prev,
      newAssets,
    );
    expect(meta).toHaveLength(2);
    expect(meta[0]?.publicId).toBe("business_1/products/b");
    expect(meta[1]?.publicId).toBe("business_1/products/a");
  });

  it("findNewAssets detects uploads not in previous meta", () => {
    const prev = parseImagesMeta([
      { url: "u1", publicId: "p1", width: 1, height: 1 },
    ]);
    const next = [
      { url: "u1", publicId: "p1", width: 1, height: 1 },
      { url: "u2", publicId: "p2", width: 2, height: 2 },
    ];
    expect(findNewAssets(prev, next)).toHaveLength(1);
    expect(findNewAssets(prev, next)[0]?.publicId).toBe("p2");
  });
});

describe("media lifecycle — publicId from URL", () => {
  it("extracts public_id from standard Cloudinary URL", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/v1699999999/business_3/products/photo.jpg";
    expect(extractPublicIdFromCloudinaryUrl(url)).toBe(
      "business_3/products/photo",
    );
  });

  it("extracts public_id when transforms are present", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/business_3/storefront/logo.png";
    expect(extractPublicIdFromCloudinaryUrl(url)).toBe(
      "business_3/storefront/logo",
    );
  });

  it("resolveProductImagePublicIds falls back to URLs when meta empty", () => {
    const ids = resolveProductImagePublicIds({
      imagesMeta: [],
      images: [
        "https://res.cloudinary.com/demo/image/upload/v1/business_1/products/x.jpg",
      ],
    });
    expect(ids).toEqual(["business_1/products/x"]);
  });

  it("resolvePublicIdsFromUrls deduplicates", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/v1/business_1/products/x.jpg";
    expect(resolvePublicIdsFromUrls([url, url])).toEqual(["business_1/products/x"]);
  });
});

describe("media lifecycle — archive visibility", () => {
  it("only ACTIVE products are storefront-visible", () => {
    expect(isProductVisibleOnStorefront("ACTIVE")).toBe(true);
    expect(isProductVisibleOnStorefront("ARCHIVED")).toBe(false);
    expect(isProductVisibleOnStorefront("DRAFT")).toBe(false);
  });
});

describe("media lifecycle — cleanup service", () => {
  beforeEach(() => {
    destroyMock.mockClear();
    referencedMock.mockClear();
    referencedMock.mockResolvedValue(false);
  });

  it("diffAndDeleteRemovedAssets destroys removed publicIds when unreferenced", async () => {
    const { diffAndDeleteRemovedAssets } = await import(
      "../../src/media/mediaCleanupService.js"
    );
    const prisma = {
      mediaAuditLog: { create: vi.fn() },
    } as unknown as import("@prisma/client").PrismaClient;

    const result = await diffAndDeleteRemovedAssets({
      prisma,
      businessId: 1,
      prevIds: ["business_1/products/old"],
      nextIds: ["business_1/products/keep"],
      reason: "test",
      auditEvent: "DELETE",
      actor: { actorType: "merchant" },
      excludeProductId: 5,
      allowLegacyStorefrontProductPaths: true,
    });

    expect(result.deleted).toContain("business_1/products/old");
    expect(destroyMock).toHaveBeenCalled();
  });

  it("skips destroy when publicId still referenced elsewhere", async () => {
    referencedMock.mockResolvedValueOnce(true);
    const { diffAndDeleteRemovedAssets } = await import(
      "../../src/media/mediaCleanupService.js"
    );
    const prisma = {
      mediaAuditLog: { create: vi.fn() },
    } as unknown as import("@prisma/client").PrismaClient;

    const result = await diffAndDeleteRemovedAssets({
      prisma,
      businessId: 1,
      prevIds: ["business_1/products/shared"],
      nextIds: [],
      reason: "test",
      auditEvent: "DELETE",
      actor: { actorType: "merchant" },
      excludeProductId: 5,
    });

    expect(result.skipped).toContain("business_1/products/shared");
    expect(destroyMock).not.toHaveBeenCalled();
  });
});

describe("media lifecycle — destroy queue", () => {
  it("enqueueMediaDestroy creates pending job", async () => {
    const create = vi.fn(async () => ({ id: 1 }));
    const findFirst = vi.fn(async () => null);
    const prisma = {
      mediaDestroyJob: { create, findFirst },
    } as unknown as import("@prisma/client").PrismaClient;

    const { enqueueMediaDestroy } = await import(
      "../../src/media/mediaDestroyQueue.js"
    );
    await enqueueMediaDestroy(prisma, {
      businessId: 2,
      publicId: "business_2/products/x",
      reason: "failed",
    });
    expect(create).toHaveBeenCalled();
  });
});

describe("media lifecycle — backward compatibility", () => {
  it("URL-only product images still resolve publicIds for purge fallback", () => {
    const ids = resolveProductImagePublicIds({
      image: "https://res.cloudinary.com/demo/image/upload/v1/business_9/storefront/legacy.jpg",
      images: [],
      imagesMeta: [],
    });
    expect(ids.length).toBe(1);
    expect(ids[0]).toContain("business_9/");
  });
});
