import { beforeEach, describe, expect, it } from "vitest";
import { createSeed, getDb, resetDb } from "@/mocks/db";
import * as api from "@/mocks/service";
import { addDays, startOfWeek, todayISO } from "@/lib/date";

/** Mock rules for manual day meals (API_SPEC 4.8–4.10, MEAL-001). */

const today = todayISO();
const nextWeek = addDays(startOfWeek(today), 7);

beforeEach(() => resetDb(createSeed()));

function expectStatus(fn: () => unknown, status: number) {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(api.MockHttpError);
  expect((caught as api.MockHttpError).status).toBe(status);
}

const todayEntry = () => {
  const entry = api.getWeeklyPlan(today).entries.find((e) => e.date === today);
  if (!entry) throw new Error("seed has no meal today");
  return entry;
};

describe("set day meal (4.8)", () => {
  it("saves exactly the sent recipes, any category, with a 360-minute limit", () => {
    const entry = api.setDayMeal(nextWeek, { mainRecipeId: "r-spinach", sideRecipeIds: ["r-cucumber", "r-cucumber"], servings: 3 });
    expect(entry.mainRecipe.id).toBe("r-spinach");
    expect(entry.sideRecipes.map((s) => s.id)).toEqual(["r-cucumber"]);
    expect(entry.servings).toBe(3);
    expect(entry.cookMinutesLimit).toBe(api.MANUAL_COOK_MINUTES_LIMIT);
    expect(api.getShoppingList(nextWeek).items.length).toBeGreaterThan(0);
  });

  it("does not add linked sides the client left out", () => {
    const entry = api.setDayMeal(nextWeek, { mainRecipeId: "r-jeyuk", sideRecipeIds: ["r-egg-roll"], servings: 1 });
    expect(entry.sideRecipes.map((s) => s.id)).toEqual(["r-egg-roll"]);
  });

  it("keeps the entry ID when replacing an existing meal", () => {
    const existing = todayEntry();
    const entry = api.setDayMeal(today, { mainRecipeId: "r-tuna-mayo", sideRecipeIds: [], servings: 1 });
    expect(entry.id).toBe(existing.id);
    expect(entry.mainRecipe.id).toBe("r-tuna-mayo");
  });

  it("rejects past dates and completed meals with 409", () => {
    expectStatus(() => api.setDayMeal(addDays(today, -1), { mainRecipeId: "r-jeyuk", sideRecipeIds: [], servings: 1 }), 409);
    api.completeMeal(todayEntry().id);
    expectStatus(() => api.setDayMeal(today, { mainRecipeId: "r-jeyuk", sideRecipeIds: [], servings: 1 }), 409);
  });

  it("validates servings, sides and recipe availability with 422", () => {
    expectStatus(() => api.setDayMeal(nextWeek, { mainRecipeId: "r-jeyuk", sideRecipeIds: [], servings: 0 }), 422);
    expectStatus(() => api.setDayMeal(nextWeek, { mainRecipeId: "r-jeyuk", sideRecipeIds: [], servings: 21 }), 422);
    expectStatus(() => api.setDayMeal(nextWeek, { mainRecipeId: "r-jeyuk", servings: 1 }), 422);
    expectStatus(() => api.setDayMeal(nextWeek, { mainRecipeId: "r-review-1", sideRecipeIds: [], servings: 1 }), 422);
    expectStatus(() => api.setDayMeal(nextWeek, { mainRecipeId: "r-jeyuk", sideRecipeIds: ["r-jeyuk"], servings: 1 }), 422);
  });
});

describe("clear day meal (4.9)", () => {
  it("removes the meal and is idempotent", () => {
    api.setDayMeal(nextWeek, { mainRecipeId: "r-jeyuk", sideRecipeIds: [], servings: 1 });
    api.clearDayMeal(nextWeek);
    expect(api.getWeeklyPlan(nextWeek).entries).toHaveLength(0);
    expect(() => api.clearDayMeal(nextWeek)).not.toThrow();
  });

  it("rejects past dates and completed meals with 409", () => {
    expectStatus(() => api.clearDayMeal(addDays(today, -1)), 409);
    api.completeMeal(todayEntry().id);
    expectStatus(() => api.clearDayMeal(today), 409);
  });
});

describe("uncomplete meal (4.10)", () => {
  it("clears completion and deletes the meal's current logs including reviews", () => {
    const entry = todayEntry();
    const { cookingLogs } = api.completeMeal(entry.id);
    api.reviewCookingLog(cookingLogs[0].cookingLogId, 5, "맛있음");
    const updated = api.uncompleteMeal(entry.id);
    expect(updated.completedAt).toBeNull();
    expect(updated.cookingLogId).toBeNull();
    expect(getDb().logs.some((l) => l.entryId === entry.id)).toBe(false);
    // Idempotent, and editable again afterwards.
    expect(api.uncompleteMeal(entry.id).completedAt).toBeNull();
    expect(() => api.setDayMeal(today, { mainRecipeId: "r-tuna-mayo", sideRecipeIds: [], servings: 1 })).not.toThrow();
  });

  it("rejects past meals with 409 and unknown meals with 404", () => {
    const past = getDb().entries.find((e) => e.date < today && e.completedAt);
    if (!past) throw new Error("seed has no completed past meal");
    expectStatus(() => api.uncompleteMeal(past.id), 409);
    expectStatus(() => api.uncompleteMeal("nope"), 404);
  });
});
