"use client";

import { Button } from "@/components/Button";
import { Modal, useModalPresence, type ModalPresenceProps } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api/client";
import type { MealDetail, MealPlanEntry } from "@/lib/api/contracts";
import { formatDateWithWeekday } from "@/lib/date";
import { recipeTitle } from "@/lib/format";
import { useClearDayMeal, useMealDetail, useUncompleteMeal } from "./hooks";

interface ConfirmProps {
  entry: MealPlanEntry | null;
  onClose: () => void;
}

/** `삭제` on a day card: removes that date's meal (`DELETE /meal-plans/days/{date}`). */
export function ClearDayMealModal({ entry, onClose }: ConfirmProps) {
  const presence = useModalPresence(entry);
  if (!presence.value) return null;
  return <ClearDayMealBody key={presence.value.id} entry={presence.value} onClose={onClose} open={presence.open} onExited={presence.onExited} />;
}

function ClearDayMealBody({ entry, onClose, open, onExited }: { entry: MealPlanEntry; onClose: () => void } & ModalPresenceProps) {
  const toast = useToast();
  const clear = useClearDayMeal();
  const dateLabel = formatDateWithWeekday(entry.date);

  const confirm = () =>
    clear.mutate(entry.date, {
      onSuccess: () => {
        toast.show({ type: "success", message: `${dateLabel} 식단을 삭제했어요.` });
        onClose();
      },
      onError: (err) => toast.show({ type: "error", message: `식단을 삭제하지 못했어요. ${errorMessage(err)}` }),
    });

  return (
    <Modal
      open={open}
      onExited={onExited}
      onClose={onClose}
      title="식단 삭제"
      description={
        <>
          <strong className="text-ink">{dateLabel}</strong> 식단({recipeTitle(entry.mainRecipe.title)}
          {entry.sideRecipes.length > 0 && ` 외 ${entry.sideRecipes.length}개`})을 삭제할까요? 장보기 목록에서도 빠져요.
        </>
      }
      busy={clear.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={clear.isPending}>
            취소
          </Button>
          <Button variant="destructive" onClick={confirm} loading={clear.isPending}>
            삭제
          </Button>
        </>
      }
    />
  );
}

/** True when any recipe's current completion log of this meal has a rating or memo. */
export function hasCurrentReview(detail: MealDetail): boolean {
  return [detail.main, ...detail.sides].some((view) =>
    view.previousLogs.some((log) => log.id === view.cookingLogId && (log.rating !== null || !!log.memo)),
  );
}

/** `완료 취소` on a completed day card. The meal's current cooking logs (ratings and memos) are deleted. */
export function UncompleteMealModal({ entry, onClose }: ConfirmProps) {
  const presence = useModalPresence(entry);
  if (!presence.value) return null;
  return <UncompleteMealBody key={presence.value.id} entry={presence.value} onClose={onClose} open={presence.open} onExited={presence.onExited} />;
}

function UncompleteMealBody({ entry, onClose, open, onExited }: { entry: MealPlanEntry; onClose: () => void } & ModalPresenceProps) {
  const toast = useToast();
  const uncomplete = useUncompleteMeal();
  // The weekly entry has no reviews; the meal detail tells whether a rating or memo would be lost.
  const detail = useMealDetail(entry.id);
  const dateLabel = formatDateWithWeekday(entry.date);
  const reviewed = detail.data ? hasCurrentReview(detail.data) : false;

  const confirm = () =>
    uncomplete.mutate(entry.id, {
      onSuccess: () => {
        toast.show({ type: "success", message: `${dateLabel} 식단의 요리 완료를 취소했어요.` });
        onClose();
      },
      onError: (err) => toast.show({ type: "error", message: `완료를 취소하지 못했어요. ${errorMessage(err)}` }),
    });

  return (
    <Modal
      open={open}
      onExited={onExited}
      onClose={onClose}
      title="요리 완료 취소"
      description={
        <>
          <strong className="text-ink">{dateLabel}</strong> 식단의 요리 완료를 취소할까요? 이 식단의 조리 기록이 지워지고, 취소한 뒤에
          수정하거나 삭제할 수 있어요.
        </>
      }
      busy={uncomplete.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uncomplete.isPending}>
            닫기
          </Button>
          <Button variant="destructive" onClick={confirm} loading={uncomplete.isPending} disabled={detail.isPending}>
            완료 취소
          </Button>
        </>
      }
    >
      {reviewed ? (
        <p role="alert" className="rounded-sm bg-surface-soft p-3 text-body-md text-error">
          남긴 별점·메모도 함께 지워져요.
        </p>
      ) : detail.isError ? (
        <p className="text-body-md text-muted">별점·메모를 남겼다면 함께 지워져요.</p>
      ) : null}
    </Modal>
  );
}
