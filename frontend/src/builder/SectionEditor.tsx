import type React from "react";
import { registryByType } from "./sectionRegistry";
import { HeroEditor } from "./editors/HeroEditor";
import { PromoEditor } from "./editors/PromoEditor";
import { CategoriesEditor } from "./editors/CategoriesEditor";
import { FeaturedProductsEditor } from "./editors/FeaturedProductsEditor";
import { FooterEditor } from "./editors/FooterEditor";

export function SectionEditor(props: {
  section: { id: string; type: string; config: Record<string, unknown> } & Record<string, unknown>;
  onChange: (
    next: { id: string; type: string; config: Record<string, unknown> } & Record<string, unknown>,
  ) => void;
}): React.ReactElement {
  const meta = registryByType(props.section.type);
  const editorKey = meta?.editorKey ?? "unsupported";
  const value = props.section.config ?? {};

  const onConfigChange = (nextConfig: Record<string, unknown>) => {
    props.onChange({ ...props.section, config: nextConfig });
  };

  return (
    <div style={{ padding: 0 }}>
      {editorKey === "hero" ? (
        <HeroEditor value={value} onChange={onConfigChange} />
      ) : editorKey === "promo" ? (
        <PromoEditor value={value} onChange={onConfigChange} />
      ) : editorKey === "categories" ? (
        <CategoriesEditor value={value} onChange={onConfigChange} />
      ) : editorKey === "featuredProducts" ? (
        <FeaturedProductsEditor value={value} onChange={onConfigChange} />
      ) : editorKey === "footer" ? (
        <FooterEditor value={value} onChange={onConfigChange} />
      ) : (
        <div style={{ padding: 12, opacity: 0.85 }}>
          Для секции <b>{props.section.type}</b> пока нет визуального редактора.
        </div>
      )}
    </div>
  );
}

