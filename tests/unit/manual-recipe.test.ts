import { describe, expect, it } from "vitest";
import {
  buildAmount,
  emptyIngredientRow,
  emptyManualRecipeForm,
  hasManualRecipeInput,
  isValidQuantity,
  mapServerFieldErrors,
  splitSteps,
  toCreateRequest,
  type ManualRecipeForm,
} from "@/features/recipes/manualRecipe";
import type { Unit } from "@/lib/api/contracts";

const UNITS: Unit[] = [
  { code: "g", label: "g", dimension: "mass" },
  { code: "tbsp", label: "큰술", dimension: "volume" },
  { code: "ea", label: "개", dimension: "count" },
  { code: "pinch", label: "약간", dimension: "unmeasured" },
];
const unit = (code: string) => UNITS.find((u) => u.code === code);

describe("splitSteps (RECIPE-001)", () => {
  it("makes one step per line, dropping blank lines and surrounding spaces", () => {
    expect(splitSteps("  양파를 썬다.  \n\n\r\n고기를 볶는다.\r\n   \n간을 한다.")).toEqual(["양파를 썬다.", "고기를 볶는다.", "간을 한다."]);
  });

  it("strips leading numbers like 1. 1) (1) ①", () => {
    expect(splitSteps("1. 썬다\n2)볶는다\n(3) 끓인다\n④ 담는다\n10.마무리")).toEqual(["썬다", "볶는다", "끓인다", "담는다", "마무리"]);
  });

  it("keeps numbers that are part of the step", () => {
    expect(splitSteps("1.5배 물을 붓는다\n2분간 끓인다\n3개를 넣는다")).toEqual(["1.5배 물을 붓는다", "2분간 끓인다", "3개를 넣는다"]);
  });

  it("drops lines that held only a number", () => {
    expect(splitSteps("1.\n2) 볶는다")).toEqual(["볶는다"]);
  });

  it("returns no steps for empty input", () => {
    expect(splitSteps("")).toEqual([]);
    expect(splitSteps(" \n \n")).toEqual([]);
  });
});

describe("buildAmount (RECIPE-001)", () => {
  it("joins the number with the unit label", () => {
    expect(buildAmount("2", unit("tbsp"))).toBe("2큰술");
    expect(buildAmount(" 300 ", unit("g"))).toBe("300g");
    expect(buildAmount("1/2", unit("ea"))).toBe("1/2개");
    expect(buildAmount("2 ~ 3", unit("ea"))).toBe("2~3개");
  });

  it("sends only the label for unmeasured units, ignoring the number", () => {
    expect(buildAmount("", unit("pinch"))).toBe("약간");
    expect(buildAmount("3", unit("pinch"))).toBe("약간");
  });

  it("sends the number alone when no unit is selected", () => {
    expect(buildAmount("2", undefined)).toBe("2");
  });

  it("sends no amount for a measured unit without a number, or for nothing", () => {
    expect(buildAmount("", unit("tbsp"))).toBeUndefined();
    expect(buildAmount("  ", undefined)).toBeUndefined();
  });
});

describe("isValidQuantity", () => {
  it.each(["2", "0.5", "1/2", "1 1/2", "2~3", "2-3"])("accepts %s", (text) => expect(isValidQuantity(text)).toBe(true));
  it.each(["두", "2큰술", "1/", "-1", "abc"])("rejects %s", (text) => expect(isValidQuantity(text)).toBe(false));
});

function form(overrides: Partial<ManualRecipeForm> = {}): ManualRecipeForm {
  return { ...emptyManualRecipeForm(), ...overrides };
}

const row = (name: string, quantity = "", unitCode = "") => ({ ...emptyIngredientRow(), name, quantity, unitCode });

describe("toCreateRequest (RECIPE-001)", () => {
  it("builds POST /recipes from the form", () => {
    const result = toCreateRequest(
      form({
        title: "  마늘 소스 ",
        category: "sauce",
        baseServings: "2",
        cookMinutes: "5",
        ingredients: [row("다진 마늘", "2", "tbsp"), row(""), row("소금", "", "pinch"), row("달걀", "2")],
        steps: "1. 모두 섞는다.\n\n2. 냉장 보관한다.",
        sourceUrl: " https://example.com/garlic ",
      }),
      UNITS,
    );
    expect(result).toEqual({
      ok: true,
      request: {
        title: "마늘 소스",
        category: "sauce",
        baseServings: 2,
        cookMinutes: 5,
        ingredients: [{ name: "다진 마늘", amount: "2큰술" }, { name: "소금", amount: "약간" }, { name: "달걀", amount: "2" }],
        steps: ["모두 섞는다.", "냉장 보관한다."],
        sourceUrl: "https://example.com/garlic",
      },
    });
  });

  it("omits optional fields that were left empty", () => {
    expect(toCreateRequest(form({ title: "김치볶음밥", ingredients: [row("김치")] }), UNITS)).toEqual({
      ok: true,
      request: { title: "김치볶음밥", ingredients: [{ name: "김치" }] },
    });
  });

  it("requires a title and at least one ingredient", () => {
    const result = toCreateRequest(form({ title: "  ", ingredients: [row("")] }), UNITS);
    expect(result).toEqual({
      ok: false,
      errors: { title: "레시피명을 입력해 주세요.", ingredients: "재료를 1개 이상 입력해 주세요." },
    });
  });

  it("flags rows with an amount but no name, and unreadable numbers", () => {
    const nameless = row("", "2", "tbsp");
    const badNumber = row("설탕", "두", "tbsp");
    const result = toCreateRequest(form({ title: "a", ingredients: [nameless, badNumber] }), UNITS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.rows).toEqual({
      [nameless.key]: { name: "재료명을 입력해 주세요." },
      [badNumber.key]: { quantity: "숫자로 입력해 주세요. (예: 2, 0.5, 1/2)" },
    });
    expect(result.errors.ingredients).toBeUndefined();
  });

  it("validates servings, minutes and the reference URL", () => {
    const result = toCreateRequest(
      form({ title: "a", ingredients: [row("b")], baseServings: "0", cookMinutes: "1.5", sourceUrl: "ftp://x" }),
      UNITS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      baseServings: "1~100 사이의 정수로 입력해 주세요.",
      cookMinutes: "0~1440 사이의 정수(분)로 입력해 주세요.",
      sourceUrl: "http 또는 https로 시작하는 URL을 입력해 주세요.",
    });
  });
});

describe("hasManualRecipeInput", () => {
  it("is false for an untouched form and true once anything is typed", () => {
    expect(hasManualRecipeInput(emptyManualRecipeForm())).toBe(false);
    expect(hasManualRecipeInput(form({ steps: "볶는다" }))).toBe(true);
    expect(hasManualRecipeInput(form({ ingredients: [row("", "", "tbsp")] }))).toBe(true);
  });
});

describe("mapServerFieldErrors", () => {
  it("maps known fields, including nested ingredient keys, and keeps the rest as general errors", () => {
    expect(
      mapServerFieldErrors({ title: "레시피명을 입력해 주세요.", "ingredients.0.name": "재료명 오류", imageUrl: "이미지 URL 오류" }),
    ).toEqual({
      errors: { title: "레시피명을 입력해 주세요.", ingredients: "재료명 오류" },
      general: ["이미지 URL 오류"],
    });
  });
});
