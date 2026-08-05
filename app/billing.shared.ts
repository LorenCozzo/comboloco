// Shared, dependency-free billing/promo constants and helpers.
//
// Kept free of any server-only imports so it can be imported from the server
// (shopify.server.ts), the isomorphic route module (routes/app.tsx) and unit
// tests alike. This is the single source of truth for the plan definition and
// the community promo code, so the paywall price display can never drift from
// the amount that is actually charged.

/** Billing plan identifier. MUST stay in sync with the key in shopify.server.ts
 *  billing config — Shopify matches active subscriptions by this exact name. */
export const PLAN_NAME = "ComboLoco Pro";
export const PLAN_PRICE = 9.99;
export const PLAN_CURRENCY = "USD";
export const TRIAL_DAYS = 7;

/** Community discount code shared with the ecommsystem community. */
export const COMMUNITY_PROMO_CODE = "ECOMMSYSTEM25";
/** 0.25 === 25% off the recurring price, for the life of the subscription. */
export const COMMUNITY_PROMO_DISCOUNT = 0.25;

/** Normalise raw user/URL input into a comparable promo code. */
export function normalizePromo(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/** True only for the exact community code (case-insensitive, trimmed). */
export function isValidPromo(raw: string | null | undefined): boolean {
  return normalizePromo(raw) === COMMUNITY_PROMO_CODE;
}

/** Recurring monthly price a buyer pays once the community promo is applied. */
export function discountedMonthlyPrice(): number {
  return Math.round(PLAN_PRICE * (1 - COMMUNITY_PROMO_DISCOUNT) * 100) / 100;
}

/** e.g. formatUsd(7.49) === "US$7.49" */
export function formatUsd(amount: number): string {
  return `US$${amount.toFixed(2)}`;
}
