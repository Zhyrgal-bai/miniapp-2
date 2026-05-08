function readString(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === "string" ? v : "";
}

export function FooterSection(props: {
  config: Record<string, unknown>;
}): React.ReactElement | null {
  const text = readString(props.config, "text");
  const phone = readString(props.config, "phone");
  const insta =
    readString(props.config, "instagramUrl");

  if (!text && !phone && !insta) return null;

  return (
    <footer style={{ padding: 16, opacity: 0.9 }}>
      <div
        style={{
          borderTop: "1px solid var(--sf-color-border)",
          paddingTop: 12,
          fontSize: 14,
          display: "grid",
          gap: 6,
        }}
      >
        {text ? <div>{text}</div> : null}
        {phone ? <div>Тел: {phone}</div> : null}
        {insta ? (
          <a href={insta} target="_blank" rel="noreferrer" style={{ color: "var(--sf-color-primary)" }}>
            Instagram
          </a>
        ) : null}
      </div>
    </footer>
  );
}

