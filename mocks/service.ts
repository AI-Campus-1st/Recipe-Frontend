import type {
  ApiErrorBody,
  ApplySubstituteRequest,
  CompleteMealResponse,
  CookingLogSummary,
  CookingRecipeView,
  GenerateDayResult,
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  ImportRecipeRequest,
  MealDetail,
  MealPlanEntry,
  MonthSummary,
  Recipe,
  RecipeSummary,
  ScaledIngredient,
  ShoppingItem,
  ShoppingList,
  SideDishRecommendationResponse,
  SubstituteCandidate,
  SubstituteOptions,
  TodayMealResponse,
  WeeklyMealPlan,
} from "@/lib/api/contracts";
import { RATING_MAX, RATING_MIN } from "@/lib/api/contracts";
import { addDays, monthOf, startOfWeek, todayISO, weeksOfMonth } from "@/lib/date";
import { scaleQuantity } from "@/services/scaling";
import { aggregateShoppingItems, carryOverChecked, normalizeIngredientName, type ShoppingSourceInput } from "@/services/shopping";
import { ensureIngredient, getDb, linkIngredients, nextId, persist, type DbEntry, type DbRecipe } from "./db";
import { EXTRACTION_TEMPLATES, REVISED_INGREDIENTS, SUBSTITUTE_RULES, SUPPORTED_HOSTS } from "./fixtures";

export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

const IMPORT_DURATION_MS = process.env.NODE_ENV === "test" ? 0 : 2500;

/* ---------- Mapping ---------- */

function summary(recipe: DbRecipe | undefined, fallbackId: string): RecipeSummary {
  if (!recipe) return { id: fallbackId, title: "삭제된 레시피", imageUrl: null, cookMinutes: null };
  return { id: recipe.id, title: recipe.title, imageUrl: recipe.imageUrl, cookMinutes: recipe.cookMinutes };
}

/** Includes soft-deleted recipes so past meals and logs keep their references. */
function findRecipe(id: string): DbRecipe | undefined {
  return getDb().recipes.find((r) => r.id === id);
}

function isActive(recipe: DbRecipe | undefined): recipe is DbRecipe {
  return !!recipe && !recipe.isDelete;
}

function isSavedActive(recipe: DbRecipe | undefined): recipe is DbRecipe {
  return isActive(recipe) && recipe.status === "saved";
}

