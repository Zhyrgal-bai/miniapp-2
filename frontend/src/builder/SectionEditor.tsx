import type React from "react";
import { registryByType } from "./sectionRegistry";
import { lazy, Suspense } from "react";

const HeroEditor = lazy(() => import("./editors/HeroEditor").then((m) => ({ default: m.HeroEditor })));
const PromoEditor = lazy(() => import("./editors/PromoEditor").then((m) => ({ default: m.PromoEditor })));
const CategoriesEditor = lazy(() => import("./editors/CategoriesEditor").then((m) => ({ default: m.CategoriesEditor })));
const FeaturedProductsEditor = lazy(() =>
  import("./editors/FeaturedProductsEditor").then((m) => ({ default: m.FeaturedProductsEditor })),
);
const FooterEditor = lazy(() => import("./editors/FooterEditor").then((m) => ({ default: m.FooterEditor })));

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
      <Suspense fallback={<div style={{ padding: 12, opacity: 0.8 }}>Загрузка редактора…</div>}>
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
      </Suspense>
    </div>
  );
}

