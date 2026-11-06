import { apiRequest } from "./client";
import type {
  ApplySubstituteRequest,
  CompleteMealResponse,
  CookingLogSummary,
  CookingReviewRequest,
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  ImportRecipeRequest,
  ISODate,
  MealDetail,
  MealPlanEntry,
  MonthSummary,
  Recipe,
  RecipeCategory,
  RecipeSummary,
  SetDayMealRequest,
  ShoppingList,
  SideDishRecommendationRequest,
  SideDishRecommendationResponse,
  SubstituteOptions,
  TodayMealResponse,
  WeeklyMealPlan,
} from "./contracts";

/** All FastAPI endpoints used by the app. UI code goes through feature hooks, not this file directly. */

const enc = encodeURIComponent;

export const recipesApi = {
  list: (category?: RecipeCategory | null) =>
    apiRequest<Recipe[]>(`/recipes${category ? `?category=${enc(category)}` : ""}`),
  detail: (id: string) => apiRequest<Recipe>(`/recipes/${enc(id)}`),
  import: (body: ImportRecipeRequest) => apiRequest<Recipe>("/recipes/import", { method: "POST", body }),
  retry: (id: string) => apiRequest<Recipe>(`/recipes/${enc(id)}/retry`, { method: "POST" }),
  requestRevision: (id: string, comment?: string) =>
    apiRequest<Recipe>(`/recipes/${enc(id)}/revision-requests`, { method: "POST", body: { comment } }),
  confirm: (id: string) => apiRequest<Recipe>(`/recipes/${enc(id)}/confirm`, { method: "POST" }),
  remove: (id: string) => apiRequest<void>(`/recipes/${enc(id)}`, { method: "DELETE" }),
};

export const sideDishesApi = {
  list: (recipeId: string) => apiRequest<RecipeSummary[]>(`/recipes/${enc(recipeId)}/side-dishes`),
  link: (recipeId: string, sideRecipeId: string) =>
    apiRequest<RecipeSummary[]>(`/recipes/${enc(recipeId)}/side-dishes/${enc(sideRecipeId)}`, { method: "PUT" }),
  unlink: (recipeId: string, sideRecipeId: string) =>
    apiRequest<void>(`/recipes/${enc(recipeId)}/side-dishes/${enc(sideRecipeId)}`, { method: "DELETE" }),
  recommend: (recipeId: string, body: SideDishRecommendationRequest = {}) =>
    apiRequest<SideDishRecommendationResponse>(`/recipes/${enc(recipeId)}/side-dishes/recommendations`, {
      method: "POST",
      body,
    }),
};

export const mealPlansApi = {
  week: (weekStart: ISODate) => apiRequest<WeeklyMealPlan>(`/meal-plans/weeks/${enc(weekStart)}`),
  month: (month: string) => apiRequest<MonthSummary>(`/meal-plans/months/${enc(month)}`),
  generate: (body: GenerateMealPlanRequest) =>
    apiRequest<GenerateMealPlanResponse>("/meal-plans/generate", { method: "POST", body }),
  regenerate: (entryId: string, comment?: string) =>
    apiRequest<MealPlanEntry>(`/meal-plans/entries/${enc(entryId)}/regenerate`, { method: "POST", body: { comment } }),
  detail: (entryId: string) => apiRequest<MealDetail>(`/meal-plans/entries/${enc(entryId)}`),
  complete: (entryId: string) =>
    apiRequest<CompleteMealResponse>(`/meal-plans/entries/${enc(entryId)}/complete`, { method: "POST" }),
  today: () => apiRequest<TodayMealResponse>("/meals/today"),
  review: (logId: string, body: CookingReviewRequest) =>
    apiRequest<CookingLogSummary>(`/cooking-logs/${enc(logId)}/review`, { method: "PUT", body }),
  /* MEAL-001: manual day meal and completion undo */
  setDay: (date: ISODate, body: SetDayMealRequest) =>
    apiRequest<MealPlanEntry>(`/meal-plans/days/${enc(date)}`, { method: "PUT", body }),
  clearDay: (date: ISODate) => apiRequest<void>(`/meal-plans/days/${enc(date)}`, { method: "DELETE" }),
  uncomplete: (entryId: string) =>
    apiRequest<MealPlanEntry>(`/meal-plans/entries/${enc(entryId)}/complete`, { method: "DELETE" }),
};

export const shoppingApi = {
  list: (weekStart: ISODate) => apiRequest<ShoppingList>(`/shopping-lists/${enc(weekStart)}`),
  setChecked: (weekStart: ISODate, itemId: string, checked: boolean) =>
    apiRequest<ShoppingList>(`/shopping-lists/${enc(weekStart)}/items/${enc(itemId)}`, {
      method: "PATCH",
      body: { checked },
    }),
  substitutes: (weekStart: ISODate, itemId: string) =>
    apiRequest<SubstituteOptions>(`/shopping-lists/${enc(weekStart)}/items/${enc(itemId)}/substitutes`),
  applySubstitute: (weekStart: ISODate, itemId: string, body: ApplySubstituteRequest) =>
    apiRequest<ShoppingList>(`/shopping-lists/${enc(weekStart)}/items/${enc(itemId)}/substitutes/apply`, {
      method: "POST",
      body,
    }),
};
