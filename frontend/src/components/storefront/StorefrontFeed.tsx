import type { ReactNode } from "react";

/** Unified vertical feed wrapper for storefront sections (rhythm + scroll context). */
export function StorefrontFeed(props: { children: ReactNode }): React.ReactElement {
  return (
    <div className="sf-storefront-feed sf-feed" data-sf-feed>
      {props.children}
    </div>
  );
}
