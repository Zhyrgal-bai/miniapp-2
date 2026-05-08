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
    <section className="sf-section sf-section--faq" style={{ padding: "var(--sf-section-pad)" }}>
      <div className="sf-section__title">{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it, idx) => {
          const q = typeof it.q === "string" ? it.q : "";
          const a = typeof it.a === "string" ? it.a : "";
          return (
            <div
              key={idx}
              style={{
                borderRadius: 14,
                border: "1px solid var(--sf-color-border)",
                background: "transparent",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 800 }}>{q}</div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>{a}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

