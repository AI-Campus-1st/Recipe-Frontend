import type { Recipe } from "@/lib/api/contracts";

/** Case- and whitespace-insensitive key, so "김치 볶음밥" finds "김치볶음밥". */
function searchKey(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/g, "");
}

/** Filters recipes whose name contains the query. An empty query keeps every recipe. */
export function filterRecipesByName(recipes: Recipe[], query: string): Recipe[] {
  const key = searchKey(query);
  if (!key) return recipes;
  return recipes.filter((recipe) => recipe.title !== null && searchKey(recipe.title).includes(key));
}
