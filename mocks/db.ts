import type { RecipeCategory, RecipeIngredient, RecipeStatus, Unit } from "@/lib/api/contracts";
import { addDays, defaultCookMinutes, startOfWeek, todayISO, weekDates } from "@/lib/date";
import { normalizeIngredientName } from "@/services/shopping";
import { SAVED_RECIPES } from "./fixtures";

/** In-memory state of the mock backend. Persisted to localStorage in the browser (dev only). */

export interface DbRecipe {
  id: string;
  /** `null` for a manual recipe without a reference link (RECIPE-001). */
  sourceUrl: string | null;
  title: string | null;
  imageUrl: string | null;
  status: RecipeStatus;
  category: RecipeCategory | null;
  baseServings: number | null;
  cookMinutes: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  uncertainFields: string[];
  failureReason: string | null;
  createdAt: string;
  sideDishIds: string[];
  /** Soft delete: hidden from lists and candidates, still referenced by past meals and logs. */
  isDelete: boolean;
  /** Pending import job. */
  job: { readyAt: number; outcome: "needs_review" | "failed"; revised: boolean } | null;
  attempts: number;
}

export interface DbEntry {
  id: string;
  date: string;
  mainRecipeId: string;
  sideRecipeIds: string[];
  servings: number;
  cookMinutesLimit: number;
  completedAt: string | null;
  cookingLogId: string | null;
}

export interface DbLog {
  id: string;
  entryId: string;
  recipeId: string;
  mealDate: string;
  completedAt: string;
  rating: number | null;
  memo: string | null;
}

/** Shared ingredient master: one row per spelling ("마늘" and "다진 마늘" are different rows). */
export interface DbIngredient {
  id: string;
  name: string;
  normalizedName: string;
}

export interface DbSubstitution {
  entryId: string;
  recipeId: string;
  /** Recipe ingredient row (`RecipeIngredient.id`) being replaced. */
  ingredientId: string;
  /** Ingredient master ID of the substitute. */
  substituteIngredientId: string;
  originalName: string;
  name: string;
  /** Quantity in the recipe's base servings; null = 미확인. */
  baseQuantity: number | null;
  unit: string | null;
  cookingNote: string | null;
}

export interface DbState {
  ingredients: DbIngredient[];
  recipes: DbRecipe[];
  entries: DbEntry[];
  logs: DbLog[];
  substitutions: DbSubstitution[];
  /** `${weekStart}:${itemId}` */
  checked: string[];
  generation: Record<string, { status: "generating" | "partial" | "complete" | "failed"; failedDates: string[] }>;
  seq: number;
}

const STORAGE_KEY = "recipe-app-mock-db-v2";

let state: DbState | null = null;

export function nextId(prefix: string): string {
  const db = getDb();
  db.seq += 1;
  return `${prefix}-${db.seq}`;
}

/** Links an ingredient name to the master table, creating the row when the normalized name is new. */
export function ensureIngredient(db: DbState, name: string): string {
  const normalizedName = normalizeIngredientName(name);
  const found = db.ingredients.find((ingredient) => ingredient.normalizedName === normalizedName);
  if (found) return found.id;
  db.seq += 1;
  const id = `ing-${db.seq}`;
  db.ingredients.push({ id, name: name.trim(), normalizedName });
  return id;
}

/** Recipe ingredient rows linked to the ingredient master. */
export function linkIngredients(
  db: DbState,
  recipeId: string,
  ingredients: Array<Omit<RecipeIngredient, "id" | "ingredientId">>,
  prefix = "i",
): RecipeIngredient[] {
  return ingredients.map((ingredient, index) => ({
    ...ingredient,
    id: `${recipeId}-${prefix}${index}`,
    ingredientId: ensureIngredient(db, ingredient.name),
  }));
}

