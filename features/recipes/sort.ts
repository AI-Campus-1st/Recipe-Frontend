import type { Recipe } from "@/lib/api/contracts";

/** Sort options of the recipe picker (MEAL-001). */
export const RECIPE_SORTS = ["least_recent", "newest", "rating"] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

export const RECIPE_SORT_LABELS: Record<RecipeSort, string> = {
  least_recent: "최근 조리 안 한 순",
  newest: "최근 추가 순",
  rating: "별점 높은 순",
};

/** Latest `completedAt` of the recipe's cooking logs, or null when it was never cooked. */
export function lastCookedAt(recipe: Recipe): string | null {
  let latest: string | null = null;
  for (const log of recipe.cookingLogs) {
    if (latest === null || log.completedAt > latest) latest = log.completedAt;
  }
  return latest;
}

/** Average of the rated cooking logs, or null when no log has a rating. */
export function averageRating(recipe: Recipe): number | null {
  const ratings = recipe.cookingLogs.flatMap((log) => (log.rating === null ? [] : [log.rating]));
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

const byNewest = (a: Recipe, b: Recipe) => b.createdAt.localeCompare(a.createdAt);

function compareLeastRecent(a: Recipe, b: Recipe): number {
  const lastA = lastCookedAt(a);
  const lastB = lastCookedAt(b);
  // Never-cooked recipes first, then the oldest last cook.
  if (lastA === null || lastB === null) return lastA === lastB ? 0 : lastA === null ? -1 : 1;
  return lastA.localeCompare(lastB);
}

function compareRating(a: Recipe, b: Recipe): number {
  const ratingA = averageRating(a);
  const ratingB = averageRating(b);
  // Unrated recipes last.
  if (ratingA === null || ratingB === null) return ratingA === ratingB ? 0 : ratingA === null ? 1 : -1;
  return ratingB - ratingA;
}

const COMPARATORS: Record<RecipeSort, (a: Recipe, b: Recipe) => number> = {
  least_recent: compareLeastRecent,
  newest: byNewest,
  rating: compareRating,
};

/** Returns a sorted copy. Ties fall back to the newest recipe first. */
export function sortRecipes(recipes: Recipe[], sort: RecipeSort): Recipe[] {
  const compare = COMPARATORS[sort];
  return [...recipes].sort((a, b) => compare(a, b) || byNewest(a, b));
}
