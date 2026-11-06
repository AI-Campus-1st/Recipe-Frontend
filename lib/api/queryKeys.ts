import type { ISODate, RecipeCategory } from "./contracts";

export const queryKeys = {
  recipes: (category?: RecipeCategory | null) => ["recipes", category ?? "all"] as const,
  recipesAll: ["recipes"] as const,
  recipe: (id: string) => ["recipes", "detail", id] as const,
  sideDishes: (recipeId: string) => ["recipes", "sideDishes", recipeId] as const,
  week: (weekStart: ISODate) => ["mealPlans", "week", weekStart] as const,
  month: (month: string) => ["mealPlans", "month", month] as const,
  mealPlansAll: ["mealPlans"] as const,
  meal: (entryId: string) => ["meal", entryId] as const,
  mealAll: ["meal"] as const,
  today: ["today"] as const,
  shopping: (weekStart: ISODate) => ["shopping", weekStart] as const,
  shoppingAll: ["shopping"] as const,
  substitutes: (weekStart: ISODate, itemId: string) => ["substitutes", weekStart, itemId] as const,
  /* RECIPE-001 */
  units: ["units"] as const,
};
