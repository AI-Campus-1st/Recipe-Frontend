import type { ISODate } from "./api/contracts";

/** Week start day (0 = Sunday, 1 = Monday). Policy is undecided (Q-05); Monday is assumed. */
export const WEEK_START_DAY = 1;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** Default cooking time policy (DEFINITION 원칙 1). */
export const DEFAULT_WEEKDAY_COOK_MINUTES = 30;
export const DEFAULT_WEEKEND_COOK_MINUTES = 70;
export const DEFAULT_SERVINGS = 1;

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function startOfWeek(value: ISODate): ISODate {
  const date = parseISODate(value);
  const diff = (date.getDay() - WEEK_START_DAY + 7) % 7;
  date.setDate(date.getDate() - diff);
  return toISODate(date);
}

export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isWeekend(value: ISODate): boolean {
  const day = parseISODate(value).getDay();
  return day === 0 || day === 6;
}

export function defaultCookMinutes(value: ISODate): number {
  return isWeekend(value) ? DEFAULT_WEEKEND_COOK_MINUTES : DEFAULT_WEEKDAY_COOK_MINUTES;
}

export function weekdayLabel(value: ISODate): string {
  return WEEKDAY_LABELS[parseISODate(value).getDay()];
}

/** "10월 15일 (목)" */
export function formatDateWithWeekday(value: ISODate): string {
  const date = parseISODate(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdayLabel(value)})`;
}

/** "2026년 10월 15일 목요일" */
export function formatFullDate(value: ISODate): string {
  const date = parseISODate(value);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayLabel(value)}요일`;
}

/** "10.12 – 10.18" */
export function formatWeekRange(weekStart: ISODate): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(addDays(weekStart, 6));
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export function monthOf(value: ISODate): string {
  return value.slice(0, 7);
}

/** "10월" */
export function formatMonth(month: string): string {
  return `${Number(month.slice(5, 7))}월`;
}

export function formatTime(value: string): string {
  const date = new Date(value);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${formatTime(value)}`;
}

/**
 * Weeks belonging to a month: every week whose start date falls inside the month.
 * The first/last-week rule is undecided (Q-05); this is the provisional rule.
 */
/** Weeks (Monday start) that overlap the month by at least one day, so a boundary week belongs to both months. */
export function weeksOfMonth(month: string): ISODate[] {
  let cursor = startOfWeek(`${month}-01`);
  const weeks: ISODate[] = [];
  while (monthOf(cursor) <= month) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** `count` consecutive dates starting at `from` (default today), e.g. today ~ +6 days for the day meal modal. */
export function upcomingDates(count = 7, from: ISODate = todayISO()): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
