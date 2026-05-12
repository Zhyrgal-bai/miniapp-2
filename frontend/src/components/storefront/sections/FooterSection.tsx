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
    <footer className="sf-footer">
      <div className="sf-footer__inner">
        {text ? <div>{text}</div> : null}
        {phone ? <div>Тел: {phone}</div> : null}
        {insta ? (
          <a href={insta} target="_blank" rel="noreferrer">
            Instagram
          </a>
        ) : null}
      </div>
    </footer>
  );
}

