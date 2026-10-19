"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { RecipeCard } from "@/components/RecipeCard";
import { TextArea } from "@/components/TextInput";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api/client";
import type { MealPlanEntry } from "@/lib/api/contracts";
import { formatDateWithWeekday } from "@/lib/date";
import { formatMinutes, formatServings, recipeTitle } from "@/lib/format";
import { useRegenerateMeal } from "./hooks";

interface ChangeMealModalProps {
  entry: MealPlanEntry | null;
  onClose: () => void;
}

export function ChangeMealModal({ entry, onClose }: ChangeMealModalProps) {
  if (!entry) return null;
  return <ChangeMealModalBody key={entry.id} entry={entry} onClose={onClose} />;
}

function ChangeMealModalBody({ entry, onClose }: { entry: MealPlanEntry; onClose: () => void }) {
  const toast = useToast();
  const regenerate = useRegenerateMeal();
  const [comment, setComment] = useState("");

  const submit = () =>
    regenerate.mutate(
      { entryId: entry.id, comment: comment.trim() || undefined },
      {
        onSuccess: (next) => {
          toast.show({ type: "success", message: `${formatDateWithWeekday(next.date)} 식단을 ${recipeTitle(next.mainRecipe.title)}(으)로 변경했어요.` });
          onClose();
        },
        // The existing meal stays as it is; the comment is kept for another try.
        onError: (err) => toast.show({ type: "error", message: `식단을 변경하지 못했어요. ${errorMessage(err)}` }),
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title="식단 변경"
      description={`${formatDateWithWeekday(entry.date)} 식단만 변경하고 다른 날짜는 그대로 유지해요.`}
      busy={regenerate.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={regenerate.isPending}>
            취소
          </Button>
          <Button onClick={submit} loading={regenerate.isPending}>
            변경 요청
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-hairline p-3">
          <p className="mb-2 text-label text-muted">현재 식단</p>
          <RecipeCard
            recipe={entry.mainRecipe}
            meta={
              <>
                <span>{formatMinutes(entry.mainRecipe.cookMinutes)}</span>
                <span>{formatServings(entry.servings)}</span>
              </>
            }
          />
          {entry.sideRecipes.length > 0 && (
            <p className="mt-2 text-caption text-body">곁들임: {entry.sideRecipes.map((s) => recipeTitle(s.title)).join(", ")}</p>
          )}
        </div>
        <TextArea
          label="변경 요청사항"
          placeholder="예: 더 간단하고 설거지가 적은 메뉴"
          hint="비워 두면 날짜 설정에 맞는 다른 저장 레시피를 추천해요."
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={200}
        />
      </div>
    </Modal>
  );
}
