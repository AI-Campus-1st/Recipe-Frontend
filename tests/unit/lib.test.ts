import { describe, expect, it } from "vitest";
import { filterRecipesByName } from "@/features/recipes/search";
import type { Recipe } from "@/lib/api/contracts";
import { buildCoupangSearchUrl } from "@/lib/coupang";
import { addDays, defaultCookMinutes, startOfWeek, weeksOfMonth } from "@/lib/date";
import { formatQuantity } from "@/lib/format";
import { scaleQuantity } from "@/services/scaling";
import { aggregateShoppingItems, carryOverChecked, mergeAmounts, normalizeIngredientName } from "@/services/shopping";

describe("buildCoupangSearchUrl (F-07)", () => {
  it("URL-encodes Korean and spaces", () => {
    expect(buildCoupangSearchUrl("돼지고기 앞다리살")).toBe(
      "https://www.coupang.com/np/search?q=%EB%8F%BC%EC%A7%80%EA%B3%A0%EA%B8%B0%20%EC%95%9E%EB%8B%A4%EB%A6%AC%EC%82%B4",
    );
  });

  it("encodes special characters and trims whitespace", () => {
    expect(buildCoupangSearchUrl("  a&b=c  ")).toBe("https://www.coupang.com/np/search?q=a%26b%3Dc");
  });
});

describe("date policy", () => {
  it("uses 30 minutes on weekdays and 70 on weekends", () => {
    expect(defaultCookMinutes("2026-10-15")).toBe(30); // Thursday
    expect(defaultCookMinutes("2026-10-17")).toBe(70); // Saturday
    expect(defaultCookMinutes("2026-10-18")).toBe(70); // Sunday
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-15")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("includes every Monday-start week that overlaps the month", () => {
    expect(weeksOfMonth("2026-10")).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(weeksOfMonth("2026-11")[0]).toBe("2026-10-26");
  });
});

describe("scaleQuantity (F-05)", () => {
  it("applies planned ÷ base servings", () => {
    expect(scaleQuantity(400, 2, 3)).toBe(600);
    expect(scaleQuantity(1, 3, 1)).toBe(0.33);
  });

  it("never estimates unknown values", () => {
    expect(scaleQuantity(null, 2, 1)).toBeNull();
    expect(scaleQuantity(100, null, 1)).toBeNull();
  });
});

describe("shopping aggregation (F-05)", () => {
  it("merges compatible units only and keeps unknown quantities separate", () => {
    expect(
      mergeAmounts([
        { quantity: 500, unit: "g" },
        { quantity: 0.7, unit: "kg" },
        { quantity: 2, unit: "개" },
        { quantity: null, unit: "g" },
      ]),
    ).toEqual([
      { quantity: 1.2, unit: "kg" },
      { quantity: 2, unit: "개" },
      { quantity: null, unit: "g" },
    ]);
  });

  it("groups by normalized name and preserves per-recipe sources", () => {
    const base = { entryId: "e1", date: "2026-10-12", recipeTitle: "A", unit: "대" };
    const items = aggregateShoppingItems([
      { ...base, targetIngredientId: "ing-1", targetName: "대파", recipeId: "r1", originalName: "대파", quantity: 1 },
      { ...base, targetIngredientId: "ing-1", targetName: " 대 파 ", recipeId: "r2", originalName: "대 파", quantity: 0.5 },
      { ...base, targetIngredientId: "ing-2", targetName: "다진 대파", recipeId: "r2", originalName: "다진 대파", quantity: 1 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("ing-1");
    expect(items[0].amounts).toEqual([{ quantity: 1.5, unit: "대" }]);
    expect(items[0].sources.map((s) => s.recipeId)).toEqual(["r1", "r2"]);
    expect(normalizeIngredientName(" 대 파 ")).toBe("대파");
  });

  it("keeps checked state only for items still needed", () => {
    expect([...carryOverChecked(new Set(["a", "b"]), ["b", "c"])]).toEqual(["b"]);
  });

  it("formats unknown quantities as 미확인", () => {
    expect(formatQuantity(null, null)).toBe("미확인");
    expect(formatQuantity(1.5, "대")).toBe("1.5대");
  });
});

describe("filterRecipesByName", () => {
  const recipe = (id: string, title: string | null) => ({ id, title }) as Recipe;
  const recipes = [recipe("a", "김치볶음밥"), recipe("b", "크림 파스타"), recipe("c", null), recipe("d", "Tomato Soup")];

  it("keeps every recipe for an empty query", () => {
    expect(filterRecipesByName(recipes, "  ")).toHaveLength(4);
  });

  it("matches a part of the name, ignoring spaces and case", () => {
    expect(filterRecipesByName(recipes, "김치 볶음").map((r) => r.id)).toEqual(["a"]);
    expect(filterRecipesByName(recipes, "크림파스타").map((r) => r.id)).toEqual(["b"]);
    expect(filterRecipesByName(recipes, "tomato").map((r) => r.id)).toEqual(["d"]);
  });

  it("excludes recipes without a confirmed name while searching", () => {
    expect(filterRecipesByName(recipes, "레시피")).toEqual([]);
  });
});
