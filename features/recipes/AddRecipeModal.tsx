"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { TextInput } from "@/components/TextInput";
import { useToast } from "@/components/Toast";
import { Tooltip } from "@/components/Tooltip";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { DuplicateRecipeDetails } from "@/lib/api/contracts";
import { recipeTitle } from "@/lib/format";
import { useImportRecipe } from "./hooks";
import { SUPPORTED_SOURCES, validateRecipeUrl } from "./labels";

interface AddRecipeModalProps {
  open: boolean;
  onClose: () => void;
}

const FORM_ID = "add-recipe-form";

export function AddRecipeModal({ open, onClose }: AddRecipeModalProps) {
  const router = useRouter();
  const toast = useToast();
  const importRecipe = useImportRecipe();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateRecipeDetails["existingRecipe"] | null>(null);

  const reset = () => {
    setUrl("");
    setTitle("");
    setUrlError(null);
    setDuplicate(null);
    importRecipe.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    const error = validateRecipeUrl(url);
    setUrlError(error);
    if (error) return;
    importRecipe.mutate(
      { url: url.trim(), title: title.trim() || undefined },
      {
        onSuccess: (recipe) => {
          // A soft-deleted recipe of the same source comes back as it was instead of a new import.
          const message =
            recipe.status === "importing"
              ? "레시피 수집을 시작했어요. 레시피 목록에서 상태를 확인하세요."
              : "삭제했던 레시피를 다시 불러왔어요.";
          toast.show({ type: "success", message });
          close();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "duplicate_recipe") {
            setDuplicate((err.details as DuplicateRecipeDetails).existingRecipe);
            toast.show({ type: "info", message: "이미 저장된 레시피예요." });
            return;
          }
          if (err instanceof ApiError && err.fieldErrors.url) {
            setUrlError(err.fieldErrors.url);
            return;
          }
          // Inputs are kept so the user can retry.
          toast.show({ type: "error", message: `레시피를 추가하지 못했어요. ${errorMessage(err)}` });
        },
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="레시피 추가"
      description="외부 레시피 URL을 입력하면 레시피 정보를 수집합니다."
      busy={importRecipe.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={importRecipe.isPending}>
            취소
          </Button>
          <Button type="submit" form={FORM_ID} loading={importRecipe.isPending}>
            추가
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="레시피 URL"
          required
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setDuplicate(null);
            if (urlError) setUrlError(null);
          }}
          error={urlError}
          hint="유튜브, 만개의 레시피, 네이버 블로그 주소를 지원해요."
          labelAddon={
            <Tooltip label="수집 가능한 출처">
              <span className="block font-semibold">수집 가능한 출처</span>
              {SUPPORTED_SOURCES.join(" · ")}
            </Tooltip>
          }
        />
        <TextInput
          label="레시피 이름"
          placeholder="비워 두면 수집한 이름을 사용해요"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={60}
        />
        {duplicate && (
          <div role="status" className="rounded-md border border-hairline bg-surface-soft p-3">
            <p className="text-body-md text-ink">
              이미 저장된 레시피예요: <strong>{recipeTitle(duplicate.title)}</strong>
            </p>
            <p className="mt-1 text-caption text-muted">수집 결과를 바꾸려면 기존 레시피에서 수정을 요청해 주세요.</p>
            <div className="mt-3 flex gap-2 [&>*]:flex-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  close();
                  router.push(`/recipes?highlight=${encodeURIComponent(duplicate.id)}`);
                }}
              >
                기존 레시피 보기
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
