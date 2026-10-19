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
  onChange: (entry: MealPlanEntry) => void;
  onCreate: (date: ISODate) => void;
}

export function DayMealItem({ date, entry, onChange, onCreate }: DayMealItemProps) {
  const isToday = date === todayISO();
  const dateLabel = (
    <span className="flex items-center gap-2">
      <span className={cn("text-body-md font-semibold", entry ? "text-ink" : "text-muted")}>{formatDateWithWeekday(date)}</span>
      {isToday && <span className="text-caption text-secondary">오늘</span>}
      {!entry && <span className="text-caption text-muted">식단 없음</span>}
    </span>
  );

  if (!entry) {
    return (
      <li className="rounded-md border border-hairline bg-surface-soft px-4">
        <Accordion compact header={dateLabel} bodyClassName="pb-3">
          <Button size="sm" variant="secondary" className="w-full" onClick={() => onCreate(date)}>
            식단 생성
          </Button>
        </Accordion>
      </li>
    );
  }

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
                {entry.completedAt && <StatusBadge tone="success">요리 완료</StatusBadge>}
              </>
            }
          />
        }
        bodyClassName="mt-3 flex flex-col gap-3"
      >
        <p className="text-body-md text-body">
          {formatServings(entry.servings)} · 조리 시간 기준 {entry.cookMinutesLimit}분
        </p>
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
        <Button size="sm" variant="secondary" onClick={() => onChange(entry)}>
          식단 변경
        </Button>
      </Accordion>
    </li>
  );
}
