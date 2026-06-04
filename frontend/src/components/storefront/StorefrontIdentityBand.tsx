function readTextValue(cfg: Record<string, unknown> | undefined, key: string): string {
  const v = cfg?.[key];
  return typeof v === "string" ? v.trim() : "";
}

export function resolveIdentityTrustPills(
  textConfig: Record<string, unknown> | undefined,
): string[] {
  return resolvePills(textConfig);
}

export function hasIdentityBandExtras(
  textConfig: Record<string, unknown> | undefined,
  styleConfig: Record<string, unknown> | undefined,
): boolean {
  const personality =
    readTextValue(textConfig, "brandPersonality") ||
    (typeof styleConfig?.brand === "object" && styleConfig.brand != null
      ? readTextValue(styleConfig.brand as Record<string, unknown>, "personality")
      : "");
  return personality !== "" || resolvePills(textConfig).length > 0;
}

/** Skip redundant identity card when premium header already shows name + tagline. */
export function shouldRenderIdentityBand(
  storeName: string,
  textConfig: Record<string, unknown> | undefined,
  styleConfig: Record<string, unknown> | undefined,
  options?: { headerBrandActive?: boolean },
): boolean {
  const extras = hasIdentityBandExtras(textConfig, styleConfig);
  if (options?.headerBrandActive && !extras) return false;
  if (storeName !== "" || extras) return true;
  const keys = ["brandTagline", "brandPersonality", "brandTrust1", "brandTrust2", "brandTrust3", "heroDefaultSubtitle"];
  return keys.some((k) => readTextValue(textConfig, k) !== "");
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

function formatStoreAddress(addr: {
  addressLine: string;
  city: string;
}): string {
  const city = addr.city.trim();
  const line = addr.addressLine.trim();
  if (city !== "" && line !== "") return `${city}, ${line}`;
  return city || line;
}

export function StorefrontIdentityBand(props: {
  storeName?: string;
  storeAddress?: {
    addressLine: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  textConfig?: Record<string, unknown>;
  styleConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  const storeName = String(props.storeName ?? "").trim();
  const addressText =
    props.storeAddress != null ? formatStoreAddress(props.storeAddress) : "";
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

  if (
    storeName === "" &&
    addressText === "" &&
    tagline === "" &&
    personality === "" &&
    pills.length === 0
  ) {
    return null;
  }

  return (
    <section className="sf-section sf-section--identity sf-section--padded">
      <div className="sf-identity-band">
        <div className="sf-identity-band__copy">
          {storeName !== "" ? <div className="sf-identity-band__name">{storeName}</div> : null}
          {addressText !== "" ? (
            <div className="sf-identity-band__tagline">{addressText}</div>
          ) : null}
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
