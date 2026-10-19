"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { RecipeCard } from "@/components/RecipeCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomActionBar } from "@/components/States";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime, formatDateWithWeekday } from "@/lib/date";
import { formatMinutes, formatServings, recipeTitle } from "@/lib/format";
import { cookHref } from "@/features/meal-plans/DayMealItem";
import { useCompleteMeal, useMealDetail } from "@/features/meal-plans/hooks";
import { RecipeScreenFallback, RecipeView } from "@/features/recipe-view/RecipeView";
import { CookingReviewModal } from "./CookingReviewModal";

interface CookScreenProps {
  entryId: string;
  /** A side recipe of the meal; the main recipe when omitted. */
  recipeId?: string;
}

export function CookScreen({ entryId, recipeId }: CookScreenProps) {
  const toast = useToast();
  const meal = useMealDetail(entryId);
  const complete = useCompleteMeal();
  const [reviewLogId, setReviewLogId] = useState<string | null>(null);

  if (meal.isPending) return <RecipeScreenFallback title="상세 조리" loading />;
  if (meal.isError) {
    return (
      <RecipeScreenFallback
        title="상세 조리"
        error={errorMessage(meal.error)}
        onRetry={() => meal.refetch()}
        retrying={meal.isFetching}
      />
    );
  }

  const { entry, main, sides } = meal.data;
  const isSide = !!recipeId && recipeId !== main.recipe.id;
  const view = isSide ? sides.find((s) => s.recipe.id === recipeId) : main;
  if (!view) return <RecipeScreenFallback title="상세 조리" error="이 식단에 연결된 레시피가 아니에요." />;

  const title = recipeTitle(view.recipe.title);
  // Completion is per meal (shared by main and sides); each recipe gets its own log to review.
  const thisLog = view.previousLogs.find((log) => log.id === view.cookingLogId);
  const canReview = !!entry.completedAt && !!thisLog && thisLog.rating === null && thisLog.memo === null;

  const onComplete = () =>
    complete.mutate(entry.id, {
      onSuccess: ({ cookingLogs }) => {
        toast.show({ type: "success", message: "요리 완료로 기록했어요." });
        const log = cookingLogs.find((l) => l.recipeId === view.recipe.id);
        if (log) setReviewLogId(log.cookingLogId);
      },
      onError: (err) => toast.show({ type: "error", message: `완료 상태를 저장하지 못했어요. ${errorMessage(err)}` }),
    });

  return (
    <>
      <ScreenHeader title={title} eyebrow={formatDateWithWeekday(entry.date)} back />
      <RecipeView
        recipe={view.recipe}
        meta={
          <>
            <span className="text-body-md text-body">계획 {formatServings(entry.servings)}</span>
            {isSide && <span className="text-caption text-muted">곁들임</span>}
          </>
        }
        steps={view.steps}
        substituteNotes={view.substituteNotes}
        sourceUrl={view.sourceUrl}
        logs={view.previousLogs}
        ingredientsCaption={`${formatServings(entry.servings)} 기준 필요량`}
        ingredients={view.ingredients}
      >
        {!isSide && sides.length > 0 && (
          <section aria-labelledby="sides-title">
            <h3 id="sides-title" className="mb-2 text-heading-sm text-ink">
              곁들임 레시피
            </h3>
            <ul className="flex flex-col gap-2">
              {sides.map((side) => (
                <li key={side.recipe.id} className="rounded-md border border-hairline p-3">
                  <RecipeCard recipe={side.recipe} href={cookHref(entry.id, side.recipe.id)} meta={formatMinutes(side.recipe.cookMinutes)} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {isSide && (
          <section className="rounded-md border border-hairline p-3">
            <p className="mb-2 text-caption text-muted">메인 레시피</p>
            <RecipeCard recipe={main.recipe} href={cookHref(entry.id)} meta={formatMinutes(main.recipe.cookMinutes)} />
          </section>
        )}
      </RecipeView>

      <BottomActionBar>
        {entry.completedAt ? (
          <div className="flex items-center gap-2">
            <p className="flex flex-1 items-center gap-2 text-body-md text-success">
              <CheckCircle2 className="size-5" aria-hidden />
              요리 완료 · {formatDateTime(entry.completedAt)}
            </p>
            {canReview && (
              <Button variant="secondary" size="sm" onClick={() => setReviewLogId(view.cookingLogId)}>
                평가 남기기
              </Button>
            )}
          </div>
        ) : (
          <Button size="lg" onClick={onComplete} loading={complete.isPending}>
            요리 완료
          </Button>
        )}
      </BottomActionBar>

      <CookingReviewModal logId={reviewLogId} recipeName={title} onClose={() => setReviewLogId(null)} />
    </>
  );
}
