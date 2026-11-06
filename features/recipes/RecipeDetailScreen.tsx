"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { RecipeCard } from "@/components/RecipeCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { errorMessage } from "@/lib/api/client";
import { formatMinutes, formatServings, recipeTitle } from "@/lib/format";
import { RecipeScreenFallback, RecipeView } from "@/features/recipe-view/RecipeView";
import { useRecipe, useSideDishes } from "./hooks";
import { CATEGORY_LABELS } from "./labels";
import { SideDishModal } from "./SideDishModal";

export const recipeHref = (recipeId: string) => `/recipes/${encodeURIComponent(recipeId)}`;

/** Saved recipe detail opened from the recipe list (no meal context, so no `요리 완료`). */
export function RecipeDetailScreen({ recipeId }: { recipeId: string }) {
  const recipe = useRecipe(recipeId);

  if (recipe.isPending) return <RecipeScreenFallback title="레시피 상세" loading />;
  if (recipe.isError) {
    return (
      <RecipeScreenFallback
        title="레시피 상세"
        error={errorMessage(recipe.error)}
        onRetry={() => recipe.refetch()}
        retrying={recipe.isFetching}
      />
    );
  }

  const data = recipe.data;
  return (
    <>
      <ScreenHeader title={recipeTitle(data.title)} back />
      <RecipeView
        recipe={data}
        meta={
          <>
            <span className="text-body-md text-body">기준 {formatServings(data.baseServings)}</span>
            {data.category && <span className="text-caption text-muted">{CATEGORY_LABELS[data.category]}</span>}
          </>
        }
        steps={data.steps}
        sourceUrl={data.sourceUrl}
        logs={data.cookingLogs}
        ingredientsCaption={`${formatServings(data.baseServings)} 기준 필요량`}
        ingredients={data.ingredients}
      >
        <SideDishSection recipeId={data.id} />
      </RecipeView>
    </>
  );
}

/** User-linked side dishes (F-04): list, open their detail, and edit the links in a modal. */
function SideDishSection({ recipeId }: { recipeId: string }) {
  const sides = useSideDishes(recipeId);
  const [editing, setEditing] = useState(false);

  return (
    <section aria-labelledby="sides-title">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id="sides-title" className="text-heading-sm text-ink">
          곁들임 레시피
        </h3>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={!sides.isSuccess}>
          곁들임 레시피 연결
        </Button>
      </div>
      {sides.isPending ? (
        <p className="text-body-md text-muted">곁들임 레시피를 불러오는 중이에요.</p>
      ) : sides.isError ? (
        <div role="alert" className="flex items-center gap-2 text-body-md text-error">
          <span className="flex-1">곁들임 레시피를 불러오지 못했어요. {errorMessage(sides.error)}</span>
          <Button variant="ghost" size="sm" onClick={() => sides.refetch()} loading={sides.isFetching}>
            다시 시도
          </Button>
        </div>
      ) : sides.data.length === 0 ? (
        <p className="text-body-md text-muted">연결된 곁들임 레시피가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sides.data.map((side) => (
            <li key={side.id} className="rounded-md border border-hairline p-3">
              <RecipeCard recipe={side} href={recipeHref(side.id)} meta={formatMinutes(side.cookMinutes)} />
            </li>
          ))}
        </ul>
      )}
      <SideDishModal recipeId={recipeId} linked={editing && sides.isSuccess ? sides.data : null} onClose={() => setEditing(false)} />
    </section>
  );
}
