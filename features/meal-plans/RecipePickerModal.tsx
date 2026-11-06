"use client";

import { Search, Star, X } from "lucide-react";
import NextLink from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/client";
import { RECIPE_CATEGORIES, type Recipe, type RecipeCategory } from "@/lib/api/contracts";
import { parseISODate, toISODate } from "@/lib/date";
import { recipeTitle } from "@/lib/format";
import { useRecipes } from "@/features/recipes/hooks";
import { CATEGORY_LABELS } from "@/features/recipes/labels";
import { filterRecipesByName } from "@/features/recipes/search";
import { averageRating, lastCookedAt, RECIPE_SORT_LABELS, RECIPE_SORTS, sortRecipes, type RecipeSort } from "@/features/recipes/sort";

interface RecipePickerModalProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  /** e.g. `주 레시피 선택`, `곁들임 추가`. */
  title: string;
  /** Recipes already in the meal: shown as `선택됨` and not selectable. */
  selectedIds: string[];
  onSelect: (recipe: Recipe) => void;
}

/** "10월 8일" from an ISO date-time, in local time. */
function formatShortDate(dateTime: string): string {
  const date = parseISODate(toISODate(new Date(dateTime)));
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * Recipe browser opened on top of the day meal modal (MEAL-001): category chips, name search and sorting,
 * all on the client from `GET /recipes`. Any category can be picked; only saved recipes are listed.
 */
export function RecipePickerModal({ open, onClose, onExited, title, selectedIds, onSelect }: RecipePickerModalProps) {
  const [category, setCategory] = useState<RecipeCategory | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RecipeSort>("least_recent");
  const recipes = useRecipes(null);

  const saved = useMemo(() => (recipes.data ?? []).filter((r) => r.status === "saved"), [recipes.data]);
  const visible = useMemo(() => {
    const inCategory = category ? saved.filter((r) => r.category === category) : saved;
    return sortRecipes(filterRecipesByName(inCategory, query), sort);
  }, [saved, category, query, sort]);

  const resetFilters = () => {
    setCategory(null);
    setQuery("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={title}
      size="tall"
      footer={
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="카테고리" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {[null, ...RECIPE_CATEGORIES].map((value) => {
            const pressed = category === value;
            return (
              <button
                key={value ?? "all"}
                type="button"
                aria-pressed={pressed}
                onClick={() => setCategory(value)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-label",
                  pressed ? "border-secondary bg-primary-soft text-ink" : "border-hairline bg-canvas text-body",
                )}
              >
                {value ? CATEGORY_LABELS[value] : "전체"}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <div role="search" className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              aria-label="레시피 이름 검색"
              placeholder="레시피 이름으로 찾기"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={50}
              className={cn(
                "min-h-11 w-full rounded-sm border border-border-strong bg-canvas pr-11 pl-9 text-body-lg text-ink placeholder:text-muted outline-none",
                "focus:border-secondary focus:ring-2 focus:ring-primary-soft [&::-webkit-search-cancel-button]:hidden",
              )}
            />
            {query && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <select
            aria-label="정렬"
            value={sort}
            onChange={(event) => setSort(event.target.value as RecipeSort)}
            className="min-h-11 shrink-0 rounded-sm border border-border-strong bg-canvas px-2 text-label text-ink outline-none focus:border-secondary focus:ring-2 focus:ring-primary-soft"
          >
            {RECIPE_SORTS.map((value) => (
              <option key={value} value={value}>
                {RECIPE_SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {recipes.isPending ? (
          <LoadingState label="레시피를 불러오는 중" />
        ) : recipes.isError ? (
          <ErrorState message={errorMessage(recipes.error)} onRetry={() => recipes.refetch()} retrying={recipes.isFetching} />
        ) : saved.length === 0 ? (
          <EmptyState
            title="저장된 레시피가 없어요"
            description="레시피를 추가하면 식단에 넣을 수 있어요."
            action={
              <NextLink href="/recipes" className={buttonClass("primary", "md")}>
                레시피 추가하러 가기
              </NextLink>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="조건에 맞는 레시피가 없어요"
            description="다른 카테고리나 이름으로 찾아 주세요."
            action={
              <Button variant="secondary" onClick={resetFilters}>
                필터 초기화
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-hairline" aria-label="레시피 목록">
            {visible.map((recipe) => {
              const selected = selectedIds.includes(recipe.id);
              const last = lastCookedAt(recipe);
              const rating = averageRating(recipe);
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    disabled={selected}
                    onClick={() => onSelect(recipe)}
                    className="flex min-h-14 w-full items-center gap-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body-lg font-semibold text-ink">{recipeTitle(recipe.title)}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-caption text-muted">
                        {recipe.category && <span>{CATEGORY_LABELS[recipe.category]}</span>}
                        <span>{last ? `마지막 조리 ${formatShortDate(last)}` : "조리 기록 없음"}</span>
                        {rating !== null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="size-3 fill-current" aria-hidden />
                            <span aria-label={`평균 별점 ${rating.toFixed(1)}`}>{rating.toFixed(1)}</span>
                          </span>
                        )}
                      </span>
                    </span>
                    {selected && <span className="shrink-0 text-caption text-secondary">선택됨</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
