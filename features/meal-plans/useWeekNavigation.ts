"use client";

import { useState } from "react";
import type { ISODate } from "@/lib/api/contracts";
import { monthOf, startOfWeek, todayISO } from "@/lib/date";

/** Week being viewed plus the month shown in the week strip. */
export function useWeekNavigation() {
  const [weekStart, setWeekStart] = useState<ISODate>(() => startOfWeek(todayISO()));
  const [month, setMonth] = useState(() => monthOf(startOfWeek(todayISO())));

  const selectWeek = (next: ISODate) => {
    setWeekStart(next);
    setMonth(monthOf(next));
  };

  const changeMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  return { weekStart, month, selectWeek, changeMonth };
}
