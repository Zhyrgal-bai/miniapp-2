function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function readItems(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const v = config.items;
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x != null && typeof x === "object" && !Array.isArray(x))
    .map((x) => x as Record<string, unknown>);
}

export function ReviewsSection(props: {
  config: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleReviews === "string" && String(props.textConfig.titleReviews).trim() !== ""
      ? String(props.textConfig.titleReviews)
      : "Отзывы";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  const items = readItems(props.config);
  if (items.length === 0) return null;

  return (
    <section className="sf-section sf-section--reviews sf-section--padded">
      <div className="sf-section__title">{title}</div>
      <div className="sf-section-grid">
        {items.map((it, idx) => {
          const author = typeof it.author === "string" ? it.author : "";
          const text = typeof it.text === "string" ? it.text : "";
          const rating = typeof it.rating === "number" ? it.rating : 5;
          return (
            <div key={idx} className="sf-section-card sf-section-card--inset">
              <div className="sf-section-row">
                <div className="sf-section-card__title">{author || "Клиент"}</div>
                <div className="sf-section-card__meta">★ {rating}</div>
              </div>
              <div className="sf-section-card__text">{text}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