function logsForRecipe(recipeId: string): CookingLogSummary[] {
  return getDb()
    .logs.filter((log) => log.recipeId === recipeId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .map(({ id, mealDate, completedAt, rating, memo }) => ({ id, mealDate, completedAt, rating, memo }));
}

function toRecipe(recipe: DbRecipe): Recipe {
  return {
    id: recipe.id,
    sourceUrl: recipe.sourceUrl,
    title: recipe.title,
    imageUrl: recipe.imageUrl,
    status: recipe.status,
    category: recipe.category,
    baseServings: recipe.baseServings,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    uncertainFields: recipe.uncertainFields,
    failureReason: recipe.failureReason,
    cookingLogs: logsForRecipe(recipe.id),
    createdAt: recipe.createdAt,
  };
}

function toEntry(entry: DbEntry): MealPlanEntry {
  return {
    id: entry.id,
    date: entry.date,
    mainRecipe: summary(findRecipe(entry.mainRecipeId), entry.mainRecipeId),
    sideRecipes: entry.sideRecipeIds.map((id) => summary(findRecipe(id), id)),
    servings: entry.servings,
    cookMinutesLimit: entry.cookMinutesLimit,
    completedAt: entry.completedAt,
    cookingLogId: entry.cookingLogId,
  };
}

function notFound(what: string): MockHttpError {
  return new MockHttpError(404, { code: "not_found", message: `${what}을(를) 찾을 수 없습니다.` });
}

/* ---------- Recipes (F-01) ---------- */

/** Advance simulated import jobs whose time has come. */
function advanceJobs(now = Date.now()): void {
  const db = getDb();
  let changed = false;
  for (const recipe of db.recipes) {
    if (recipe.status !== "importing" || !recipe.job || recipe.job.readyAt > now) continue;
    if (recipe.job.outcome === "failed") {
      recipe.status = "failed";
      recipe.failureReason = "페이지 본문을 가져오지 못했습니다. 재시도하거나 수정 요청을 남겨 주세요.";
    } else {
      const seed = Number(recipe.id.replace(/\D/g, "")) || 0;
      const template = EXTRACTION_TEMPLATES[(seed + recipe.attempts - 1) % EXTRACTION_TEMPLATES.length];
      const keepTitle = recipe.title;
      if (!recipe.job.revised || recipe.ingredients.length === 0) {
        recipe.title = keepTitle ?? template.title;
        recipe.category = template.category;
        recipe.baseServings = template.baseServings;
        recipe.cookMinutes = template.cookMinutes;
        recipe.steps = template.steps;
        recipe.ingredients = linkIngredients(db, recipe.id, template.ingredients);
        recipe.uncertainFields = template.uncertainFields;
      }
      if (recipe.job.revised) {
        if (recipe.ingredients.length === 0) {
          recipe.ingredients = linkIngredients(db, recipe.id, REVISED_INGREDIENTS, "r");
        }
        recipe.uncertainFields = recipe.uncertainFields.filter((field) => field !== "ingredients");
      }
      recipe.status = "needs_review";
      recipe.failureReason = null;
    }
    recipe.job = null;
    changed = true;
  }
  if (changed) persist();
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function plannedOutcome(url: string, attempts: number): "needs_review" | "failed" {
  const host = hostOf(url);
  if (!host || !SUPPORTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return "failed";
  if (url.includes("always-fail")) return "failed";
  if (url.includes("fail") && attempts <= 1) return "failed";
  return "needs_review";
}

const MANGAE_RECIPE_URL = /^https?:\/\/(?:www\.|m\.)?10000recipe\.com\/recipe\/(\d+)\/?(?:[?#].*)?$/;
const TRACKING_PARAM = /^(utm_.+|fbclid|gclid|si)$/;

/**
 * Duplicate key of a recipe source: YouTube video ID, 만개의레시피 recipe ID, or a normalized URL.
 * Returns null for YouTube/만개의레시피 URLs that carry no ID (not a recipe page).
 */
export function sourceKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www\.|m\.)/, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/")[1];
    return id ? `youtube:${id}` : null;
  }
  if (host === "youtube.com") {
    const id = parsed.pathname === "/watch" ? parsed.searchParams.get("v") : parsed.pathname.match(/^\/shorts\/([^/]+)/)?.[1];
    return id ? `youtube:${id}` : null;
  }
  if (host === "10000recipe.com") {
    const match = url.match(MANGAE_RECIPE_URL);
    return match ? `10000recipe:${match[1]}` : null;
  }
  for (const key of [...parsed.searchParams.keys()]) if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
  return `web:${host}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
}

export function listRecipes(category: string | null): Recipe[] {
  advanceJobs();
  return getDb()
    .recipes.filter((recipe) => !recipe.isDelete && (!category || recipe.category === category))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toRecipe);
}

/** `restored` = a soft-deleted recipe of the same source came back (HTTP 200 instead of 202). */
export function importRecipe({ url, title }: ImportRecipeRequest): { recipe: Recipe; restored: boolean } {
  const trimmed = url?.trim() ?? "";
  let parsed: URL | null = null;
  try {
    parsed = new URL(trimmed);
  } catch {
    parsed = null;
  }
  if (!parsed || !["http:", "https:"].includes(parsed.protocol)) {
    throw new MockHttpError(422, {
      code: "validation_error",
      message: "올바른 URL을 입력해 주세요.",
      fieldErrors: { url: "http 또는 https로 시작하는 URL을 입력해 주세요." },
    });
  }
  const key = sourceKey(trimmed);
  if (!key) {
    throw new MockHttpError(422, {
      code: "validation_error",
      message: "레시피 페이지 주소를 입력해 주세요.",
      fieldErrors: { url: "유튜브 영상 또는 만개의레시피 레시피 페이지 주소를 입력해 주세요." },
    });
  }
  const db = getDb();
  const sameSource = db.recipes.filter((r) => sourceKey(r.sourceUrl) === key);
  const active = sameSource.find((r) => !r.isDelete);
  const deleted = sameSource.filter((r) => r.isDelete);
  // Soft-deleted recipes of the same source are restored as they were, without a new import job.
  for (const r of deleted) r.isDelete = false;
  if (deleted.length > 0) persist();
  if (active) {
    throw new MockHttpError(409, {
      code: "duplicate_recipe",
      message: "이미 저장된 레시피입니다.",
      details: { existingRecipe: summary(active, active.id) },
    });
  }
  if (deleted.length > 0) return { recipe: toRecipe(deleted[0]), restored: true };
  const recipe: DbRecipe = {
    id: nextId("r"),
    sourceUrl: trimmed,
    title: title?.trim() || null,
    imageUrl: null,
    status: "importing",
    category: null,
    baseServings: null,
    cookMinutes: null,
    ingredients: [],
    steps: [],
    uncertainFields: [],
    failureReason: null,
    createdAt: new Date().toISOString(),
    sideDishIds: [],
    isDelete: false,
    job: { readyAt: Date.now() + IMPORT_DURATION_MS, outcome: plannedOutcome(trimmed, 1), revised: false },
    attempts: 1,
  };
  db.recipes.push(recipe);
  persist();
  return { recipe: toRecipe(recipe), restored: false };
}

function requireRecipe(id: string): DbRecipe {
  advanceJobs();
  const recipe = findRecipe(id);
  if (!isActive(recipe)) throw notFound("레시피");
  return recipe;
}

export function getRecipe(id: string): Recipe {
  return toRecipe(requireRecipe(id));
}

export function retryRecipe(id: string): Recipe {
  const recipe = requireRecipe(id);
  if (recipe.status !== "failed") {
    throw new MockHttpError(409, { code: "conflict", message: "수집 실패 상태에서만 재시도할 수 있습니다." });
  }
  recipe.attempts += 1;
  recipe.status = "importing";
  recipe.job = { readyAt: Date.now() + IMPORT_DURATION_MS, outcome: plannedOutcome(recipe.sourceUrl, recipe.attempts), revised: false };
  persist();
  return toRecipe(recipe);
}

export function requestRevision(id: string, comment: string | undefined): Recipe {
  const recipe = requireRecipe(id);
  if (recipe.status !== "needs_review" && recipe.status !== "failed") {
    throw new MockHttpError(409, { code: "conflict", message: "확인 필요 또는 수집 실패 상태에서만 수정을 요청할 수 있습니다." });
  }
  // `확인 필요` revisions never re-read the source, so an empty comment leaves nothing to change.
  // `수집 실패` re-analyzes the source and accepts an empty comment (logics/RECIPE_ANALYSIS.md §9).
  if (recipe.status === "needs_review" && !comment?.trim()) {
    throw new MockHttpError(422, {
      code: "validation_error",
      message: "수정할 내용을 입력해 주세요.",
      fieldErrors: { comment: "수정할 내용을 입력해 주세요." },
    });
  }
  recipe.attempts += 1;
  recipe.status = "importing";
  recipe.job = { readyAt: Date.now() + IMPORT_DURATION_MS, outcome: "needs_review", revised: true };
  persist();
  return toRecipe(recipe);
}

export function confirmRecipe(id: string): Recipe {
  const recipe = requireRecipe(id);
  if (recipe.status !== "needs_review") {
    throw new MockHttpError(409, { code: "conflict", message: "확인 필요 상태의 레시피만 확인 처리할 수 있습니다." });
  }
  const fieldErrors: Record<string, string> = {};
  if (recipe.ingredients.length === 0) fieldErrors.ingredients = "재료가 입력되어 있어야 합니다.";
  if (!recipe.title) fieldErrors.title = "레시피명이 필요합니다.";
  if (Object.keys(fieldErrors).length > 0) {
    throw new MockHttpError(422, { code: "validation_error", message: "필수 항목이 누락되었습니다.", fieldErrors });
  }
  recipe.status = "saved";
  recipe.uncertainFields = [];
  persist();
  return toRecipe(recipe);
}

export function deleteRecipe(id: string): void {
  const recipe = requireRecipe(id);
  const db = getDb();
  const today = todayISO();
  const inUse = db.entries.some(
    (entry) => entry.date >= today && (entry.mainRecipeId === recipe.id || entry.sideRecipeIds.includes(recipe.id)),
  );
  if (inUse) {
    throw new MockHttpError(409, { code: "conflict", message: "예정된 식단에 사용 중인 레시피는 삭제할 수 없습니다." });
  }
  // Soft delete: past meals, logs and substitutions keep pointing at the recipe.
  recipe.isDelete = true;
  recipe.sideDishIds = [];
  for (const other of db.recipes) other.sideDishIds = other.sideDishIds.filter((sid) => sid !== recipe.id);
  persist();
}

/* ---------- Side dishes (F-04) ---------- */

export function listSideDishes(recipeId: string): RecipeSummary[] {
  const recipe = requireRecipe(recipeId);
  return recipe.sideDishIds
    .map(findRecipe)
    .filter(isActive)
    .map((side) => summary(side, side.id));
}

/** Idempotent. Only changes this pair; existing meal plans keep their sides until the next generation. */
export function linkSideDish(recipeId: string, sideRecipeId: string): RecipeSummary[] {
  const recipe = requireRecipe(recipeId);
  const side = findRecipe(sideRecipeId);
  if (!isActive(side)) throw notFound("곁들임 레시피");
  if (side.id === recipe.id || side.status !== "saved") {
    throw new MockHttpError(422, {
      code: "validation_error",
      message: side.id === recipe.id ? "자기 자신은 곁들임으로 연결할 수 없습니다." : "저장된 레시피만 곁들임으로 연결할 수 있습니다.",
    });
  }
  if (!recipe.sideDishIds.includes(side.id)) {
    recipe.sideDishIds.push(side.id);
    persist();
  }
  return listSideDishes(recipeId);
}

/** Idempotent: unlinking a pair that is not linked still succeeds. */
export function unlinkSideDish(recipeId: string, sideRecipeId: string): void {
  const recipe = requireRecipe(recipeId);
  recipe.sideDishIds = recipe.sideDishIds.filter((id) => id !== sideRecipeId);
  persist();
}

/** Mock "AI": saved side/soup recipes, the ones the user linked before first. Nothing is stored. */
export function recommendSideDishes(recipeId: string, limit = 3): SideDishRecommendationResponse {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new MockHttpError(422, {
      code: "validation_error",
      message: "추천 개수는 1~5 사이여야 합니다.",
      fieldErrors: { limit: "1~5 사이로 입력해 주세요." },
    });
  }
  const recipe = requireRecipe(recipeId);
  const linked = (id: string) => recipe.sideDishIds.includes(id);
  const candidates = getDb()
    .recipes.filter((r) => r.id !== recipe.id && isSavedActive(r) && (r.category === "side" || r.category === "soup" || r.category === "sauce"))
    .sort((a, b) => Number(linked(b.id)) - Number(linked(a.id)))
    .slice(0, limit)
    .map((side) => ({
      recipe: summary(side, side.id),
      reason: linked(side.id)
        ? "이전에 연결한 곁들임이에요."
        : side.category === "soup"
          ? "주 요리와 함께 먹기 좋은 국물 요리예요."
          : side.category === "sauce"
            ? "주 요리에 곁들이기 좋은 소스예요."
          : "주 요리와 곁들이기 좋은 반찬이에요.",
      alreadyLinked: linked(side.id),
    }));
  return { recipeId: recipe.id, candidates };
}

/* ---------- Meal plans (F-02, F-03, F-04) ---------- */

function entriesInWeek(weekStart: string): DbEntry[] {
  const weekEnd = addDays(weekStart, 6);
  return getDb()
    .entries.filter((entry) => entry.date >= weekStart && entry.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getWeeklyPlan(weekStartInput: string): WeeklyMealPlan {
  const weekStart = startOfWeek(weekStartInput);
  const entries = entriesInWeek(weekStart);
  const generation = getDb().generation[weekStart];
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    entries: entries.map(toEntry),
    generation: generation
      ? { status: generation.status, failedDates: generation.failedDates.filter((d) => !entries.some((e) => e.date === d)) }
      : { status: "none", failedDates: [] },
  };
}

export function getMonthSummary(month: string): MonthSummary {
  return {
    month,
    weeks: weeksOfMonth(month).map((weekStart) => ({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      hasMeals: entriesInWeek(weekStart).length > 0,
    })),
  };
}

function mainCandidates(cookMinutes: number, excludeIds: string[] = []): DbRecipe[] {
  return getDb().recipes.filter(
    (recipe) =>
      isSavedActive(recipe) &&
      recipe.category !== "side" &&
      recipe.category !== "sauce" &&
      recipe.cookMinutes !== null &&
      recipe.cookMinutes <= cookMinutes &&
      !excludeIds.includes(recipe.id),
  );
}

/** Mock "AI" side recommendation: only saved recipes the user linked before. */
function recommendSides(main: DbRecipe): string[] {
  return main.sideDishIds.filter((id) => isSavedActive(findRecipe(id))).slice(0, 1);
}

function pickLeastUsed(candidates: DbRecipe[], weekStart: string, seed: number): DbRecipe {
  const usage = new Map<string, number>();
  for (const entry of entriesInWeek(weekStart)) usage.set(entry.mainRecipeId, (usage.get(entry.mainRecipeId) ?? 0) + 1);
  const sorted = [...candidates].sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0));
  const leastCount = usage.get(sorted[0].id) ?? 0;
  const least = sorted.filter((r) => (usage.get(r.id) ?? 0) === leastCount);
  return least[seed % least.length];
}

/** Narrows candidates by keywords in the user's comment; keeps the full list when nothing matches. */
function applyComment(candidates: DbRecipe[], comment: string | undefined): DbRecipe[] {
  const text = comment?.trim() ?? "";
  let result = candidates;
  if (/국|찌개|탕/.test(text)) {
    const soups = result.filter((r) => r.category === "soup");
    if (soups.length > 0) result = soups;
  }
  if (/간단|빠른|빨리|쉬운/.test(text)) {
    result = [...result].sort((a, b) => (a.cookMinutes ?? 0) - (b.cookMinutes ?? 0)).slice(0, 2);
  }
  return result;
}

export function generateMealPlan({ days, comment }: GenerateMealPlanRequest): GenerateMealPlanResponse {
  if (!Array.isArray(days) || days.length === 0) {
    throw new MockHttpError(422, { code: "validation_error", message: "식단을 생성할 날짜를 선택해 주세요." });
  }
  for (const day of days) {
    if (!Number.isInteger(day.servings) || day.servings < 1) {
      throw new MockHttpError(422, { code: "validation_error", message: "인분은 1 이상의 정수여야 합니다." });
    }
  }
  const weekStart = startOfWeek(days[0].date);
  if (days.some((day) => startOfWeek(day.date) !== weekStart) || new Set(days.map((day) => day.date)).size !== days.length) {
    throw new MockHttpError(422, { code: "validation_error", message: "같은 주의 서로 다른 날짜만 선택할 수 있습니다." });
  }
  assertNotGenerating(weekStart);
  const db = getDb();
  const hasSaved = db.recipes.some(isSavedActive);
  const results: GenerateDayResult[] = [];

  days.forEach((day, index) => {
    const candidates = applyComment(mainCandidates(day.cookMinutes), comment);
    if (!hasSaved || candidates.length === 0) {
      // Weekly generation leaves a failed date unassigned and removes the meal it had (F-02).
      removeEntryOn(day.date);
      results.push({
        date: day.date,
        status: "failed",
        reason: hasSaved ? `조리 시간 ${day.cookMinutes}분 이내의 저장 레시피가 없습니다.` : "저장된 레시피가 없습니다.",
      });
      return;
    }
    const main = pickLeastUsed(candidates, weekStart, Number(day.date.slice(-2)) + index);
    const existing = db.entries.find((entry) => entry.date === day.date);
    const entry: DbEntry = {
      id: existing?.id ?? nextId("m"),
      date: day.date,
      mainRecipeId: main.id,
      sideRecipeIds: recommendSides(main),
      servings: day.servings,
      cookMinutesLimit: day.cookMinutes,
      completedAt: null,
      cookingLogId: null,
    };
    if (existing) {
      db.substitutions = db.substitutions.filter((s) => s.entryId !== existing.id);
      db.entries = db.entries.map((e) => (e.id === existing.id ? entry : e));
    } else {
      db.entries.push(entry);
    }
    results.push({ date: day.date, status: "success", reason: null });
  });

  const failedDates = results.filter((r) => r.status === "failed").map((r) => r.date);
  const successCount = results.length - failedDates.length;
  db.generation[weekStart] = {
    status: successCount === 0 ? "failed" : failedDates.length > 0 ? "partial" : "complete",
    failedDates,
  };
  syncChecked(weekStart);
  persist();
  return { results, plan: getWeeklyPlan(weekStart) };
}

function assertNotGenerating(weekStart: string): void {
  if (getDb().generation[weekStart]?.status === "generating") {
    throw new MockHttpError(409, { code: "conflict", message: "이 주의 식단을 생성하고 있습니다. 잠시 후 다시 시도해 주세요." });
  }
}

function removeEntryOn(date: string): void {
  const db = getDb();
  const existing = db.entries.find((entry) => entry.date === date);
  if (!existing) return;
  db.entries = db.entries.filter((entry) => entry.id !== existing.id);
  db.substitutions = db.substitutions.filter((s) => s.entryId !== existing.id);
}

/** Keeps the entry ID; resets completion while the cooking log stays as history. */
export function regenerateMeal(entryId: string, comment: string | undefined): MealPlanEntry {
  const db = getDb();
  const entry = db.entries.find((e) => e.id === entryId);
  if (!entry) throw notFound("식단");
  assertNotGenerating(startOfWeek(entry.date));
  const candidates = applyComment(mainCandidates(entry.cookMinutesLimit, [entry.mainRecipeId]), comment);
  if (candidates.length === 0) {
    throw new MockHttpError(422, {
      code: "no_candidates",
      message: "조건에 맞는 다른 저장 레시피가 없습니다. 기존 식단을 유지합니다.",
    });
  }
  const weekStart = startOfWeek(entry.date);
  const main = pickLeastUsed(candidates, weekStart, Number(entry.date.slice(-2)));
  entry.mainRecipeId = main.id;
  entry.sideRecipeIds = recommendSides(main);
  entry.completedAt = null;
  entry.cookingLogId = null;
  db.substitutions = db.substitutions.filter((s) => s.entryId !== entry.id);
  syncChecked(weekStart);
  persist();
  return toEntry(entry);
}

/* ---------- Cooking (F-08, F-09) ---------- */

function cookingView(entry: DbEntry, recipeId: string): CookingRecipeView {
  const recipe = findRecipe(recipeId);
  const subs = getDb().substitutions.filter((s) => s.entryId === entry.id && s.recipeId === recipeId);
  const ingredients: ScaledIngredient[] = (recipe?.ingredients ?? []).map((ingredient) => {
    const sub = subs.find((s) => s.ingredientId === ingredient.id);
    const baseServings = recipe?.baseServings ?? null;
    return {
      id: ingredient.id,
      name: sub ? sub.name : ingredient.name,
      quantity: scaleQuantity(sub ? sub.baseQuantity : ingredient.quantity, baseServings, entry.servings),
      unit: sub ? sub.unit : ingredient.unit,
      substitutedFrom: sub ? ingredient.name : null,
    };
  });
  return {
    recipe: summary(recipe, recipeId),
    baseServings: recipe?.baseServings ?? null,
    steps: recipe?.steps ?? [],
    ingredients,
    substituteNotes: subs.filter((s) => s.cookingNote).map((s) => `${s.originalName} → ${s.name}: ${s.cookingNote}`),
    previousLogs: logsForRecipe(recipeId),
    sourceUrl: recipe?.sourceUrl ?? "",
    cookingLogId: currentLogId(entry, recipeId),
  };
}

export function getMealDetail(entryId: string): MealDetail {
  const entry = getDb().entries.find((e) => e.id === entryId);
  if (!entry) throw notFound("식단");
  return {
    entry: toEntry(entry),
    main: cookingView(entry, entry.mainRecipeId),
    sides: entry.sideRecipeIds.map((id) => cookingView(entry, id)),
  };
}

export function getTodayMeal(): TodayMealResponse {
  const db = getDb();
  const date = todayISO();
  const entry = db.entries.find((e) => e.date === date);
  return {
    date,
    meal: entry ? getMealDetail(entry.id) : null,
    hasSavedRecipes: db.recipes.some(isSavedActive),
  };
}

/** Current completion log of a recipe in this meal; logs from before a regenerate keep an older completedAt. */
function currentLogId(entry: DbEntry, recipeId: string): string | null {
  if (!entry.completedAt) return null;
  const log = getDb().logs.find((l) => l.entryId === entry.id && l.recipeId === recipeId && l.completedAt === entry.completedAt);
  return log?.id ?? null;
}

/**
 * Completion is per meal, but one log is created per recipe (main + sides) so each can be reviewed.
 * Idempotent: repeated requests keep the first completion and never create a second log.
 */
export function completeMeal(entryId: string): CompleteMealResponse {
  const db = getDb();
  const entry = db.entries.find((e) => e.id === entryId);
  if (!entry) throw notFound("식단");
  const recipeIds = [entry.mainRecipeId, ...entry.sideRecipeIds];
  if (!entry.completedAt) {
    const completedAt = new Date().toISOString();
    for (const recipeId of recipeIds) {
      db.logs.push({ id: nextId("log"), entryId, recipeId, mealDate: entry.date, completedAt, rating: null, memo: null });
    }
    entry.completedAt = completedAt;
    entry.cookingLogId = currentLogId(entry, entry.mainRecipeId);
    persist();
  }
  return {
    entry: toEntry(entry),
    cookingLogs: recipeIds.flatMap((recipeId) => {
      const cookingLogId = currentLogId(entry, recipeId);
      return cookingLogId ? [{ recipeId, cookingLogId }] : [];
    }),
  };
}

/** Rating is required (integer 1–5); memo is optional. */
export function reviewCookingLog(logId: string, rating: number | null | undefined, memo: string | null | undefined): CookingLogSummary {
  const log = getDb().logs.find((l) => l.id === logId);
  if (!log) throw notFound("요리 기록");
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    throw new MockHttpError(422, {
      code: "validation_error",
      message: "별점을 선택해 주세요.",
      fieldErrors: { rating: `별점은 ${RATING_MIN}~${RATING_MAX}점 중에서 선택해 주세요.` },
    });
  }
  log.rating = rating;
  log.memo = memo?.trim() ? memo.trim() : null;
  persist();
  return { id: log.id, mealDate: log.mealDate, completedAt: log.completedAt, rating: log.rating, memo: log.memo };
}

/* ---------- Shopping list (F-05, F-06) ---------- */

function shoppingInputs(weekStart: string): ShoppingSourceInput[] {
  const db = getDb();
  const inputs: ShoppingSourceInput[] = [];
  for (const entry of entriesInWeek(weekStart)) {
    for (const recipeId of [entry.mainRecipeId, ...entry.sideRecipeIds]) {
      const recipe = findRecipe(recipeId);
      if (!recipe) continue;
      for (const ingredient of recipe.ingredients) {
        const sub = db.substitutions.find((s) => s.entryId === entry.id && s.recipeId === recipeId && s.ingredientId === ingredient.id);
        inputs.push({
          targetIngredientId: sub ? sub.substituteIngredientId : ingredient.ingredientId,
          targetName: sub ? sub.name : ingredient.name,
          entryId: entry.id,
          date: entry.date,
          recipeId,
          recipeTitle: recipe.title,
          originalName: ingredient.name,
          quantity: scaleQuantity(sub ? sub.baseQuantity : ingredient.quantity, recipe.baseServings, entry.servings),
          unit: sub ? sub.unit : ingredient.unit,
        });
      }
    }
  }
  return inputs;
}

function isSubstituted(entryId: string, recipeId: string, originalName: string): boolean {
  return getDb().substitutions.some((s) => s.entryId === entryId && s.recipeId === recipeId && s.originalName === originalName);
}

/** Drop checked state of items that are no longer needed (new items start unchecked). */
function syncChecked(weekStart: string): void {
  const db = getDb();
  const ids = aggregateShoppingItems(shoppingInputs(weekStart)).map((item) => `${weekStart}:${item.id}`);
  const weekChecked = new Set(db.checked.filter((key) => key.startsWith(`${weekStart}:`)));
  const kept = carryOverChecked(weekChecked, ids);
  db.checked = [...db.checked.filter((key) => !key.startsWith(`${weekStart}:`)), ...kept];
}

export function getShoppingList(weekStartInput: string): ShoppingList {
  const weekStart = startOfWeek(weekStartInput);
  const db = getDb();
  const checked = new Set(db.checked);
  const items: ShoppingItem[] = aggregateShoppingItems(shoppingInputs(weekStart)).map((item) => ({
    id: item.id,
    name: item.name,
    amounts: item.amounts,
    checked: checked.has(`${weekStart}:${item.id}`),
    sources: item.sources,
    substituteFor: item.sources
      .filter((s) => isSubstituted(s.entryId, s.recipeId, s.originalName))
      .map(({ entryId, date, recipeId, recipeTitle, originalName }) => ({ entryId, date, recipeId, recipeTitle, originalName })),
    hasSubstituteCandidates: item.sources.some(
      (s) => !isSubstituted(s.entryId, s.recipeId, s.originalName) && !!SUBSTITUTE_RULES[normalizeIngredientName(s.originalName)],
    ),
  }));
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    hasConfirmedMeals: entriesInWeek(weekStart).length > 0,
    items,
    neededCount: items.filter((item) => !item.checked).length,
  };
}

export function setItemChecked(weekStartInput: string, itemId: string, value: boolean): ShoppingList {
  const weekStart = startOfWeek(weekStartInput);
  const list = getShoppingList(weekStart);
  if (!list.items.some((item) => item.id === itemId)) throw notFound("장보기 항목");
  const db = getDb();
  const key = `${weekStart}:${itemId}`;
  db.checked = db.checked.filter((k) => k !== key);
  if (value) db.checked.push(key);
  persist();
  return getShoppingList(weekStart);
}

function candidateId(name: string, index: number): string {
  return `${normalizeIngredientName(name)}-${index}`;
}

export function getSubstituteOptions(weekStartInput: string, itemId: string): SubstituteOptions {
  const weekStart = startOfWeek(weekStartInput);
  const item = aggregateShoppingItems(shoppingInputs(weekStart)).find((i) => i.id === itemId);
  if (!item) throw notFound("장보기 항목");
  const targets = item.sources
    .filter((source) => !isSubstituted(source.entryId, source.recipeId, source.originalName))
    .map((source) => {
      const rules = SUBSTITUTE_RULES[normalizeIngredientName(source.originalName)] ?? [];
      const candidates: SubstituteCandidate[] = rules.slice(0, 2).map((rule, index) => ({
        id: candidateId(rule.name, index),
        name: rule.name,
        ratio: rule.ratioLabel,
        quantity: rule.factor !== null && source.quantity !== null ? Math.round(source.quantity * rule.factor * 100) / 100 : null,
        unit: rule.unit ?? source.unit,
        tasteDifference: rule.tasteDifference,
        cookingChange: rule.cookingChange,
        caution: rule.caution,
        uncertain: rule.factor === null || source.quantity === null,
      }));
      return {
        entryId: source.entryId,
        date: source.date,
        recipeId: source.recipeId,
        recipeTitle: source.recipeTitle,
        originalName: source.originalName,
        candidates,
      };
    })
    .filter((target) => target.candidates.length > 0);
  return { itemId: item.id, itemName: item.name, targets };
}

/** Applies a substitute to one recipe of one meal only, then recalculates the list atomically. */
export function applySubstitute(weekStartInput: string, itemId: string, request: ApplySubstituteRequest): ShoppingList {
  const weekStart = startOfWeek(weekStartInput);
  const options = getSubstituteOptions(weekStart, itemId);
  const target = options.targets.find((t) => t.entryId === request.entryId && t.recipeId === request.recipeId);
  const candidate = target?.candidates.find((c) => c.id === request.candidateId);
  if (!target || !candidate) throw notFound("대체 후보");
  if (candidate.uncertain && !request.confirmedUncertain) {
    throw new MockHttpError(422, {
      code: "validation_error",
      message: "필요량이 확인되지 않은 대체 재료입니다. 확인 후 다시 적용해 주세요.",
      fieldErrors: { confirmedUncertain: "필요량 확인이 필요합니다." },
    });
  }
  const db = getDb();
  const recipe = findRecipe(target.recipeId);
  const ingredient = recipe?.ingredients.find((i) => i.name === target.originalName);
  if (!recipe || !ingredient) throw notFound("레시피 재료");
  const rule = (SUBSTITUTE_RULES[normalizeIngredientName(ingredient.name)] ?? []).find((r) => r.name === candidate.name);
  db.substitutions.push({
    entryId: target.entryId,
    recipeId: recipe.id,
    ingredientId: ingredient.id,
    substituteIngredientId: ensureIngredient(db, candidate.name),
    originalName: ingredient.name,
    name: candidate.name,
    baseQuantity: rule?.factor != null && ingredient.quantity !== null ? Math.round(ingredient.quantity * rule.factor * 100) / 100 : null,
    unit: rule?.unit ?? ingredient.unit,
    cookingNote: candidate.cookingChange,
  });
  syncChecked(weekStart);
  persist();
  return getShoppingList(weekStart);
}

export function currentMonth(): string {
  return monthOf(todayISO());
}
