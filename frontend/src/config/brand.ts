const rawName = import.meta.env.VITE_APP_NAME;
export const APP_NAME =
  typeof rawName === "string" && rawName.trim() !== ""
    ? rawName.trim()
    : "Shop";

const rawPromo = import.meta.env.VITE_FIRST_ORDER_PROMO;
export const FIRST_ORDER_PROMO =
  typeof rawPromo === "string" && rawPromo.trim() !== ""
    ? rawPromo.trim()
    : "SHOP10";
