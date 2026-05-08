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
}): React.ReactElement | null {
  const title = readTitle(props.config, "Отзывы");
  const items = readItems(props.config);
  if (items.length === 0) return null;

  return (
    <section style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((it, idx) => {
          const author = typeof it.author === "string" ? it.author : "";
          const text = typeof it.text === "string" ? it.text : "";
          const rating = typeof it.rating === "number" ? it.rating : 5;
          return (
            <div
              key={idx}
              style={{
                borderRadius: 14,
                border: "1px solid var(--sf-color-border)",
                background: "var(--sf-color-card)",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{author || "Клиент"}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>★ {rating}</div>
              </div>
              <div style={{ marginTop: 6, opacity: 0.92 }}>{text}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

