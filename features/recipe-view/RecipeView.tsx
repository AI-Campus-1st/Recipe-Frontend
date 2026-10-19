"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "@/components/Link";
import { RecipeImage } from "@/components/RecipeCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import type { CookingLogSummary, RecipeIngredient, RecipeSummary } from "@/lib/api/contracts";
import { formatMinutes, recipeTitle } from "@/lib/format";
import { CookingLogItem, hasReview } from "./CookingLogItem";
import { IngredientList } from "./IngredientList";

/**
 * Read-only recipe layout shared by the cooking screen (meal context) and the
 * recipe detail screen (saved recipe): summary → steps → previous reviews → extra → ingredients.
 */

const MAX_REVIEWS = 3;

interface RecipeViewProps {
  recipe: RecipeSummary;
  /** Extra summary info next to the cooking-time badge (servings, category, …). */
  meta?: ReactNode;
  steps: string[];
  /** Cooking guidance for applied substitutes, kept apart from the original steps. */
  substituteNotes?: string[];
  sourceUrl?: string;
  logs: CookingLogSummary[];
  /** Caption above the ingredient list, e.g. "2인분 기준 필요량". */
  ingredientsCaption: string;
  ingredients: Array<Omit<RecipeIngredient, "ingredientId"> & { substitutedFrom?: string | null }>;
  /** Rendered between the reviews and the ingredients (e.g. side/main recipe links). */
  children?: ReactNode;
}

export function RecipeView({
  recipe,
  meta,
  steps,
  substituteNotes = [],
  sourceUrl,
  logs,
  ingredientsCaption,
  ingredients,
  children,
}: RecipeViewProps) {
  const title = recipeTitle(recipe.title);
  const reviewedLogs = logs.filter(hasReview).slice(0, MAX_REVIEWS);

  return (
    <article className="page-x flex flex-col gap-6 pt-4">
      <section aria-label="레시피 요약">
        <RecipeImage src={recipe.imageUrl} alt={title} className="aspect-[16/10] w-full rounded-lg" />
        <h2 className="mt-4 text-heading-lg text-ink">{title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge tone="neutral">{formatMinutes(recipe.cookMinutes)}</StatusBadge>
          {meta}
        </div>
      </section>

      <section aria-labelledby="steps-title">
        <h3 id="steps-title" className="mb-2 text-heading-sm text-ink">
          조리 순서
        </h3>
        {steps.length === 0 ? (
          <p className="text-body-md text-muted">등록된 조리 순서가 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-body-lg text-body">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-label text-secondary">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}
        {substituteNotes.length > 0 && (
          <div className="mt-4 rounded-md border border-hairline bg-surface-soft p-3">
            <p className="text-label text-ink">대체 시 조리 안내</p>
            <ul className="mt-1 list-disc pl-5 text-body-md text-body">
              {substituteNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
        {sourceUrl && (
          <ExternalLink href={sourceUrl} className="mt-3 text-label">
            원본 레시피 보기
          </ExternalLink>
        )}
      </section>

      {reviewedLogs.length > 0 && (
        <section aria-labelledby="logs-title">
          <h3 id="logs-title" className="mb-2 text-heading-sm text-ink">
            이전 평가·메모
          </h3>
          <ul className="flex flex-col gap-2">
            {reviewedLogs.map((log) => (
              <CookingLogItem key={log.id} log={log} />
            ))}
          </ul>
        </section>
      )}

      {children}

      <section aria-labelledby="ingredients-title">
        <h3 id="ingredients-title" className="mb-1 text-heading-sm text-ink">
          재료
        </h3>
        <p className="mb-1 text-caption text-muted">{ingredientsCaption}</p>
        <IngredientList ingredients={ingredients} />
      </section>
    </article>
  );
}

interface RecipeScreenFallbackProps {
  title: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

/** Header + loading or error state for recipe screens. */
export function RecipeScreenFallback({ title, loading, error, onRetry, retrying }: RecipeScreenFallbackProps) {
  return (
    <>
      <ScreenHeader title={title} back />
      {loading ? (
        <LoadingState label="레시피를 불러오는 중" />
      ) : (
        <div className="page-x pt-4">
          <ErrorState message={error ?? "레시피를 불러오지 못했어요."} onRetry={onRetry} retrying={retrying} />
        </div>
      )}
    </>
  );
}
