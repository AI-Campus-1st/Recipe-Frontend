export const UNKNOWN_LABEL = "미확인";

export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return unit ? `${UNKNOWN_LABEL} (${unit})` : UNKNOWN_LABEL;
  const rounded = Math.round(quantity * 100) / 100;
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

export function formatMinutes(minutes: number | null): string {
  return minutes === null ? `조리 시간 ${UNKNOWN_LABEL}` : `${minutes}분`;
}

export function formatServings(servings: number | null): string {
  return servings === null ? `인분 ${UNKNOWN_LABEL}` : `${servings}인분`;
}

export function recipeTitle(title: string | null): string {
  return title ?? "이름 미확인 레시피";
}
