import React from "react";
import type { Product } from "../../types";
import ProductCard from "../../components/product/ProductCard";
import type { StorefrontCardConfig } from "./ProductCardControls";

const DEMO: Product = {
  id: 0,
  name: "Demo product",
  price: 1990,
  image: "https://res.cloudinary.com/demo/image/upload/w_600/sample.jpg",
  images: ["https://res.cloudinary.com/demo/image/upload/w_600/sample.jpg"],
  description: "Preview карточки товара",
  categoryId: 0,
} as unknown as Product;

export function ProductCardPreview(props: {
  value: StorefrontCardConfig;
}): React.ReactElement {
  return (
    <div style={{ maxWidth: 260 }}>
      <ProductCard
        product={DEMO}
        showToast={() => undefined}
        cardConfig={props.value as unknown as Record<string, unknown>}
      />
    </div>
  );
}

