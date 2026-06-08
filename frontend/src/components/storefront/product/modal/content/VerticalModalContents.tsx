import type { Product } from "../../../../../types";
import {
  ProductExperienceScreen,
  type ProductExperienceScreenProps,
} from "../../ProductExperienceScreen";

type BaseProps = Omit<
  ProductExperienceScreenProps,
  "quickView" | "heroFacts" | "noticeText" | "addLabelOverride" | "layoutId"
> & { product: Product };

function withQuickView(
  props: BaseProps,
  options: {
    heroFacts?: Array<string | null>;
    noticeText?: string | null;
    addLabelOverride?: string | null;
    layoutId: ProductExperienceScreenProps["layoutId"];
  },
): React.ReactElement {
  const heroFacts = (options.heroFacts ?? []).filter(
    (x): x is string => typeof x === "string" && x.trim() !== "",
  );
  return (
    <ProductExperienceScreen
      {...props}
      quickView
      heroFacts={heroFacts}
      noticeText={options.noticeText ?? null}
      addLabelOverride={options.addLabelOverride ?? null}
      layoutId={options.layoutId}
    />
  );
}

export function GenericProductModalContent(props: BaseProps): React.ReactElement {
  return withQuickView(props, { layoutId: "generic" });
}

export { ClothingPdpContent as ClothingProductModalContent } from "./ClothingPdpContent";
export { FlowersPdpContent as FlowersProductModalContent } from "./FlowersPdpContent";
export { FastfoodPdpContent as FastfoodProductModalContent } from "./FastfoodPdpContent";
export { CoffeePdpContent as CoffeeProductModalContent } from "./CoffeePdpContent";
export { ElectronicsPdpContent as ElectronicsProductModalContent } from "./ElectronicsPdpContent";
export { AutopartsPdpContent as AutopartsProductModalContent } from "./AutopartsPdpContent";
export { CosmeticsPdpContent as CosmeticsProductModalContent } from "./CosmeticsPdpContent";
export { FurniturePdpContent as FurnitureProductModalContent } from "./FurniturePdpContent";

