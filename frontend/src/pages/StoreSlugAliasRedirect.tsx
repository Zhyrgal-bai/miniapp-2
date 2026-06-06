import type { ReactElement } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { canonicalStorePath } from "../utils/storeParams";

/**
 * Legacy alias: `/store/:slug` → canonical `/s/:slug` (query + hash preserved).
 */
export default function StoreSlugAliasRedirect(): ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const target =
    slug != null && slug.trim() !== ""
      ? `${canonicalStorePath(slug)}${location.search}${location.hash}`
      : `/${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
}