function recipeFromFixture(db: DbState, fixture: (typeof SAVED_RECIPES)[number], createdAt: string): DbRecipe {
  return {
    id: fixture.id,
    sourceUrl: fixture.sourceUrl,
    title: fixture.title,
    imageUrl: null,
    status: "saved",
    category: fixture.category,
    baseServings: fixture.baseServings,
    cookMinutes: fixture.cookMinutes,
    ingredients: linkIngredients(db, fixture.id, fixture.ingredients),
    steps: fixture.steps,
    uncertainFields: [],
    failureReason: null,
    createdAt,
    sideDishIds: fixture.sideDishIds ?? [],
    isDelete: false,
    job: null,
    attempts: 1,
  };
}

export interface SeedOptions {
  now?: Date;
  /** Start with no data at all (empty-state scenario). */
  empty?: boolean;
}

export function createSeed({ now = new Date(), empty = false }: SeedOptions = {}): DbState {
  const base: DbState = { ingredients: [], recipes: [], entries: [], logs: [], substitutions: [], checked: [], generation: {}, seq: 100 };
  if (empty) return base;

  const createdAt = new Date(now.getTime() - 7 * 86400000).toISOString();
  base.recipes = SAVED_RECIPES.map((fixture) => recipeFromFixture(base, fixture, createdAt));
  base.recipes.push(
    {
      ...recipeFromFixture(
        base,
        {
          id: "r-review-1",
          title: "어묵볶음",
          sourceUrl: "https://blog.naver.com/cook/eomuk",
          category: "side",
          baseServings: 2,
          cookMinutes: null,
          ingredients: [
            { name: "사각어묵", quantity: 3, unit: "장" },
            { name: "양파", quantity: 0.5, unit: "개" },
          ],
          steps: ["어묵을 썬다.", "양파와 함께 볶는다."],
        },
        now.toISOString(),
      ),
      status: "needs_review",
      uncertainFields: ["cookMinutes"],
    },
    {
      ...recipeFromFixture(
        base,
        {
          id: "r-failed-1",
          title: "",
          sourceUrl: "https://www.10000recipe.com/recipe/6999999",
          category: "main",
          baseServings: null,
          cookMinutes: null,
          ingredients: [],
          steps: [],
        },
        now.toISOString(),
      ),
      title: null,
      category: null,
      status: "failed",
      failureReason: "페이지 본문을 가져오지 못했습니다.",
    },
  );

  const today = todayISO(now);
  const weekStart = startOfWeek(today);
  const plan: Array<[number, string, string[], number]> = [
    [0, "r-jeyuk", ["r-spinach"], 2],
    [1, "r-doenjang", ["r-egg-roll"], 2],
    [3, "r-cream-pasta", [], 1],
    [5, "r-dakgalbi", ["r-cucumber"], 2],
  ];
  const usedOffsets = new Set(plan.map(([offset]) => offset));
  const todayOffset = weekDates(weekStart).indexOf(today);
  if (!usedOffsets.has(todayOffset)) plan.push([todayOffset, "r-kimchi-rice", ["r-cucumber"], 1]);

  for (const [offset, mainRecipeId, sideRecipeIds, servings] of plan) {
    const date = addDays(weekStart, offset);
    base.entries.push({
      id: `m-${date}`,
      date,
      mainRecipeId,
      sideRecipeIds,
      servings,
      cookMinutesLimit: defaultCookMinutes(date),
      completedAt: null,
      cookingLogId: null,
    });
  }

  // Previous week: completed meals with history.
  const prevWeek = addDays(weekStart, -7);
  const history: Array<[number, string, number | null, string | null]> = [
    [1, "r-jeyuk", 4, "고추장을 조금 줄이면 더 좋을 듯"],
    [3, "r-seaweed-soup", null, null],
    [5, "r-bulgogi-set", 5, "양파를 더 넣었더니 달고 맛있었다"],
  ];
  for (const [offset, mainRecipeId, rating, memo] of history) {
    const date = addDays(prevWeek, offset);
    const entryId = `m-${date}`;
    const logId = `log-${date}`;
    const completedAt = new Date(`${date}T19:30:00`).toISOString();
    base.entries.push({
      id: entryId,
      date,
      mainRecipeId,
      sideRecipeIds: [],
      servings: 2,
      cookMinutesLimit: defaultCookMinutes(date),
      completedAt,
      cookingLogId: logId,
    });
    base.logs.push({ id: logId, entryId, recipeId: mainRecipeId, mealDate: date, completedAt, rating, memo });
  }

  base.generation[weekStart] = { status: "complete", failedDates: [] };
  base.generation[prevWeek] = { status: "complete", failedDates: [] };
  return base;
}

