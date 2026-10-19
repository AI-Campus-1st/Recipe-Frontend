"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { TextInput } from "@/components/TextInput";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/client";
import { RATING_MAX, RATING_MIN } from "@/lib/api/contracts";
import { useReviewCookingLog } from "@/features/meal-plans/hooks";

interface CookingReviewModalProps {
  logId: string | null;
  recipeName: string;
  onClose: () => void;
}

export function CookingReviewModal({ logId, recipeName, onClose }: CookingReviewModalProps) {
  if (!logId) return null;
  return <CookingReviewModalBody key={logId} logId={logId} recipeName={recipeName} onClose={onClose} />;
}

function CookingReviewModalBody({ logId, recipeName, onClose }: { logId: string; recipeName: string; onClose: () => void }) {
  const toast = useToast();
  const review = useReviewCookingLog();
  const [rating, setRating] = useState<number | null>(null);
  const [memo, setMemo] = useState("");

  const submit = () => {
    if (rating === null) return;
    review.mutate(
      { logId, rating, memo: memo.trim() || null },
      {
        onSuccess: () => {
          toast.show({ type: "success", message: "평가를 등록했어요." });
          onClose();
        },
        onError: (err) =>
          toast.show({ type: "error", message: `평가를 저장하지 못했어요. 요리 완료 상태는 유지돼요. ${errorMessage(err)}` }),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="요리 평가"
      description={`${recipeName} 요리는 어떠셨나요? 평가를 남기려면 별점을 선택해 주세요.`}
      busy={review.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={review.isPending}>
            스킵
          </Button>
          <Button onClick={submit} loading={review.isPending} disabled={rating === null}>
            등록
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-1.5 text-label text-ink">
            별점 <span className="text-caption text-muted">필수</span>
          </legend>
          <div className="flex" role="radiogroup" aria-label="별점">
            {Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => i + RATING_MIN).map((value) => {
              const active = rating !== null && value <= rating;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value}점`}
                  onClick={() => setRating(value)}
                  className="flex size-11 items-center justify-center rounded-full hover:bg-surface-soft"
                >
                  <Star className={cn("size-7", active ? "fill-primary text-secondary" : "text-border-strong")} aria-hidden />
                </button>
              );
            })}
          </div>
        </fieldset>
        <TextInput
          label="한 줄 코멘트"
          placeholder="예: 간을 조금 싱겁게 하면 좋겠다"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          maxLength={100}
        />
      </div>
    </Modal>
  );
}
