function readTextValue(cfg: Record<string, unknown> | undefined, key: string): string {
  const v = cfg?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function resolvePills(textConfig: Record<string, unknown> | undefined): string[] {
  const explicit = textConfig?.brandTrustPills;
  if (Array.isArray(explicit)) {
    const fromArray = explicit
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x !== "");
    if (fromArray.length > 0) return fromArray.slice(0, 4);
  }
  const fallback = [
    readTextValue(textConfig, "brandTrust1"),
    readTextValue(textConfig, "brandTrust2"),
    readTextValue(textConfig, "brandTrust3"),
  ].filter((x) => x !== "");
  return fallback.slice(0, 4);
}

export function StorefrontIdentityBand(props: {
  storeName?: string;
  textConfig?: Record<string, unknown>;
  styleConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  const storeName = String(props.storeName ?? "").trim();
  const textConfig = props.textConfig;
  const styleConfig = props.styleConfig;
  const tagline =
    readTextValue(textConfig, "brandTagline") ||
    readTextValue(textConfig, "heroDefaultSubtitle");
  const personality =
    readTextValue(textConfig, "brandPersonality") ||
    (typeof styleConfig?.brand === "object" && styleConfig.brand != null
      ? readTextValue(styleConfig.brand as Record<string, unknown>, "personality")
      : "");
  const pills = resolvePills(textConfig);

  if (storeName === "" && tagline === "" && personality === "" && pills.length === 0) return null;

  return (
    <section className="sf-section sf-section--identity sf-section--padded">
      <div className="sf-identity-band">
        <div className="sf-identity-band__copy">
          {storeName !== "" ? <div className="sf-identity-band__name">{storeName}</div> : null}
          {tagline !== "" ? <div className="sf-identity-band__tagline">{tagline}</div> : null}
          {personality !== "" ? <div className="sf-identity-band__persona">{personality}</div> : null}
        </div>
        {pills.length > 0 ? (
          <div className="sf-identity-band__pills">
            {pills.map((pill, idx) => (
              <span key={`${pill}-${idx}`} className="sf-identity-pill">
                {pill}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
