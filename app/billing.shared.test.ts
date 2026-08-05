import { describe, it, expect } from "vitest";
import {
  COMMUNITY_PROMO_CODE,
  COMMUNITY_PROMO_DISCOUNT,
  PLAN_PRICE,
  PLAN_NAME,
  normalizePromo,
  isValidPromo,
  discountedMonthlyPrice,
  formatUsd,
} from "./billing.shared";

describe("normalizePromo", () => {
  it("trims and uppercases", () => {
    expect(normalizePromo("  ecommsystem25 ")).toBe("ECOMMSYSTEM25");
    expect(normalizePromo("EcommSystem25")).toBe("ECOMMSYSTEM25");
  });

  it("handles null / undefined / empty / whitespace", () => {
    expect(normalizePromo(null)).toBe("");
    expect(normalizePromo(undefined)).toBe("");
    expect(normalizePromo("")).toBe("");
    expect(normalizePromo("   ")).toBe("");
  });
});

describe("isValidPromo", () => {
  it("accepts the exact code regardless of case / surrounding whitespace", () => {
    expect(isValidPromo("ECOMMSYSTEM25")).toBe(true);
    expect(isValidPromo("ecommsystem25")).toBe(true);
    expect(isValidPromo("  EcommSystem25  ")).toBe(true);
  });

  it("rejects empty / missing input", () => {
    expect(isValidPromo(null)).toBe(false);
    expect(isValidPromo(undefined)).toBe(false);
    expect(isValidPromo("")).toBe(false);
    expect(isValidPromo("   ")).toBe(false);
  });

  it("rejects near-misses (no partial or superset matches)", () => {
    expect(isValidPromo("ECOMMSYSTEM")).toBe(false);
    expect(isValidPromo("ECOMMSYSTEM25X")).toBe(false);
    expect(isValidPromo("XECOMMSYSTEM25")).toBe(false);
    expect(isValidPromo("ECOMMSYSTEM 25")).toBe(false);
    expect(isValidPromo("WRONG")).toBe(false);
  });
});

describe("discountedMonthlyPrice", () => {
  it("applies the 25% discount and rounds to cents", () => {
    // 9.99 * 0.75 = 7.4925 -> 7.49
    expect(discountedMonthlyPrice()).toBe(7.49);
  });

  it("stays consistent with the underlying constants and is cheaper than full price", () => {
    const expected =
      Math.round(PLAN_PRICE * (1 - COMMUNITY_PROMO_DISCOUNT) * 100) / 100;
    expect(discountedMonthlyPrice()).toBe(expected);
    expect(discountedMonthlyPrice()).toBeLessThan(PLAN_PRICE);
    expect(discountedMonthlyPrice()).toBeGreaterThan(0);
  });
});

describe("formatUsd", () => {
  it("always shows two decimals", () => {
    expect(formatUsd(9.99)).toBe("US$9.99");
    expect(formatUsd(7.49)).toBe("US$7.49");
    expect(formatUsd(7.4)).toBe("US$7.40");
    expect(formatUsd(7)).toBe("US$7.00");
  });
});

describe("plan / promo constants", () => {
  it("are the expected values", () => {
    expect(PLAN_NAME).toBe("ComboLoco Pro");
    expect(PLAN_PRICE).toBe(9.99);
    expect(COMMUNITY_PROMO_CODE).toBe("ECOMMSYSTEM25");
    expect(COMMUNITY_PROMO_DISCOUNT).toBe(0.25);
  });
});
