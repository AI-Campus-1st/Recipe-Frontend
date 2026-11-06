"use client";

import NextLink from "next/link";
import { Accordion } from "@/components/Accordion";
import { Button } from "@/components/Button";
import { RecipeCard } from "@/components/RecipeCard";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/cn";
import type { ISODate, MealPlanEntry } from "@/lib/api/contracts";
import { formatDateWithWeekday, todayISO } from "@/lib/date";
import { formatMinutes, formatServings, recipeTitle } from "@/lib/format";

export const cookHref = (entryId: string, recipeId?: string) =>
  recipeId ? `/cook/${encodeURIComponent(entryId)}?recipe=${encodeURIComponent(recipeId)}` : `/cook/${encodeURIComponent(entryId)}`;

interface DayMealItemProps {
  date: ISODate;
  entry: MealPlanEntry | undefined;
  /** `AI 추천` — AI generation for this date. */
  onRecommend: (date: ISODate) => void;
  /** `직접 생성` — day meal modal with this date fixed. */
  onCreate: (date: ISODate) => void;
  onEdit: (entry: MealPlanEntry) => void;
  onDelete: (entry: MealPlanEntry) => void;
  onUncomplete: (entry: MealPlanEntry) => void;
}

/**
 * Button rules (MEAL-001): past dates can't change (no buttons for empty days, disabled for meals);
 * today and later: empty → `AI 추천`·`직접 생성`, meal → `수정`·`삭제`, completed → `완료 취소` first.
 */
export function DayMealItem({ date, entry, onRecommend, onCreate, onEdit, onDelete, onUncomplete }: DayMealItemProps) {
  const today = todayISO();
  const isToday = date === today;
  const isPast = date < today;
  const dateLabel = (
    <span className="flex items-center gap-2">
      <span className={cn("text-body-md font-semibold", entry ? "text-ink" : "text-muted")}>{formatDateWithWeekday(date)}</span>
      {isToday && <span className="text-caption text-secondary">오늘</span>}
      {!entry && <span className="text-caption text-muted">식단 없음</span>}
    </span>
  );

  if (!entry) {
    // The server rejects meals for past dates, so a past empty day has nothing to open.
    if (isPast) {
      return <li className="flex min-h-11 items-center rounded-md border border-hairline bg-surface-soft px-4">{dateLabel}</li>;
    }
    return (
      <li className="rounded-md border border-hairline bg-surface-soft px-4">
        <Accordion compact header={dateLabel} bodyClassName="flex gap-2 pb-3">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => onRecommend(date)}>
            AI 추천
          </Button>
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => onCreate(date)}>
            직접 생성
          </Button>
        </Accordion>
      </li>
    );
  }

  const completed = !!entry.completedAt;
  const locked = isPast || completed;
  const lockedHint = isPast ? "지난 날짜의 식단은 바꿀 수 없어요." : completed ? "완료 취소 후 수정할 수 있어요." : null;

  return (
    <li className="rounded-md border border-hairline bg-canvas px-4 pb-4">
      <Accordion
        header={dateLabel}
        summary={
          <RecipeCard
            recipe={entry.mainRecipe}
            href={cookHref(entry.id)}
            meta={
              <>
                <span>{formatMinutes(entry.mainRecipe.cookMinutes)}</span>
                {completed && <StatusBadge tone="success">요리 완료</StatusBadge>}
              </>
            }
          />
        }
        bodyClassName="mt-3 flex flex-col gap-3"
      >
        <p className="text-body-md text-body">{formatServings(entry.servings)}</p>
        {entry.sideRecipes.length > 0 && (
          <Accordion
            compact
            className="rounded-sm bg-surface-soft px-3"
            header={<span className="text-label text-body">곁들임 {entry.sideRecipes.length}개</span>}
            bodyClassName="pb-2"
          >
            <ul className="flex flex-col">
              {entry.sideRecipes.map((side) => (
                <li key={side.id}>
                  <NextLink href={cookHref(entry.id, side.id)} className="flex min-h-11 items-center text-body-md text-ink underline-offset-2 hover:underline">
                    {recipeTitle(side.title)}
                  </NextLink>
                </li>
              ))}
            </ul>
          </Accordion>
        )}
        {completed && !isPast && (
          <Button size="sm" variant="secondary" onClick={() => onUncomplete(entry)}>
            완료 취소
          </Button>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="flex-1" disabled={locked} onClick={() => onEdit(entry)}>
            수정
          </Button>
          <Button size="sm" variant="destructive" className="flex-1" disabled={locked} onClick={() => onDelete(entry)}>
            삭제
          </Button>
        </div>
        {lockedHint && <p className="text-caption text-muted">{lockedHint}</p>}
      </Accordion>
    </li>
  );
}
