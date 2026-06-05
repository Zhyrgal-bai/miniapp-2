import type { ReactElement, ReactNode } from "react";

type Props = {
  icon: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function MerchantStoreSettingsSection(props: Props): ReactElement {
  const extra = props.className?.trim() ?? "";
  return (
    <section
      className={[
        "mp-settings-section",
        "archa-glass",
        "archa-glass--glow",
        "mp-settings-section--premium",
        extra,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mp-settings-section__head">
        <span className="mp-settings-section__title">
          <span className="mp-settings-section__icon" aria-hidden>
            {props.icon}
          </span>
          {props.title}
        </span>
        {props.badge ?? null}
      </div>
      {props.description ? (
        <p className="mp-settings-section__desc">{props.description}</p>
      ) : null}
      {props.children}
    </section>
  );
}
