const COUPANG_SEARCH_URL = "https://www.coupang.com/np/search";

/**
 * F-07: the single utility that builds a Coupang search URL for an ingredient.
 * Pass the current purchase target name (the substitute name when one is applied).
 */
export function buildCoupangSearchUrl(ingredientName: string): string {
  const query = ingredientName.trim().replace(/\s+/g, " ");
  return `${COUPANG_SEARCH_URL}?q=${encodeURIComponent(query)}`;
}
