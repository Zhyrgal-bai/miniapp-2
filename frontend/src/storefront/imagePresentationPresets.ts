export type CatalogImageRatio = "portrait" | "square" | "landscape";
export type CatalogImageFit = "cover" | "contain";

export type CatalogImagePresentation = {
  imageRatio: CatalogImageRatio;
  imageFit: CatalogImageFit;
};

/** V4.2 Phase 1 — business-type defaults for catalog image layer. */
export function imagePresentationForBusinessType(
  businessTypeRaw: string | null | undefined,
): CatalogImagePresentation {
  const t = String(businessTypeRaw ?? "")
    .trim()
    .toLowerCase();

  if (t === "clothing" || t.includes("fashion")) {
    return { imageRatio: "portrait", imageFit: "cover" };
  }
  if (t === "flowers" || t.includes("flower")) {
    return { imageRatio: "portrait", imageFit: "cover" };
  }
  if (t === "coffee" || t === "fastfood") {
    return { imageRatio: "square", imageFit: "cover" };
  }
  if (t === "electronics" || t === "autoparts") {
    return { imageRatio: "square", imageFit: "contain" };
  }
  if (t === "cosmetics") {
    return { imageRatio: "portrait", imageFit: "cover" };
  }
  if (t === "furniture") {
    return { imageRatio: "landscape", imageFit: "cover" };
  }
  if (t === "universal") {
    return { imageRatio: "square", imageFit: "contain" };
  }

  return { imageRatio: "square", imageFit: "cover" };
}

/** Applies vertical image presentation after card preset merge. Explicit merchant keys win. */
export function applyImagePresentationForBusinessType(
  cfg: Record<string, unknown>,
  businessType: string | null | undefined,
  rawMerchantCfg?: Record<string, unknown> | null,
): Record<string, unknown> {
  const presentation = imagePresentationForBusinessType(businessType);
  const raw = rawMerchantCfg ?? {};
  const next = { ...cfg };
  const rawRatio = typeof raw.imageRatio === "string" ? raw.imageRatio.trim() : "";
  const rawFit = typeof raw.imageFit === "string" ? raw.imageFit.trim() : "";
  next.imageRatio = rawRatio !== "" ? rawRatio : presentation.imageRatio;
  next.imageFit = rawFit !== "" ? rawFit : presentation.imageFit;
  return next;
}
