export type PxScreenClassOptions = {
  pageLayout?: boolean;
  layoutId: string;
  pdpClass?: string;
};

/** Shared px-screen layout classes for vertical PDP shells. */
export function pxScreenClasses({
  pageLayout = false,
  layoutId,
  pdpClass,
}: PxScreenClassOptions): string {
  return [
    "px-screen",
    "px-screen--telegram",
    pageLayout ? "px-screen--product-page" : "px-screen--quick-view",
    `px-screen--layout-${layoutId}`,
    pdpClass,
  ]
    .filter(Boolean)
    .join(" ");
}
