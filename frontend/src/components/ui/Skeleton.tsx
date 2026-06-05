import "./skeleton.css";

export function SkeletonBlock(props: {
  className?: string;
  rounded?: boolean;
}): React.ReactElement {
  const cls = [
    "sf-skeleton",
    props.rounded ? "sf-skeleton--rounded" : "",
    props.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={cls} aria-hidden />;
}

export function StorefrontLoadingSkeleton(): React.ReactElement {
  return (
    <div className="sf-skeleton-page" role="status" aria-label="Загрузка витрины">
      <div className="sf-skeleton-store-card">
        <SkeletonBlock className="sf-skeleton-store-card__logo" rounded />
        <div className="sf-skeleton-store-card__lines">
          <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--lg" />
          <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--sm" />
          <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--badge" rounded />
        </div>
      </div>
      <SkeletonBlock className="sf-skeleton-search" rounded />
      <div className="sf-skeleton-chips">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="sf-skeleton-chip" rounded />
        ))}
      </div>
      <div className="sf-skeleton-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sf-skeleton-product">
            <SkeletonBlock className="sf-skeleton-product__img" rounded />
            <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--md" />
            <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--xs" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductCardSkeleton(): React.ReactElement {
  return (
    <div className="sf-skeleton-product" aria-hidden>
      <SkeletonBlock className="sf-skeleton-product__img" rounded />
      <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--md" />
      <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--xs" />
    </div>
  );
}

export function CheckoutLoadingSkeleton(): React.ReactElement {
  return (
    <div className="sf-skeleton-checkout" role="status" aria-label="Загрузка оформления">
      <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--lg" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="sf-skeleton-checkout-row">
          <SkeletonBlock className="sf-skeleton-checkout-row__thumb" rounded />
          <div className="sf-skeleton-checkout-row__copy">
            <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--md" />
            <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--xs" />
          </div>
        </div>
      ))}
      <SkeletonBlock className="sf-skeleton-line sf-skeleton-line--total" rounded />
    </div>
  );
}
