import type { RecipeIngredient } from "@/lib/api/contracts";
import { formatQuantity } from "@/lib/format";

type IngredientRow = Omit<RecipeIngredient, "ingredientId"> & { substitutedFrom?: string | null };

export function IngredientList({ ingredients }: { ingredients: IngredientRow[] }) {
  if (ingredients.length === 0) return <p className="text-body-md text-muted">등록된 재료가 없어요.</p>;
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {ingredients.map((ingredient) => (
        <li key={ingredient.id} className="flex items-baseline justify-between gap-3 py-2 text-body-md">
          <span className="text-ink">
            {ingredient.name}
            {ingredient.substitutedFrom && (
              <span className="ml-1 text-caption text-muted">({ingredient.substitutedFrom} 대체)</span>
            )}
          </span>
          <span className={ingredient.quantity === null ? "shrink-0 text-warning" : "shrink-0 text-body"}>
            {formatQuantity(ingredient.quantity, ingredient.unit)}
          </span>
        </li>
      ))}
    </ul>
  );
}
