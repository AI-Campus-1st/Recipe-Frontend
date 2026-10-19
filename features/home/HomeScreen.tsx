"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { Accordion } from "@/components/Accordion";
import { Button } from "@/components/Button";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { InternalLink } from "@/components/Link";
import { RecipeCard } from "@/components/RecipeCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomActionBar, EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { errorMessage } from "@/lib/api/client";
import type { MealDetail } from "@/lib/api/contracts";
import { formatFullDate, formatTime, todayISO } from "@/lib/date";
import { formatMinutes, formatServings } from "@/lib/format";
import { IngredientList } from "@/features/recipe-view/IngredientList";
import { cookHref } from "@/features/meal-plans/DayMealItem";
import { useTodayMeal } from "@/features/meal-plans/hooks";
import { AddRecipeModal } from "@/features/recipes/AddRecipeModal";

export function HomeScreen() {
  const today = useTodayMeal();
  const [addOpen, setAddOpen] = useState(false);
  const meal = today.data?.meal ?? null;

  return (
    <>
      <ScreenHeader title={formatFullDate(today.data?.date ?? todayISO())} />
      <div className="page-x flex flex-col gap-6 pt-4">
        {today.isPending ? (
          <LoadingState label="오늘의 메뉴를 불러오는 중" />
        ) : today.isError ? (
          <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} retrying={today.isFetching} />
        ) : meal ? (
          <TodayMeal meal={meal} />
        ) : (
          <EmptyState
            title="오늘 확정된 메뉴가 없습니다."
            description={today.data.hasSavedRecipes ? "주간 식단에서 오늘 식단을 만들어 보세요." : "먼저 레시피를 등록하면 식단을 만들 수 있어요."}
            action={
              <>
                {!today.data.hasSavedRecipes && <Button onClick={() => setAddOpen(true)}>레시피 추가</Button>}
                <InternalLink href="/weekly?create=today" variant={today.data.hasSavedRecipes ? "primary" : "secondary"}>
                  식단 만들기
                </InternalLink>
                <InternalLink href="/weekly" variant="secondary">
                  주간 식단 보기
                </InternalLink>
              </>
            }
          />
        )}
      </div>

      {meal && (
        <BottomActionBar>
          <InternalLink href={cookHref(meal.entry.id)} variant="primary" size="lg">
            조리 시작
          </InternalLink>
        </BottomActionBar>
      )}
      <FloatingActionButton label="레시피 추가" onClick={() => setAddOpen(true)} raised={!!meal} />
      <AddRecipeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function TodayMeal({ meal }: { meal: MealDetail }) {
  const { entry, main, sides } = meal;
  return (
    <>
      <section aria-labelledby="today-title" className="rounded-lg border border-hairline bg-canvas p-4">
        <h2 id="today-title" className="mb-3 text-label text-muted">
          오늘의 레시피
        </h2>
        <RecipeCard
          layout="hero"
          recipe={main.recipe}
          href={cookHref(entry.id)}
          meta={<StatusBadge tone="neutral">{formatMinutes(main.recipe.cookMinutes)}</StatusBadge>}
        />
        <Accordion
          className="mt-3 border-t border-hairline"
          header={<span className="text-body-md font-semibold text-ink">재료 정보</span>}
          bodyClassName="pb-1"
        >
          <p className="mb-1 text-caption text-muted">계획 인분 {formatServings(entry.servings)}</p>
          <IngredientList ingredients={main.ingredients} />
        </Accordion>
        <p className="mt-2 flex items-center gap-2 border-t border-hairline pt-3 text-body-md" aria-label="요리 완료 상태">
          {entry.completedAt ? (
            <>
              <CheckCircle2 className="size-5 text-success" aria-hidden />
              <span className="text-success">요리 완료</span>
              <span className="text-muted">{formatTime(entry.completedAt)}</span>
            </>
          ) : (
            <>
              <Circle className="size-5 text-border-strong" aria-hidden />
              <span className="text-body">아직 요리 전이에요</span>
            </>
          )}
        </p>
      </section>

      {sides.length > 0 && (
        <section aria-labelledby="sides-title">
          <h2 id="sides-title" className="mb-2 text-heading-sm text-ink">
            곁들임 레시피
          </h2>
          <ul className="flex flex-col gap-2">
            {sides.map((side) => (
              <li key={side.recipe.id} className="rounded-md border border-hairline bg-canvas p-3">
                <RecipeCard recipe={side.recipe} href={cookHref(entry.id, side.recipe.id)} meta={formatMinutes(side.recipe.cookMinutes)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
