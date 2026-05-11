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

export function FaqSection(props: {
  config: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleFaq === "string" && String(props.textConfig.titleFaq).trim() !== ""
      ? String(props.textConfig.titleFaq)
      : "FAQ";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  const items = readItems(props.config);
  if (items.length === 0) return null;

  return (
    <section className="sf-section sf-section--faq sf-section--padded">
      <div className="sf-section__title">{title}</div>
      <div className="sf-section-grid">
        {items.map((it, idx) => {
          const q = typeof it.q === "string" ? it.q : "";
          const a = typeof it.a === "string" ? it.a : "";
          return (
            <div key={idx} className="sf-section-card sf-section-card--transparent sf-section-card--inset">
              <div className="sf-section-card__title">{q}</div>
              <div className="sf-section-card__text">{a}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

