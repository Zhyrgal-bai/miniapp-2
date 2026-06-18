import type { Product } from "../../../../../types";
import {
  ProductExperienceScreen,
  type ProductExperienceScreenProps,
} from "../../ProductExperienceScreen";
import { ClothingPdpContent } from "./ClothingPdpContent";
import { FlowersPdpContent } from "./FlowersPdpContent";
import { FastfoodPdpContent } from "./FastfoodPdpContent";
import { CoffeePdpContent } from "./CoffeePdpContent";
import { ElectronicsPdpContent } from "./ElectronicsPdpContent";
import { AutopartsPdpContent } from "./AutopartsPdpContent";
import { CosmeticsPdpContent } from "./CosmeticsPdpContent";
import { FurniturePdpContent } from "./FurniturePdpContent";

type BaseProps = Omit<
  ProductExperienceScreenProps,
  "quickView" | "heroFacts" | "noticeText" | "addLabelOverride" | "layoutId"
> & { product: Product };

type VerticalProductModalContentProps = BaseProps & {
  rendererId: "product-experience-v2" | "generic-v2";
  forceGeneric?: boolean;
  pageLayout?: boolean;
};

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

function normalizeBusinessType(props: BaseProps): string {
  return String(props.businessType ?? props.product.businessType ?? "")
    .trim()
    .toLowerCase();
}

export function VerticalProductModalContent(
  props: VerticalProductModalContentProps,
): React.ReactElement {
  if (props.forceGeneric || props.rendererId === "generic-v2") {
    return <GenericProductModalContent {...props} />;
  }
  const vertical = normalizeBusinessType(props);
  if (vertical === "clothing") return <ClothingPdpContent {...props} pageLayout={props.pageLayout} />;
  if (vertical === "flowers") return <FlowersPdpContent {...props} />;
  if (vertical === "coffee") return <CoffeePdpContent {...props} />;
  if (vertical === "fastfood") return <FastfoodPdpContent {...props} />;
  if (vertical === "electronics") return <ElectronicsPdpContent {...props} />;
  if (vertical === "autoparts") return <AutopartsPdpContent {...props} />;
  if (vertical === "cosmetics") return <CosmeticsPdpContent {...props} />;
  if (vertical === "furniture") return <FurniturePdpContent {...props} />;
  return <GenericProductModalContent {...props} />;
}

export { ClothingPdpContent as ClothingProductModalContent };
export { FlowersPdpContent as FlowersProductModalContent };
export { FastfoodPdpContent as FastfoodProductModalContent };
export { CoffeePdpContent as CoffeeProductModalContent };
export { ElectronicsPdpContent as ElectronicsProductModalContent };
export { AutopartsPdpContent as AutopartsProductModalContent };
export { CosmeticsPdpContent as CosmeticsProductModalContent };
export { FurniturePdpContent as FurnitureProductModalContent };

