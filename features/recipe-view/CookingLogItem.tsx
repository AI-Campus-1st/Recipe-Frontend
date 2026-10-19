import { Star } from "lucide-react";
import type { CookingLogSummary } from "@/lib/api/contracts";
import { formatDateWithWeekday } from "@/lib/date";

/** One cooking history entry: date, optional rating and memo. */
export function CookingLogItem({ log }: { log: CookingLogSummary }) {
  return (
    <li className="rounded-sm bg-surface-soft px-3 py-2 text-body-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink">{formatDateWithWeekday(log.mealDate)}</span>
        {log.rating !== null && (
          <span className="inline-flex items-center gap-1 text-caption text-body">
            <Star className="size-3 fill-current text-warning" aria-hidden />
            <span className="sr-only">별점</span>
            {log.rating}
          </span>
        )}
      </div>
      {log.memo && <p className="mt-1 text-body">{log.memo}</p>}
    </li>
  );
}

export const hasReview = (log: CookingLogSummary) => log.rating !== null || !!log.memo;
