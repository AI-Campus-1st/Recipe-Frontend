"use client";

import { useState } from "react";
import { InternalLink } from "@/components/Link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/Toast";
import { WeeklyStatus } from "@/components/WeeklyStatus";
import { errorMessage } from "@/lib/api/client";
import type { ShoppingItem } from "@/lib/api/contracts";
import { useIsGenerating, useMonthSummary, useWeeklyPlan } from "@/features/meal-plans/hooks";
import { useWeekNavigation } from "@/features/meal-plans/useWeekNavigation";
import { useSetItemChecked, useShoppingList } from "./hooks";
import { ShoppingItemRow } from "./ShoppingItemRow";
import { SubstituteModal } from "./SubstituteModal";

export function ShoppingScreen() {
  const toast = useToast();
  const nav = useWeekNavigation();
  const plan = useWeeklyPlan(nav.weekStart);
  const monthSummary = useMonthSummary(nav.month);
  const generating = useIsGenerating();
  const list = useShoppingList(nav.weekStart);
  const setChecked = useSetItemChecked(nav.weekStart);
  const [substituteItem, setSubstituteItem] = useState<ShoppingItem | null>(null);

  const onToggle = (item: ShoppingItem, checked: boolean) =>
    setChecked.mutate(
      { itemId: item.id, checked },
      { onError: (err) => toast.show({ type: "error", message: `준비 여부를 저장하지 못했어요. ${errorMessage(err)}` }) },
    );

  const noMeals = list.data ? !list.data.hasConfirmedMeals : false;
  const preparedCount = list.data ? list.data.items.length - list.data.neededCount : 0;

  return (
    <>
      <ScreenHeader title="장보기" />
      <div className="page-x flex flex-col gap-4 pt-4">
        <WeeklyStatus
          weekStart={nav.weekStart}
          status={plan.data?.generation.status ?? "none"}
          generating={generating}
          unassignedCount={plan.data?.generation.failedDates.length ?? 0}
          month={nav.month}
          monthWeeks={monthSummary.data?.weeks}
          onSelectWeek={nav.selectWeek}
          onChangeMonth={nav.changeMonth}
          notice={noMeals ? "이 주에는 확정된 식단이 없어 장보기 목록이 아직 생성되지 않았어요." : undefined}
        />

        {list.isPending ? (
          <LoadingState label="장보기 목록을 불러오는 중" />
        ) : list.isError ? (
          <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} retrying={list.isFetching} />
        ) : noMeals ? (
          <EmptyState
            title="장보기 목록이 아직 없어요"
            description="식단을 확정하면 필요한 재료로 장보기 목록이 생성돼요."
            action={
              <InternalLink href="/weekly" variant="primary">
                주간 식단 보기
              </InternalLink>
            }
          />
        ) : (
          <>
            <section aria-label="장보기 요약" className="flex items-baseline justify-between rounded-md bg-primary-soft px-4 py-3">
              <p className="text-body-md text-ink">
                필요한 재료 <strong className="text-heading-sm">{list.data.neededCount}</strong>개
              </p>
              <p className="text-caption text-body">준비 완료 {preparedCount}개</p>
            </section>
            {list.data.items.length === 0 ? (
              <EmptyState title="필요한 재료가 없어요" description="확정된 식단의 레시피에 등록된 재료가 없어요." />
            ) : (
              <ul className="flex flex-col gap-2" aria-label="재료 목록">
                {list.data.items.map((item) => (
                  <ShoppingItemRow key={item.id} item={item} onToggle={onToggle} onManageSubstitute={setSubstituteItem} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <SubstituteModal weekStart={nav.weekStart} item={substituteItem} onClose={() => setSubstituteItem(null)} />
    </>
  );
}
