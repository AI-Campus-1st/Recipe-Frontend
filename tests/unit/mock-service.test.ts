import { beforeEach, describe, expect, it } from "vitest";
import { createSeed, resetDb } from "@/mocks/db";
import * as api from "@/mocks/service";
import { addDays, startOfWeek, todayISO } from "@/lib/date";

/** Domain rules the mock backend must uphold, mirroring FEATURE_SPEC. */

const weekStart = startOfWeek(todayISO());
const nextWeek = addDays(weekStart, 7);

beforeEach(() => resetDb(createSeed()));

/** Shopping item IDs are ingredient master IDs, so tests look items up by name. */
const itemId = (name: string) => {
  const item = api.getShoppingList(weekStart).items.find((i) => i.name === name);
  if (!item) throw new Error(`no shopping item ${name}`);
  return item.id;
};

describe("meal plan generation (F-02)", () => {
  it("only fills selected dates and confirms immediately", () => {
    const { results, plan } = api.generateMealPlan({
      days: [{ date: nextWeek, servings: 2, cookMinutes: 30 }],
    });
    expect(results).toEqual([{ date: nextWeek, status: "success", reason: null }]);
    expect(plan.entries.map((e) => e.date)).toEqual([nextWeek]);
    expect(plan.entries[0].servings).toBe(2);
    expect(plan.generation.status).toBe("complete");
  });

  it("keeps successful dates when some dates fail", () => {
    const { results, plan } = api.generateMealPlan({
      days: [
        { date: nextWeek, servings: 1, cookMinutes: 30 },
        { date: addDays(nextWeek, 1), servings: 1, cookMinutes: 5 },
      ],
    });
    expect(results.map((r) => r.status)).toEqual(["success", "failed"]);
    expect(plan.entries).toHaveLength(1);
    expect(plan.generation).toEqual({ status: "partial", failedDates: [addDays(nextWeek, 1)] });
  });

  it("removes the existing meal of a date that fails in weekly generation", () => {
    const existing = api.getWeeklyPlan(weekStart).entries[0];
    const { results, plan } = api.generateMealPlan({ days: [{ date: existing.date, servings: 1, cookMinutes: 5 }] });
    expect(results[0].status).toBe("failed");
    expect(plan.entries.some((e) => e.date === existing.date)).toBe(false);
    expect(plan.generation.failedDates).toEqual([existing.date]);
  });

  it("rejects dates across weeks or duplicated dates", () => {
    const day = { servings: 1, cookMinutes: 30 };
    expect(() => api.generateMealPlan({ days: [{ ...day, date: weekStart }, { ...day, date: nextWeek }] })).toThrowError(/같은 주/);
    expect(() => api.generateMealPlan({ days: [{ ...day, date: nextWeek }, { ...day, date: nextWeek }] })).toThrowError(/같은 주/);
  });

  it("never fills with recipes the user has not saved", () => {
    resetDb(createSeed({ empty: true }));
    const { results, plan } = api.generateMealPlan({ days: [{ date: nextWeek, servings: 1, cookMinutes: 70 }] });
    expect(results[0]).toMatchObject({ status: "failed", reason: "저장된 레시피가 없습니다." });
    expect(plan.entries).toHaveLength(0);
  });

  it("only recommends saved recipes within the cooking-time limit", () => {
    const { plan } = api.generateMealPlan({ days: [{ date: nextWeek, servings: 1, cookMinutes: 10 }] });
    expect(plan.entries[0].mainRecipe.id).toBe("r-tuna-mayo");
  });
});

