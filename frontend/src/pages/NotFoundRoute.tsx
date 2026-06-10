import { useEffect } from "react";
import ArchaErrorShell from "../components/errors/ArchaErrorShell";
import { ARCHA_BRAND } from "../config/brandAssets";
import "../design/archaPremium.css";

/** Generic 404 for unmatched routes (not /s/:slug storefront). */
export default function NotFoundRoute(): React.ReactElement {
  useEffect(() => {
    document.title = `404 — ${ARCHA_BRAND.name}`;
  }, []);

  return <ArchaErrorShell kind="not_found" />;
}
