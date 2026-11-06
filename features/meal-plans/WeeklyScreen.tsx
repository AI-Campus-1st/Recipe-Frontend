"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { WeeklyStatus } from "@/components/WeeklyStatus";
import { errorMessage } from "@/lib/api/client";
import type { ISODate, MealPlanEntry } from "@/lib/api/contracts";
import { todayISO, weekDates } from "@/lib/date";
import { ClearDayMealModal, UncompleteMealModal } from "./DayMealConfirmModals";
import { DayMealItem } from "./DayMealItem";
import { DayMealModal, type DayMealTarget } from "./DayMealModal";
import { GenerateMealPlanModal } from "./GenerateMealPlanModal";
import { useIsGenerating, useMonthSummary, useWeeklyPlan } from "./hooks";
import { useWeekNavigation } from "./useWeekNavigation";

interface WeeklyScreenProps {
  /** Open the generation modal with only today selected (entry from Home `식단 만들기`). */
  openGenerateForToday?: boolean;
}

export function WeeklyScreen({ openGenerateForToday = false }: WeeklyScreenProps) {
  const nav = useWeekNavigation();
  const plan = useWeeklyPlan(nav.weekStart);
  const monthSummary = useMonthSummary(nav.month);
  const generating = useIsGenerating();
  /** undefined = closed, null = default selection, array = only these dates. */
  const [generateDates, setGenerateDates] = useState<ISODate[] | null | undefined>(() =>
    openGenerateForToday ? [todayISO()] : undefined,
  );
  const [dayMealTarget, setDayMealTarget] = useState<DayMealTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MealPlanEntry | null>(null);
  const [uncompleteTarget, setUncompleteTarget] = useState<MealPlanEntry | null>(null);
  const openDayMeal = () => setDayMealTarget({ mode: "choose" });

  const entries = plan.data?.entries ?? [];
  const plannedDates = entries.map((e) => e.date);
  const dates = weekDates(nav.weekStart);
  const unassignedCount = plan.data ? plan.data.generation.failedDates.length : 0;

  return (
    <>
      <ScreenHeader title="주간 식단" />
      <div className="page-x flex flex-col gap-4 pt-4">
        <WeeklyStatus
          weekStart={nav.weekStart}
          status={plan.data?.generation.status ?? "none"}
          generating={generating}
          unassignedCount={unassignedCount}
          month={nav.month}
          monthWeeks={monthSummary.data?.weeks}
          onSelectWeek={nav.selectWeek}
          onChangeMonth={nav.changeMonth}
        />

        {plan.isPending ? (
          <LoadingState label="주간 식단을 불러오는 중" />
        ) : plan.isError ? (
          <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} retrying={plan.isFetching} />
        ) : entries.length === 0 ? (
          <EmptyState
            title="이번 주 식단이 없어요"
            description="요리할 날짜를 고르면 저장한 레시피로 식단을 만들어 드려요."
            action={
              <>
                <Button onClick={() => setGenerateDates(null)}>주간 식단 생성</Button>
                <Button variant="secondary" onClick={openDayMeal}>
                  하루 식단 생성
                </Button>
              </>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Button size="lg" onClick={() => setGenerateDates(null)}>
                주간 식단 생성
              </Button>
              <Button size="lg" variant="secondary" onClick={openDayMeal}>
                하루 식단 생성
              </Button>
            </div>
            <ul className="flex flex-col gap-2" aria-label="날짜별 식단">
              {dates.map((date) => (
                <DayMealItem
                  key={date}
                  date={date}
                  entry={entries.find((e) => e.date === date)}
                  onRecommend={(d) => setGenerateDates([d])}
                  onCreate={(d) => setDayMealTarget({ mode: "fixed", date: d })}
                  onEdit={(entry) => setDayMealTarget({ mode: "fixed", date: entry.date, entry })}
                  onDelete={setDeleteTarget}
                  onUncomplete={setUncompleteTarget}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <GenerateMealPlanModal
        open={generateDates !== undefined}
        onClose={() => setGenerateDates(undefined)}
        weekStart={nav.weekStart}
        plannedDates={plannedDates}
        initialDates={generateDates ?? undefined}
      />
      <DayMealModal target={dayMealTarget} onClose={() => setDayMealTarget(null)} />
      <ClearDayMealModal entry={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <UncompleteMealModal entry={uncompleteTarget} onClose={() => setUncompleteTarget(null)} />
    </>
  );
}
