"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { ExternalLink } from "@/components/Link";
import { Modal, useModalPresence } from "@/components/Modal";
import { TextArea } from "@/components/TextInput";
import { useToast } from "@/components/Toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Recipe } from "@/lib/api/contracts";
import { formatMinutes, formatQuantity, formatServings, recipeTitle, UNKNOWN_LABEL } from "@/lib/format";
import { useConfirmRecipe, useRequestRevision } from "./hooks";
import { CATEGORY_LABELS, FIELD_LABELS } from "./labels";

interface RecipeRevisionModalProps {
  recipe: Recipe | null;
  onClose: () => void;
}

/**
 * `확인 필요`: review extracted data, then `수정사항 반영 요청` (optional comment) or `확인 처리`.
 * `수집 실패`: `수정 요청` with the user's comment.
 */
export function RecipeRevisionModal({ recipe: target, onClose }: RecipeRevisionModalProps) {
  // Keep showing the recipe while the modal slides down after `recipe` is cleared.
  const presence = useModalPresence(target);
  const recipe = presence.value;
  const toast = useToast();
  const requestRevision = useRequestRevision();
  const confirmRecipe = useConfirmRecipe();
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const busy = requestRevision.isPending || confirmRecipe.isPending;
  const isFailed = recipe?.status === "failed";
  const missingIngredients = !!recipe && recipe.ingredients.length === 0;

  const close = () => {
    setComment("");
    setCommentError(null);
    setFieldErrors({});
    onClose();
  };

  const submitRevision = () => {
    if (!recipe) return;
    if (isFailed && !comment.trim()) {
      setCommentError("수정 요청사항을 입력해 주세요.");
      return;
    }
    requestRevision.mutate(
      { id: recipe.id, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast.show({ type: "success", message: "수정 요청을 보냈어요. 다시 수집하는 중이에요." });
          close();
        },
        onError: (err) => {
          // An empty `확인 필요` request is rejected by the server: show it on the field and keep the modal open.
          if (err instanceof ApiError && err.fieldErrors.comment) {
            setCommentError(err.fieldErrors.comment);
            return;
          }
          toast.show({ type: "error", message: `수정 요청을 보내지 못했어요. ${errorMessage(err)}` });
        },
      },
    );
  };

  const submitConfirm = () => {
    if (!recipe) return;
    confirmRecipe.mutate(recipe.id, {
      onSuccess: () => {
        toast.show({ type: "success", message: "레시피를 저장했어요." });
        close();
      },
      onError: (err) => {
        if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) setFieldErrors(err.fieldErrors);
        toast.show({ type: "error", message: `확인 처리하지 못했어요. ${errorMessage(err)}` });
      },
    });
  };

  return (
    <Modal
      open={presence.open}
      onExited={presence.onExited}
      onClose={close}
      title={isFailed ? "수정 요청" : "레시피 확인"}
      description={isFailed ? "수집에 실패한 레시피에 대해 요청사항을 남기면 다시 수집해요." : "수집한 정보를 확인한 뒤 저장하거나 수정을 요청하세요."}
      busy={busy}
      footer={
        isFailed ? (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              취소
            </Button>
            <Button onClick={submitRevision} loading={requestRevision.isPending}>
              수정 요청
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={submitRevision} loading={requestRevision.isPending} disabled={confirmRecipe.isPending}>
              수정사항 반영 요청
            </Button>
            <Button onClick={submitConfirm} loading={confirmRecipe.isPending} disabled={missingIngredients || requestRevision.isPending}>
              확인 처리
            </Button>
          </>
        )
      }
    >
      {recipe && (
        <div className="flex flex-col gap-4">
          {isFailed ? (
            <div className="rounded-md bg-surface-soft p-3 text-body-md">
              <p className="text-ink">{recipe.failureReason ?? "레시피를 수집하지 못했습니다."}</p>
              <p className="mt-2 break-all text-caption text-muted">{recipe.sourceUrl}</p>
            </div>
          ) : (
            <RecipeExtractSummary recipe={recipe} fieldErrors={fieldErrors} />
          )}
          {!isFailed && missingIngredients && (
            <p role="alert" className="flex items-start gap-2 rounded-sm bg-surface-soft p-3 text-body-md text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              필수 항목인 재료가 없어 확인 처리할 수 없어요. 수정사항 반영을 요청해 주세요.
            </p>
          )}
          <TextArea
            label="수정 요청사항"
            required={isFailed}
            placeholder={isFailed ? "예: 영상 설명란의 재료 목록을 참고해 주세요" : "예: 재료에 다진 마늘 1큰술을 추가해 주세요"}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              if (commentError) setCommentError(null);
            }}
            error={commentError}
            maxLength={500}
          />
        </div>
      )}
    </Modal>
  );
}

function RecipeExtractSummary({ recipe, fieldErrors }: { recipe: Recipe; fieldErrors: Record<string, string> }) {
  const uncertain = new Set(recipe.uncertainFields);
  const flag = (field: string) =>
    uncertain.has(field) ? <span className="ml-1 text-caption text-warning">· 확인 필요</span> : null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline p-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-md">
        <dt className="text-muted">{FIELD_LABELS.title}</dt>
        <dd className="text-ink">
          {recipeTitle(recipe.title)}
          {flag("title")}
          {fieldErrors.title && <p className="text-caption text-error">{fieldErrors.title}</p>}
        </dd>
        <dt className="text-muted">카테고리</dt>
        <dd className="text-ink">{recipe.category ? CATEGORY_LABELS[recipe.category] : UNKNOWN_LABEL}</dd>
        <dt className="text-muted">{FIELD_LABELS.baseServings}</dt>
        <dd className="text-ink">
          {formatServings(recipe.baseServings)}
          {flag("baseServings")}
        </dd>
        <dt className="text-muted">{FIELD_LABELS.cookMinutes}</dt>
        <dd className="text-ink">
          {formatMinutes(recipe.cookMinutes)}
          {flag("cookMinutes")}
        </dd>
      </dl>
      <div>
        <p className="text-label text-ink">
          {FIELD_LABELS.ingredients} <span className="text-caption text-warning">필수</span>
          {flag("ingredients")}
        </p>
        {recipe.ingredients.length === 0 ? (
          <p className="mt-1 text-body-md text-error">{fieldErrors.ingredients ?? "추출된 재료가 없습니다."}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-body-md">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id} className="flex justify-between gap-2">
                <span>{ingredient.name}</span>
                <span className={ingredient.quantity === null ? "text-warning" : "text-ink"}>
                  {formatQuantity(ingredient.quantity, ingredient.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {recipe.steps.length > 0 && (
        <div>
          <p className="text-label text-ink">{FIELD_LABELS.steps}</p>
          <ol className="mt-1 list-decimal pl-5 text-body-md">
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      <ExternalLink href={recipe.sourceUrl} className="text-label">
        원문 열기
      </ExternalLink>
    </div>
  );
}
