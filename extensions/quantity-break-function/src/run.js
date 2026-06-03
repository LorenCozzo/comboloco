// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  let bundleMap = {};
  const bundleMapValue = input?.discountNode?.bundleMap?.value;
  if (bundleMapValue) {
    try { bundleMap = JSON.parse(bundleMapValue); } catch {}
  }

  const discounts = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;

    const productId = line.merchandise.product?.id;

    // Prioridad: producto específico > ALL
    let tiers = null;
    if (productId && bundleMap[productId]) {
      tiers = bundleMap[productId];
    } else if (bundleMap["ALL"]) {
      tiers = bundleMap["ALL"];
    }

    // Fallback al metafield del producto (para compatibilidad)
    if (!tiers) {
      const productValue = line.merchandise.product?.metafield?.value;
      if (productValue) {
        try { tiers = JSON.parse(productValue); } catch {}
      }
    }

    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) continue;

    const match = tiers
      .filter((t) => line.quantity >= t.quantity)
      .sort((a, b) => b.quantity - a.quantity)[0];

    if (!match) continue;

    if (match.discountType === "PERCENTAGE") {
      if (match.discountValue <= 0) continue;
      discounts.push({
        targets: [{ productVariant: { id: line.merchandise.id } }],
        value: { percentage: { value: String(match.discountValue) } },
      });
    } else {
      // FIXED = precio total del tier — precio por unidad del tier × cantidad real
      const unitPrice = parseFloat(line.cost.amountPerQuantity.amount);
      const originalTotal = unitPrice * line.quantity;
      const tierUnitPrice = match.discountValue / match.quantity;
      const discountedTotal = tierUnitPrice * line.quantity;
      const discount = originalTotal - discountedTotal;
      if (discount <= 0) continue;
      discounts.push({
        targets: [{ productVariant: { id: line.merchandise.id } }],
        value: {
          fixedAmount: {
            amount: String(discount.toFixed(2)),
            appliesToEachItem: false,
          },
        },
      });
    }
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