describe("per-date regeneration (F-03)", () => {
  it("changes only the target date and keeps its ID", () => {
    const before = api.getWeeklyPlan(weekStart).entries;
    const target = before[0];
    const updated = api.regenerateMeal(target.id, undefined);
    expect(updated.id).toBe(target.id);
    expect(updated.mainRecipe.id).not.toBe(target.mainRecipe.id);
    const after = api.getWeeklyPlan(weekStart).entries;
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it("keeps the existing meal when there is no other candidate", () => {
    const { plan } = api.generateMealPlan({ days: [{ date: nextWeek, servings: 1, cookMinutes: 10 }] });
    const entry = plan.entries[0];
    expect(() => api.regenerateMeal(entry.id, undefined)).toThrowError(/다른 저장 레시피가 없습니다/);
    expect(api.getWeeklyPlan(nextWeek).entries[0]).toEqual(entry);
  });
});

describe("cooking completion (F-08)", () => {
  it("is idempotent", () => {
    const entry = api.getWeeklyPlan(weekStart).entries[0];
    const first = api.completeMeal(entry.id).entry;
    const second = api.completeMeal(entry.id).entry;
    expect(second.completedAt).toBe(first.completedAt);
    expect(second.cookingLogId).toBe(first.cookingLogId);
    const logs = api.listRecipes(null).find((r) => r.id === entry.mainRecipe.id)!.cookingLogs;
    expect(logs.filter((l) => l.id === first.cookingLogId)).toHaveLength(1);
  });

  it("stores a review independently of completion", () => {
    const entry = api.getWeeklyPlan(weekStart).entries[0];
    const { cookingLogId } = api.completeMeal(entry.id).entry;
    expect(api.reviewCookingLog(cookingLogId!, 4, " 맛있음 ")).toMatchObject({ rating: 4, memo: "맛있음" });
    expect(api.getMealDetail(entry.id).entry.completedAt).not.toBeNull();
  });

  it("requires a 1–5 integer rating (F-09)", () => {
    const entry = api.getWeeklyPlan(weekStart).entries[0];
    const { cookingLogId } = api.completeMeal(entry.id).entry;
    expect(() => api.reviewCookingLog(cookingLogId!, null, "메모만")).toThrowError(/별점/);
    expect(() => api.reviewCookingLog(cookingLogId!, 6, null)).toThrowError(/별점/);
    expect(() => api.reviewCookingLog(cookingLogId!, 2.5, null)).toThrowError(/별점/);
    expect(api.reviewCookingLog(cookingLogId!, 5, "  ")).toMatchObject({ rating: 5, memo: null });
  });

  it("resets completion on regeneration and keeps the cooking log as history", () => {
    const entry = api.getWeeklyPlan(weekStart).entries[0];
    const { cookingLogId } = api.completeMeal(entry.id).entry;
    const updated = api.regenerateMeal(entry.id, undefined);
    expect(updated).toMatchObject({ id: entry.id, completedAt: null, cookingLogId: null });
    const logs = api.getRecipe(entry.mainRecipe.id).cookingLogs;
    expect(logs.some((log) => log.id === cookingLogId)).toBe(true);
  });

  it("creates one log per recipe so main and side are reviewed separately", () => {
    const entry = api.getWeeklyPlan(weekStart).entries.find((e) => e.sideRecipes.length > 0)!;
    const { cookingLogs } = api.completeMeal(entry.id);
    expect(cookingLogs.map((l) => l.recipeId)).toEqual([entry.mainRecipe.id, ...entry.sideRecipes.map((r) => r.id)]);
    expect(api.completeMeal(entry.id).cookingLogs).toEqual(cookingLogs);

    const side = cookingLogs[1];
    api.reviewCookingLog(side.cookingLogId, 3, "곁들임 평가");
    const detail = api.getMealDetail(entry.id);
    expect(detail.sides[0].cookingLogId).toBe(side.cookingLogId);
    expect(detail.sides[0].previousLogs.find((l) => l.id === side.cookingLogId)).toMatchObject({ rating: 3 });
    expect(detail.main.previousLogs.find((l) => l.id === detail.main.cookingLogId)).toMatchObject({ rating: null });
  });
});

describe("shopping list and substitutes (F-05, F-06)", () => {
  it("uses ingredient master IDs as stable item keys", () => {
    const recipe = api.getRecipe("r-jeyuk");
    const onion = recipe.ingredients.find((i) => i.name === "양파")!;
    expect(itemId("양파")).toBe(onion.ingredientId);
    expect(api.getRecipe("r-doenjang").ingredients.find((i) => i.name === "양파")?.ingredientId).toBe(onion.ingredientId);
  });

  it("keeps the checked state of items that remain needed", () => {
    const onionId = itemId("양파");
    api.setItemChecked(weekStart, onionId, true);
    const target = api.getWeeklyPlan(weekStart).entries.find((e) => e.mainRecipe.id === "r-jeyuk")!;
    api.regenerateMeal(target.id, undefined);
    const onion = api.getShoppingList(weekStart).items.find((i) => i.id === onionId);
    expect(onion?.checked).toBe(true);
  });

  it("applies a substitute to one recipe only and preserves other usages", () => {
    const greenOnionId = itemId("대파");
    const list = api.getShoppingList(weekStart);
    const greenOnion = list.items.find((i) => i.id === greenOnionId)!;
    expect(greenOnion.sources.length).toBeGreaterThan(1);

    const options = api.getSubstituteOptions(weekStart, greenOnionId);
    const target = options.targets[0];
    const candidate = target.candidates.find((c) => c.name === "쪽파")!;
    const after = api.applySubstitute(weekStart, greenOnionId, {
      entryId: target.entryId,
      recipeId: target.recipeId,
      candidateId: candidate.id,
    });

    const replaced = after.items.find((i) => i.name === "쪽파")!;
    expect(replaced.substituteFor).toEqual([expect.objectContaining({ recipeId: target.recipeId, originalName: "대파" })]);
    const remaining = after.items.find((i) => i.id === greenOnionId)!;
    expect(remaining.sources).toHaveLength(greenOnion.sources.length - 1);
    expect(remaining.sources.some((s) => s.entryId === target.entryId && s.recipeId === target.recipeId)).toBe(false);
  });

  it("requires confirmation for uncertain substitutes", () => {
    const creamId = itemId("생크림");
    const options = api.getSubstituteOptions(weekStart, creamId);
    const target = options.targets[0];
    const uncertain = target.candidates.find((c) => c.uncertain)!;
    const request = { entryId: target.entryId, recipeId: target.recipeId, candidateId: uncertain.id };
    expect(() => api.applySubstitute(weekStart, creamId, request)).toThrowError(/확인/);
    const after = api.applySubstitute(weekStart, creamId, { ...request, confirmedUncertain: true });
    expect(after.items.find((i) => i.name === "무가당 두유")?.amounts).toEqual([{ quantity: null, unit: "ml" }]);
  });
});

describe("recipe import (F-01)", () => {
  it("rejects non-http URLs and recipe-less YouTube/만개의레시피 URLs", () => {
    expect(() => api.importRecipe({ url: "javascript:alert(1)" })).toThrowError(/URL/);
    expect(() => api.importRecipe({ url: "https://www.youtube.com/feed/trending" })).toThrowError(/레시피 페이지/);
    expect(() => api.importRecipe({ url: "https://www.10000recipe.com/recipe/list.html" })).toThrowError(/레시피 페이지/);
    expect(() => api.importRecipe({ url: "https://www.instagram.com/cook.daily/" })).toThrowError(/레시피 페이지/);
    expect(() => api.importRecipe({ url: "https://www.instagram.com/stories/cook.daily/1/" })).toThrowError(/레시피 페이지/);
  });

  it("imports an Instagram reel and detects other URL forms of the same post as duplicates", () => {
    const { recipe } = api.importRecipe({ url: "https://www.instagram.com/reel/DeoNEDwBZsZ/?utm_source=ig_web_copy_link&igsh=abc" });
    expect(recipe.status).toBe("importing");
    for (const url of [
      "https://instagram.com/p/DeoNEDwBZsZ",
      "https://m.instagram.com/reels/DeoNEDwBZsZ/",
      "https://www.instagram.com/cook.daily/reel/DeoNEDwBZsZ/",
    ]) {
      expect(() => api.importRecipe({ url })).toThrowError(/이미 저장된/);
    }
  });

  it("detects duplicates by video ID, recipe ID or normalized URL", () => {
    for (const url of [
      "https://youtu.be/jeyuk001",
      "https://m.youtube.com/watch?v=jeyuk001&t=30",
      "http://m.10000recipe.com/recipe/6835511/?utm_source=x",
      "https://m.blog.naver.com/cook/doenjang/?utm_medium=share",
    ]) {
      expect(() => api.importRecipe({ url })).toThrowError(/이미 저장된/);
    }
  });

  it("restores a soft-deleted recipe instead of importing it again", () => {
    api.deleteRecipe("r-potato");
    expect(api.listRecipes(null).some((r) => r.id === "r-potato")).toBe(false);
    expect(() => api.getRecipe("r-potato")).toThrowError(/찾을 수 없습니다/);
    const sourceUrl = createSeed().recipes.find((r) => r.id === "r-potato")!.sourceUrl;
    const { recipe, restored } = api.importRecipe({ url: sourceUrl });
    expect(restored).toBe(true);
    expect(recipe).toMatchObject({ id: "r-potato", status: "saved" });
  });

  it("blocks confirmation without ingredients and fills them on revision", () => {
    const state = createSeed();
    state.recipes.find((r) => r.id === "r-review-1")!.ingredients = [];
    resetDb(state);
    expect(() => api.confirmRecipe("r-review-1")).toThrowError(/필수 항목/);

    api.requestRevision("r-review-1", "재료 목록을 다시 확인해 주세요");
    const reviewed = api.listRecipes(null).find((r) => r.id === "r-review-1")!;
    expect(reviewed.status).toBe("needs_review");
    expect(reviewed.ingredients.length).toBeGreaterThan(0);
    expect(api.confirmRecipe("r-review-1").status).toBe("saved");
  });

  it("rejects an empty revision comment for a reviewed recipe without changing it", () => {
    expect(() => api.requestRevision("r-review-1", "  ")).toThrowError(/수정할 내용을 입력해 주세요/);
    expect(api.listRecipes(null).find((r) => r.id === "r-review-1")!.status).toBe("needs_review");
  });

  it("keeps the original URL when collection fails, and retry re-collects it", () => {
    const url = "https://www.10000recipe.com/recipe/7000001?fail-once";
    const { recipe } = api.importRecipe({ url });
    const failed = api.listRecipes(null).find((r) => r.id === recipe.id)!;
    expect(failed).toMatchObject({ status: "failed", sourceUrl: url });
    api.retryRecipe(recipe.id);
    expect(api.listRecipes(null).find((r) => r.id === recipe.id)!.status).toBe("needs_review");
  });
});

describe("side dishes (F-04)", () => {
  it("links and unlinks idempotently without touching other recipes", () => {
    const before = api.listSideDishes("r-doenjang").map((r) => r.id);
    expect(api.linkSideDish("r-jeyuk", "r-cucumber").map((r) => r.id)).toContain("r-cucumber");
    expect(api.linkSideDish("r-jeyuk", "r-cucumber").filter((r) => r.id === "r-cucumber")).toHaveLength(1);
    api.unlinkSideDish("r-jeyuk", "r-cucumber");
    api.unlinkSideDish("r-jeyuk", "r-cucumber");
    expect(api.listSideDishes("r-jeyuk").some((r) => r.id === "r-cucumber")).toBe(false);
    expect(api.listSideDishes("r-doenjang").map((r) => r.id)).toEqual(before);
  });

  it("rejects linking a recipe to itself or to an unsaved recipe", () => {
    expect(() => api.linkSideDish("r-jeyuk", "r-jeyuk")).toThrowError(/자기 자신/);
    expect(() => api.linkSideDish("r-jeyuk", "r-review-1")).toThrowError(/저장된 레시피/);
  });

  it("keeps confirmed meals when the link changes", () => {
    const entry = api.getWeeklyPlan(weekStart).entries.find((e) => e.mainRecipe.id === "r-jeyuk")!;
    api.unlinkSideDish("r-jeyuk", entry.sideRecipes[0]?.id ?? "none");
    expect(api.getWeeklyPlan(weekStart).entries.find((e) => e.id === entry.id)).toEqual(entry);
  });

  it("recommends only saved side/soup recipes, linked ones first", () => {
    const { candidates } = api.recommendSideDishes("r-doenjang", 3);
    expect(candidates.length).toBeLessThanOrEqual(3);
    expect(candidates[0]).toMatchObject({ alreadyLinked: true });
    expect(candidates.every((c) => c.recipe.id !== "r-doenjang")).toBe(true);
  });
});
