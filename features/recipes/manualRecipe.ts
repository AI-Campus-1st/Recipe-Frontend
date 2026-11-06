import type { RecipeCategory, RecipeCreateRequest, RecipeIngredientInput, Unit } from "@/lib/api/contracts";

/** Manual recipe input (RECIPE-001): pure helpers behind `ManualRecipeModal`. */

/* ---------- Steps: one line = one step ---------- */

/**
 * Leading step numbers removed before saving: `1.` `1)` `(1)` and circled numbers `①`–`⑳` / `❶`–`❿`.
 * `1.5배` is not a number prefix (a digit follows the dot), so it stays.
 */
const STEP_NUMBER = /^(?:\(\s*\d+\s*\)|\d+\s*\)|\d+\s*\.(?!\d)|[①-⑳❶-❿])\s*/;

export function splitSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(STEP_NUMBER, "").trim())
    .filter((line) => line.length > 0);
}

/* ---------- Ingredient amount: number + unit ---------- */

/** Accepted quantity text: `2`, `1.5`, `1/2`, `1 1/2`, `2~3`, `2-3` (the server parses these, `UNIT_CONVERSION.md` §3.2). */
const QUANTITY = /^(?:\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\.\d+)?\s*[~-]\s*\d+(?:\.\d+)?)$/;

export function isValidQuantity(text: string): boolean {
  return QUANTITY.test(text.trim());
}

export const isUnmeasured = (unit: Unit | undefined) => unit?.dimension === "unmeasured";

/**
 * Raw `amount` text sent for one ingredient row.
 * - number + unit → `"2큰술"` (unit label; the server resolves it as an alias)
 * - unmeasured unit (약간·적당량) → the label alone; the number is ignored
 * - number only → `"2"` (count without a unit, e.g. eggs)
 * - unit only, or nothing → no amount (quantity stays 미확인)
 */
export function buildAmount(quantity: string, unit: Unit | undefined): string | undefined {
  if (unit && isUnmeasured(unit)) return unit.label;
  const number = quantity.trim().replace(/\s*([~-])\s*/, "$1");
  if (!number) return undefined;
  return unit ? `${number}${unit.label}` : number;
}

/* ---------- Form → request ---------- */

export interface IngredientRow {
  /** Stable React key; not sent. */
  key: string;
  name: string;
  quantity: string;
  /** `Unit.code`, or "" when no unit is selected. */
  unitCode: string;
}

export interface ManualRecipeForm {
  title: string;
  category: RecipeCategory | "";
  baseServings: string;
  cookMinutes: string;
  ingredients: IngredientRow[];
  steps: string;
  sourceUrl: string;
}

export interface ManualRecipeErrors {
  title?: string;
  category?: string;
  baseServings?: string;
  cookMinutes?: string;
  /** Whole-list error, e.g. no ingredient at all. */
  ingredients?: string;
  /** Per-row errors keyed by `IngredientRow.key`. */
  rows?: Record<string, { name?: string; quantity?: string }>;
  steps?: string;
  sourceUrl?: string;
}

let rowSeq = 0;
export function emptyIngredientRow(): IngredientRow {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, name: "", quantity: "", unitCode: "" };
}

export function emptyManualRecipeForm(): ManualRecipeForm {
  return { title: "", category: "", baseServings: "", cookMinutes: "", ingredients: [emptyIngredientRow()], steps: "", sourceUrl: "" };
}

const isBlankRow = (row: IngredientRow) => !row.name.trim() && !row.quantity.trim() && !row.unitCode;

/** True when closing would throw away something the user typed. */
export function hasManualRecipeInput(form: ManualRecipeForm): boolean {
  return (
    !!form.title.trim() ||
    !!form.category ||
    !!form.baseServings.trim() ||
    !!form.cookMinutes.trim() ||
    !!form.steps.trim() ||
    !!form.sourceUrl.trim() ||
    form.ingredients.some((row) => !isBlankRow(row))
  );
}

function parseInteger(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

function isHttpUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type ManualRecipeResult = { ok: true; request: RecipeCreateRequest } | { ok: false; errors: ManualRecipeErrors };

/**
 * Validates the form (supplementary to the server's 422) and builds `POST /recipes`.
 * Completely empty ingredient rows are ignored; at least one named ingredient is required.
 */
export function toCreateRequest(form: ManualRecipeForm, units: Unit[]): ManualRecipeResult {
  const errors: ManualRecipeErrors = {};
  const rows: NonNullable<ManualRecipeErrors["rows"]> = {};
  const unitByCode = new Map(units.map((unit) => [unit.code, unit]));

  const title = form.title.trim();
  if (!title) errors.title = "레시피명을 입력해 주세요.";

  const servingsText = form.baseServings.trim();
  const baseServings = servingsText ? parseInteger(servingsText, 1, 100) : null;
  if (servingsText && baseServings === null) errors.baseServings = "1~100 사이의 정수로 입력해 주세요.";

  const minutesText = form.cookMinutes.trim();
  const cookMinutes = minutesText ? parseInteger(minutesText, 0, 1440) : null;
  if (minutesText && cookMinutes === null) errors.cookMinutes = "0~1440 사이의 정수(분)로 입력해 주세요.";

  const ingredients: RecipeIngredientInput[] = [];
  for (const row of form.ingredients) {
    if (isBlankRow(row)) continue;
    const name = row.name.trim();
    const unit = row.unitCode ? unitByCode.get(row.unitCode) : undefined;
    const rowError: { name?: string; quantity?: string } = {};
    if (!name) rowError.name = "재료명을 입력해 주세요.";
    if (!isUnmeasured(unit) && row.quantity.trim() && !isValidQuantity(row.quantity)) {
      rowError.quantity = "숫자로 입력해 주세요. (예: 2, 0.5, 1/2)";
    }
    if (rowError.name || rowError.quantity) {
      rows[row.key] = rowError;
      continue;
    }
    const amount = buildAmount(row.quantity, unit);
    ingredients.push(amount ? { name, amount } : { name });
  }
  if (Object.keys(rows).length > 0) errors.rows = rows;
  else if (ingredients.length === 0) errors.ingredients = "재료를 1개 이상 입력해 주세요.";

  const sourceUrl = form.sourceUrl.trim();
  if (sourceUrl && !isHttpUrl(sourceUrl)) errors.sourceUrl = "http 또는 https로 시작하는 URL을 입력해 주세요.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const request: RecipeCreateRequest = { title, ingredients };
  if (form.category) request.category = form.category;
  if (baseServings !== null) request.baseServings = baseServings;
  if (cookMinutes !== null) request.cookMinutes = cookMinutes;
  const steps = splitSteps(form.steps);
  if (steps.length > 0) request.steps = steps;
  if (sourceUrl) request.sourceUrl = sourceUrl;
  return { ok: true, request };
}

/** Maps a 422 `fieldErrors` (§2.8) onto the form fields; unknown keys fall back to `general`. */
export function mapServerFieldErrors(fieldErrors: Record<string, string>): { errors: ManualRecipeErrors; general: string[] } {
  const errors: ManualRecipeErrors = {};
  const general: string[] = [];
  const known = ["title", "category", "baseServings", "cookMinutes", "ingredients", "steps", "sourceUrl"] as const;
  for (const [key, message] of Object.entries(fieldErrors)) {
    const field = known.find((name) => key === name || key.startsWith(`${name}.`) || key.startsWith(`${name}[`));
    if (field) errors[field] = errors[field] ?? message;
    else general.push(message);
  }
  return { errors, general };
}
