"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/cn";
import { addDays, formatMonth, formatWeekRange, parseISODate } from "@/lib/date";
import type { GenerationStatus, ISODate, MonthWeekSummary } from "@/lib/api/contracts";

interface WeeklyStatusProps {
  weekStart: ISODate;
  status: GenerationStatus;
  /** True while a generation request is in flight on this screen. */
  generating?: boolean;
  unassignedCount: number;
  month: string;
  monthWeeks: MonthWeekSummary[] | undefined;
  onSelectWeek: (weekStart: ISODate) => void;
  onChangeMonth: (delta: number) => void;
  notice?: ReactNode;
}

function GenerationBadge({ status, unassignedCount }: { status: GenerationStatus; unassignedCount: number }) {
  switch (status) {
    case "generating":
      return <StatusBadge tone="progress">생성 중</StatusBadge>;
    case "complete":
      return <StatusBadge tone="success">전체 생성 완료</StatusBadge>;
    case "partial":
      return (
        <StatusBadge tone="warning">
          일부 생성 완료{unassignedCount > 0 ? ` · 미배정 ${unassignedCount}일` : ""}
        </StatusBadge>
      );
    case "failed":
      return <StatusBadge tone="error">생성 실패</StatusBadge>;
    default:
      return <StatusBadge tone="neutral">생성 전</StatusBadge>;
  }
}

export function WeeklyStatus({
  weekStart,
  status,
  generating,
  unassignedCount,
  month,
  monthWeeks,
  onSelectWeek,
  onChangeMonth,
  notice,
}: WeeklyStatusProps) {
  return (
    <section aria-label="주간 식단 상태" className="rounded-md border border-hairline bg-canvas p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-md font-semibold text-ink">{formatWeekRange(weekStart)}</p>
        <GenerationBadge status={generating ? "generating" : status} unassignedCount={unassignedCount} />
      </div>

      <div className="mt-3 flex items-center gap-1">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => onChangeMonth(-1)}
          className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-soft"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="w-8 shrink-0 text-center text-label text-ink">{formatMonth(month)}</span>
        <ul
          aria-label={`${formatMonth(month)} 주차`}
          className="flex min-w-0 flex-1 justify-center gap-1 overflow-x-auto [scrollbar-width:none]"
        >
          {(monthWeeks ?? []).map((week, index) => {
            const selected = week.weekStart === weekStart;
            const start = parseISODate(week.weekStart);
            const end = parseISODate(addDays(week.weekStart, 6));
            return (
              <li key={week.weekStart} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectWeek(week.weekStart)}
                  aria-current={selected ? "true" : undefined}
                  aria-label={`${index + 1}주차 ${start.getMonth() + 1}월 ${start.getDate()}일부터 ${end.getMonth() + 1}월 ${end.getDate()}일, ${week.hasMeals ? "식단 있음" : "식단 없음"}`}
                  className={cn(
                    "flex min-h-11 min-w-10 flex-col items-center justify-center rounded-sm border px-1 py-1",
                    selected ? "border-secondary bg-primary-soft text-ink" : "border-hairline text-body",
                  )}
                >
                  <span className="text-badge">{index + 1}주</span>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1 size-2 rounded-full",
                      week.hasMeals ? "bg-primary ring-1 ring-secondary" : "ring-1 ring-border-strong",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => onChangeMonth(1)}
          className="-mr-3 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-soft"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      {notice && <div className="mt-3 rounded-sm bg-surface-soft px-3 py-2 text-caption text-body">{notice}</div>}
    </section>
  );
}
