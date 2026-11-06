"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { Modal, useModalPresence } from "@/components/Modal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/client";
import { RECIPE_CATEGORIES, type Recipe, type RecipeCategory } from "@/lib/api/contracts";
import { recipeTitle } from "@/lib/format";
import { AddRecipeModal } from "./AddRecipeModal";
import { useDeleteRecipe, useRecipes, useRetryRecipe } from "./hooks";
import { CATEGORY_LABELS } from "./labels";
import { RecipeListItem } from "./RecipeListItem";
import { RecipeRevisionModal } from "./RecipeRevisionModal";
import { filterRecipesByName } from "./search";

export function RecipesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const toast = useToast();
  const [category, setCategory] = useState<RecipeCategory | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [revisionTargetId, setRevisionTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const deletePresence = useModalPresence(deleteTarget);

  const recipes = useRecipes(category);
  // Always show the latest data (the list keeps polling while recipes are being collected).
  const revisionTarget = recipes.data?.find((r) => r.id === revisionTargetId) ?? null;
  const retry = useRetryRecipe();
  const remove = useDeleteRecipe();
  const visibleRecipes = useMemo(() => filterRecipesByName(recipes.data ?? [], nameQuery), [recipes.data, nameQuery]);

  // Scroll to a recipe opened from the duplicate-URL notice.
  useEffect(() => {
    if (!highlightId || !recipes.data) return;
    document.getElementById(`recipe-${highlightId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId, recipes.data]);

  const onRetry = (recipe: Recipe) =>
    retry.mutate(recipe.id, {
      onSuccess: () => toast.show({ type: "success", message: "기존 URL로 다시 수집을 시작했어요." }),
      onError: (err) => toast.show({ type: "error", message: `재시도하지 못했어요. ${errorMessage(err)}` }),
    });

  const onConfirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.show({ type: "success", message: "레시피를 삭제했어요." });
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.show({ type: "error", message: `삭제하지 못했어요. ${errorMessage(err)}` });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <>
      <ScreenHeader title="레시피" />

      <div className="sticky top-[var(--app-header-height)] z-20 bg-canvas">
        <div role="group" aria-label="카테고리" className="flex gap-2 overflow-x-auto px-5 pt-3 pb-2 [scrollbar-width:none]">
          {[null, ...RECIPE_CATEGORIES].map((value) => {
            const selected = category === value;
            return (
              <button
                key={value ?? "all"}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(value)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-label",
                  selected ? "border-secondary bg-primary-soft text-ink" : "border-hairline bg-canvas text-body",
                )}
              >
                {value ? CATEGORY_LABELS[value] : "전체"}
              </button>
            );
          })}
        </div>
        <div role="search" className="px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              aria-label="레시피 이름 검색"
              placeholder="레시피 이름으로 찾기"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              maxLength={50}
              className={cn(
                "min-h-11 w-full rounded-sm border border-border-strong bg-canvas pr-11 pl-9 text-body-lg text-ink placeholder:text-muted outline-none",
                "focus:border-secondary focus:ring-2 focus:ring-primary-soft [&::-webkit-search-cancel-button]:hidden",
              )}
            />
            {nameQuery && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => setNameQuery("")}
                className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="page-x pb-20" aria-label="레시피 목록">
        {recipes.isPending ? (
          <LoadingState label="레시피를 불러오는 중" />
        ) : recipes.isError ? (
          <ErrorState message={errorMessage(recipes.error)} onRetry={() => recipes.refetch()} retrying={recipes.isFetching} />
        ) : recipes.data.length === 0 ? (
          <EmptyState
            title={category ? `${CATEGORY_LABELS[category]} 레시피가 없어요` : "저장된 레시피가 없어요"}
            description="레시피 URL을 추가하면 식단에 사용할 수 있어요."
            action={<Button onClick={() => setAddOpen(true)}>레시피 추가</Button>}
          />
        ) : visibleRecipes.length === 0 ? (
          <EmptyState
            title={`'${nameQuery.trim()}' 이름의 레시피가 없어요`}
            description="다른 이름으로 찾거나 검색어를 지워 주세요."
            action={
              <Button variant="secondary" onClick={() => setNameQuery("")}>
                검색어 지우기
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleRecipes.map((recipe) => (
              <RecipeListItem
                key={recipe.id}
                recipe={recipe}
                highlighted={recipe.id === highlightId}
                retrying={retry.isPending && retry.variables === recipe.id}
                onOpen={(r) => router.push(`/recipes/${encodeURIComponent(r.id)}`)}
                onReview={(r) => setRevisionTargetId(r.id)}
                onRetry={onRetry}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}
      </section>

      <FloatingActionButton label="레시피 추가" onClick={() => setAddOpen(true)} />
      <AddRecipeModal open={addOpen} onClose={() => setAddOpen(false)} />
      <RecipeRevisionModal recipe={revisionTarget} onClose={() => setRevisionTargetId(null)} />
      <Modal
        open={deletePresence.open}
        onExited={deletePresence.onExited}
        onClose={() => setDeleteTarget(null)}
        title="레시피 삭제"
        description={
          deletePresence.value && (
            <>
              <strong className="text-ink">{recipeTitle(deletePresence.value.title)}</strong>을(를) 삭제할까요? 삭제한 레시피는 되돌릴 수
              없어요.
            </>
          )
        }
        busy={remove.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>
              취소
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} loading={remove.isPending}>
              삭제
            </Button>
          </>
        }
      />
    </>
  );
}
