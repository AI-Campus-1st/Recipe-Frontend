"use client";

import { Trash2 } from "lucide-react";
import { Accordion } from "@/components/Accordion";
import { Button } from "@/components/Button";
import { RecipeImage } from "@/components/RecipeCard";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/cn";
import type { Recipe } from "@/lib/api/contracts";
import { formatMinutes, recipeTitle } from "@/lib/format";
import { CookingLogItem } from "@/features/recipe-view/CookingLogItem";
import { CATEGORY_LABELS, STATUS_BADGE } from "./labels";

interface RecipeListItemProps {
  recipe: Recipe;
  highlighted?: boolean;
  retrying?: boolean;
  /** Open the recipe detail screen (saved recipes only). */
  onOpen: (recipe: Recipe) => void;
  onReview: (recipe: Recipe) => void;
  onRetry: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

export function RecipeListItem({ recipe, highlighted, retrying, onOpen, onReview, onRetry, onDelete }: RecipeListItemProps) {
  const title = recipeTitle(recipe.title);
  const badge = STATUS_BADGE[recipe.status];
  // Recipes still being collected or reviewed have no confirmed detail to show yet.
  const openable = recipe.status === "saved";

  const summary = (
    <>
      <RecipeImage src={recipe.imageUrl} alt={title} className="size-16 shrink-0 rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate pr-9 text-body-lg font-semibold text-ink">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          {recipe.status === "saved" && (
            <span className="text-caption text-muted">
              {recipe.category ? `${CATEGORY_LABELS[recipe.category]} · ` : ""}
              {formatMinutes(recipe.cookMinutes)}
            </span>
          )}
        </div>
        {recipe.status === "importing" && <p className="truncate text-caption text-muted">{recipe.sourceUrl}</p>}
        {recipe.status === "failed" && (
          <p className="text-caption text-body">
            {recipe.failureReason}
            <span className="block truncate text-muted">{recipe.sourceUrl}</span>
          </p>
        )}
      </div>
    </>
  );

  return (
    <li
      id={`recipe-${recipe.id}`}
      aria-label={title}
      className={cn(
        "rounded-md border bg-canvas p-4 transition-colors",
        highlighted ? "border-secondary ring-2 ring-primary" : "border-hairline",
      )}
    >
      <div className="relative">
        {openable ? (
          <button
            type="button"
            onClick={() => onOpen(recipe)}
            aria-label={`${title} 상세 보기`}
            className="flex w-full gap-3 rounded-sm text-left"
          >
            {summary}
          </button>
        ) : (
          <div className="flex gap-3">{summary}</div>
        )}
        <button
          type="button"
          aria-label={`${title} 삭제`}
          onClick={() => onDelete(recipe)}
          className="absolute -top-2 -right-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-soft hover:text-error"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {recipe.status === "needs_review" && (
        <div className="mt-3 flex">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => onReview(recipe)}>
            정보 확인하기
          </Button>
        </div>
      )}
      {recipe.status === "failed" && (
        <div className="mt-3 flex gap-2 [&>*]:flex-1">
          <Button size="sm" variant="secondary" onClick={() => onRetry(recipe)} loading={retrying}>
            재시도
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onReview(recipe)}>
            수정 요청
          </Button>
        </div>
      )}

      {recipe.cookingLogs.length > 0 && (
        <Accordion
          className="mt-2 border-t border-hairline"
          compact
          header={<span className="text-label text-body">조리 기록 {recipe.cookingLogs.length}회</span>}
        >
          <ul className="flex flex-col gap-2 pb-1">
            {recipe.cookingLogs.map((log) => (
              <CookingLogItem key={log.id} log={log} />
            ))}
          </ul>
        </Accordion>
      )}
    </li>
  );
}
