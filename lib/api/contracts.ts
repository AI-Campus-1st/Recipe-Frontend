/**
 * TypeScript API contracts for the FastAPI backend.
 *
 * The backend is not implemented yet; these types are the agreed draft that the
 * MSW mocks implement. JSON fields are camelCase (FastAPI/Pydantic `alias_generator=to_camel`).
 * Dates are local calendar dates `YYYY-MM-DD`; timestamps are ISO 8601 strings.
 * `null` quantities, servings or minutes mean "미확인" — never an estimated value.
 */

export type ISODate = string;
export type ISODateTime = string;

/* ---------- Errors ---------- */

export type ApiErrorCode =
  | "validation_error"
  | "duplicate_recipe"
  | "not_found"
  | "conflict"
  | "no_candidates"
  | "unauthorized"
  | "server_error";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  /** Field-level validation messages, keyed by field name. */
  fieldErrors?: Record<string, string>;
  /** Extra payload, e.g. the existing recipe for `duplicate_recipe`. */
  details?: unknown;
}

/* ---------- Recipes (F-01, F-11) ---------- */

export type RecipeStatus = "importing" | "needs_review" | "saved" | "failed";

export const RECIPE_CATEGORIES = ["main", "simple", "soup", "side", "sauce"] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export interface RecipeIngredient {
  id: string;
  /** Ingredient master ID. The analyzer links every extracted name to the shared ingredient table. */
  ingredientId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface CookingLogSummary {
  id: string;
  mealDate: ISODate;
  completedAt: ISODateTime;
  rating: number | null;
  memo: string | null;
}

export interface Recipe {
  id: string;
  sourceUrl: string;
  title: string | null;
  imageUrl: string | null;
  status: RecipeStatus;
  category: RecipeCategory | null;
  baseServings: number | null;
  cookMinutes: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Fields the extractor could not confirm. */
  uncertainFields: string[];
  failureReason: string | null;
  cookingLogs: CookingLogSummary[];
  createdAt: ISODateTime;
}

export interface RecipeSummary {
  id: string;
  title: string | null;
  imageUrl: string | null;
  cookMinutes: number | null;
}

/**
 * The same source (YouTube video ID, 만개의레시피 recipe ID or normalized URL) is never saved twice:
 * a duplicate returns 409 `duplicate_recipe`; a soft-deleted one is restored (200 instead of 202).
 */
export interface ImportRecipeRequest {
  url: string;
  title?: string;
}

export interface DuplicateRecipeDetails {
  existingRecipe: RecipeSummary;
}

export interface RevisionRequest {
  comment?: string;
}

/* ---------- Side dishes (F-04) ---------- */

export interface SideDishCandidate {
  recipe: RecipeSummary;
  reason: string;
  alreadyLinked: boolean;
}

export interface SideDishRecommendationRequest {
  limit?: number;
}

export interface SideDishRecommendationResponse {
  recipeId: string;
  candidates: SideDishCandidate[];
}

/* ---------- Meal plans (F-02, F-03, F-08, F-10) ---------- */

export interface MealPlanEntry {
  id: string;
  date: ISODate;
  mainRecipe: RecipeSummary;
  sideRecipes: RecipeSummary[];
  servings: number;
  cookMinutesLimit: number;
  completedAt: ISODateTime | null;
  /** Current completion log of the main recipe. */
  cookingLogId: string | null;
}

export type GenerationStatus = "none" | "generating" | "partial" | "complete" | "failed";

export interface WeeklyMealPlan {
  weekStart: ISODate;
  weekEnd: ISODate;
  entries: MealPlanEntry[];
  generation: {
    status: GenerationStatus;
    failedDates: ISODate[];
  };
}

export interface GenerateDayRequest {
  date: ISODate;
  servings: number;
  cookMinutes: number;
}

export interface GenerateMealPlanRequest {
  days: GenerateDayRequest[];
  /** Optional user request applied to every generated day (e.g. "국물 요리 위주로"). */
  comment?: string;
}

export interface GenerateDayResult {
  date: ISODate;
  status: "success" | "failed";
  reason: string | null;
}

export interface GenerateMealPlanResponse {
  results: GenerateDayResult[];
  plan: WeeklyMealPlan;
}

export interface RegenerateMealRequest {
  comment?: string;
}

export interface MonthWeekSummary {
  weekStart: ISODate;
  weekEnd: ISODate;
  hasMeals: boolean;
}

export interface MonthSummary {
  month: string; // YYYY-MM
  weeks: MonthWeekSummary[];
}

/* ---------- Cooking view ---------- */

export interface ScaledIngredient {
  id: string;
  name: string;
  /** Quantity scaled to the planned servings; null when it cannot be determined. */
  quantity: number | null;
  unit: string | null;
  /** Set when a substitute replaced the original ingredient for this meal. */
  substitutedFrom: string | null;
}

export interface CookingRecipeView {
  recipe: RecipeSummary;
  baseServings: number | null;
  steps: string[];
  ingredients: ScaledIngredient[];
  /** Cooking guidance for applied substitutes, kept apart from the original steps. */
  substituteNotes: string[];
  previousLogs: CookingLogSummary[];
  sourceUrl: string;
  /** This meal's completion log for this recipe (main or side); reviews are saved per recipe. */
  cookingLogId: string | null;
}

export interface MealDetail {
  entry: MealPlanEntry;
  main: CookingRecipeView;
  sides: CookingRecipeView[];
}

export interface TodayMealResponse {
  date: ISODate;
  meal: MealDetail | null;
  hasSavedRecipes: boolean;
}

export interface MealCookingLogRef {
  recipeId: string;
  cookingLogId: string;
}

export interface CompleteMealResponse {
  entry: MealPlanEntry;
  /** One log per recipe of the meal: main first, then sides. */
  cookingLogs: MealCookingLogRef[];
}

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export interface CookingReviewRequest {
  /** Required integer 1–5. */
  rating: number;
  memo?: string | null;
}

/* ---------- Shopping list (F-05, F-06, F-07) ---------- */

export interface ShoppingAmount {
  quantity: number | null;
  unit: string | null;
}

export interface ShoppingItemSource {
  entryId: string;
  date: ISODate;
  recipeId: string;
  recipeTitle: string | null;
  originalName: string;
  quantity: number | null;
  unit: string | null;
}

export interface AppliedSubstitute {
  entryId: string;
  date: ISODate;
  recipeId: string;
  recipeTitle: string | null;
  originalName: string;
}

export interface ShoppingItem {
  /** Stable key: ingredient master ID (`ingredientId`). Preserved across recalculation. */
  id: string;
  /** Current purchase target name (substitute name when one is applied). */
  name: string;
  /** Amounts in compatible units are merged; incompatible units are listed separately. */
  amounts: ShoppingAmount[];
  checked: boolean;
  /** Recipe-level usage sources (kept for data integrity; not listed on the screen). */
  sources: ShoppingItemSource[];
  /** Present when this item exists because a substitute was applied. */
  substituteFor: AppliedSubstitute[];
  hasSubstituteCandidates: boolean;
}

export interface ShoppingList {
  weekStart: ISODate;
  weekEnd: ISODate;
  hasConfirmedMeals: boolean;
  items: ShoppingItem[];
  /** Items not yet prepared (not checked). */
  neededCount: number;
}

export interface SubstituteCandidate {
  id: string;
  name: string;
  /** e.g. "버터 1 : 식용유 0.8" */
  ratio: string | null;
  quantity: number | null;
  unit: string | null;
  tasteDifference: string;
  cookingChange: string | null;
  caution: string | null;
  /** True when quantity/ratio cannot be confirmed and the user must confirm before applying. */
  uncertain: boolean;
}

export interface SubstituteTarget {
  entryId: string;
  date: ISODate;
  recipeId: string;
  recipeTitle: string | null;
  originalName: string;
  candidates: SubstituteCandidate[];
}

export interface SubstituteOptions {
  itemId: string;
  itemName: string;
  targets: SubstituteTarget[];
}

export interface ApplySubstituteRequest {
  entryId: string;
  recipeId: string;
  candidateId: string;
  /** Required when the candidate is uncertain. */
  confirmedUncertain?: boolean;
}
