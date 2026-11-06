import { describe, expect, it } from "vitest";
import { averageRating, lastCookedAt, sortRecipes } from "@/features/recipes/sort";
import type { CookingLogSummary, Recipe } from "@/lib/api/contracts";

const log = (completedAt: string, rating: number | null = null): CookingLogSummary => ({
  id: `log-${completedAt}`,
  mealDate: completedAt.slice(0, 10),
  completedAt,
  rating,
  memo: null,
});

const recipe = (id: string, createdAt: string, cookingLogs: CookingLogSummary[] = []): Recipe => ({
  id,
  sourceUrl: `https://example.com/${id}`,
  title: id,
  imageUrl: null,
  status: "saved",
  category: "main",
  baseServings: 1,
  cookMinutes: 10,
  ingredients: [],
  steps: [],
  uncertainFields: [],
  failureReason: null,
  cookingLogs,
  createdAt,
});

const ids = (recipes: Recipe[]) => recipes.map((r) => r.id);

const neverOld = recipe("never-old", "2026-10-01T00:00:00Z");
const neverNew = recipe("never-new", "2026-10-05T00:00:00Z");
const cookedLongAgo = recipe("cooked-long-ago", "2026-10-03T00:00:00Z", [log("2026-10-10T19:00:00Z", 2)]);
const cookedRecently = recipe("cooked-recently", "2026-10-02T00:00:00Z", [
  log("2026-10-08T19:00:00Z", 5),
  log("2026-11-01T19:00:00Z", 4),
]);
const all = [cookedRecently, neverOld, cookedLongAgo, neverNew];

describe("recipe picker sorting (MEAL-001)", () => {
  it("least recently cooked: never-cooked first, then the oldest last cook", () => {
    expect(ids(sortRecipes(all, "least_recent"))).toEqual(["never-new", "never-old", "cooked-long-ago", "cooked-recently"]);
  });

  it("newest: createdAt descending", () => {
    expect(ids(sortRecipes(all, "newest"))).toEqual(["never-new", "cooked-long-ago", "cooked-recently", "never-old"]);
  });

  it("rating: highest average first, unrated last", () => {
    expect(ids(sortRecipes(all, "rating"))).toEqual(["cooked-recently", "cooked-long-ago", "never-new", "never-old"]);
  });

  it("does not mutate the input", () => {
    const input = [...all];
    sortRecipes(input, "newest");
    expect(input).toEqual(all);
  });

  it("derives the last cook and the average of rated logs only", () => {
    expect(lastCookedAt(cookedRecently)).toBe("2026-11-01T19:00:00Z");
    expect(lastCookedAt(neverOld)).toBeNull();
    const mixed = recipe("mixed", "2026-10-01T00:00:00Z", [log("2026-10-01T19:00:00Z", 3), log("2026-10-02T19:00:00Z", null)]);
    expect(averageRating(mixed)).toBe(3);
    expect(averageRating(neverOld)).toBeNull();
  });
});