function canPersist(): boolean {
  return typeof window !== "undefined" && process.env.NODE_ENV !== "test";
}

export function getDb(): DbState {
  if (state) return state;
  if (canPersist()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw) as DbState;
        return state;
      }
    } catch {
      // Storage unavailable — fall through to a fresh seed.
    }
  }
  state = createSeed({ empty: currentScenario() === "empty" });
  persist();
  return state;
}

export function persist(): void {
  if (!state || !canPersist()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / privacy-mode errors.
  }
}

/** Replace the whole mock state (tests) or reseed it. */
export function resetDb(next?: DbState): void {
  state = next ?? createSeed();
  if (canPersist()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  persist();
}

/* ---------- Scenarios ---------- */

export type MockScenario = "default" | "empty" | "server-error" | "unauthorized" | "slow";
const SCENARIO_KEY = "msw-scenario";

export function currentScenario(): MockScenario {
  if (typeof window === "undefined" || process.env.NODE_ENV === "test") return "default";
  try {
    return (window.localStorage.getItem(SCENARIO_KEY) as MockScenario | null) ?? "default";
  } catch {
    return "default";
  }
}

/** `?scenario=empty` in the URL switches the mock scenario (and reseeds for `empty`). */
export function applyScenarioFromUrl(): void {
  if (typeof window === "undefined") return;
  const scenario = new URLSearchParams(window.location.search).get("scenario") as MockScenario | null;
  if (!scenario) return;
  try {
    window.localStorage.setItem(SCENARIO_KEY, scenario);
  } catch {
    return;
  }
  if (scenario === "empty" || scenario === "default") resetDb(createSeed({ empty: scenario === "empty" }));
}

/* ---------- Units (RECIPE-001, `GET /units`) ---------- */

/** Mirrors the backend seed: dimension order mass → volume → count → unmeasured. Read-only in the mock. */
export const UNITS: Unit[] = [
  { code: "g", label: "g", dimension: "mass" },
  { code: "kg", label: "kg", dimension: "mass" },
  { code: "L", label: "L", dimension: "volume" },
  { code: "ml", label: "ml", dimension: "volume" },
  { code: "tsp", label: "작은술", dimension: "volume" },
  { code: "cup", label: "컵", dimension: "volume" },
  { code: "tbsp", label: "큰술", dimension: "volume" },
  { code: "ea", label: "개", dimension: "count" },
  { code: "bowl", label: "공기", dimension: "count" },
  { code: "bunch", label: "단", dimension: "count" },
  { code: "stalk", label: "대", dimension: "count" },
  { code: "block", label: "모", dimension: "count" },
  { code: "pack", label: "봉지", dimension: "count" },
  { code: "sheet", label: "장", dimension: "count" },
  { code: "piece", label: "조각", dimension: "count" },
  { code: "handful", label: "줌", dimension: "count" },
  { code: "clove", label: "쪽", dimension: "count" },
  { code: "can", label: "캔", dimension: "count" },
  { code: "head", label: "통", dimension: "count" },
  { code: "pinch", label: "약간", dimension: "unmeasured" },
  { code: "to_taste", label: "적당량", dimension: "unmeasured" },
];
