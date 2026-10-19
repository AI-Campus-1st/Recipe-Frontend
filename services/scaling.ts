/**
 * F-05: needed quantity = recipe quantity × (planned servings ÷ recipe base servings).
 * Returns null when any input is unknown — values are never estimated.
 */
export function scaleQuantity(quantity: number | null, baseServings: number | null, servings: number): number | null {
  if (quantity === null || baseServings === null || baseServings <= 0) return null;
  return roundQuantity(quantity * (servings / baseServings));
}

export function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}
