import { SITE } from "../config/site.js";

/** 620000 -> "₦620,000" */
export const naira = (n) =>
  SITE.currencySymbol + Number(n).toLocaleString("en-NG");

/** Percent saved between old and new price, e.g. 15 */
export const discountPct = (price, was) =>
  was ? Math.round((1 - price / was) * 100) : 0;

/** Stock badge logic shared by storefront and admin */
export const LOW_STOCK_AT = 10;
export const stockState = (stock) =>
  stock === 0 ? "out" : stock <= LOW_STOCK_AT ? "low" : "ok";

/**
 * Calendar day (YYYY-MM-DD) in Nigerian time. Bucket orders with this,
 * not toISOString(), which is UTC and files 00:00–01:00 WAT orders
 * under the previous day. Matches the Africa/Lagos days in the views.
 */
const LAGOS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" });
export const lagosDay = (date) => LAGOS_DAY.format(new Date(date));
