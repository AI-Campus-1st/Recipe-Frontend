"use client";

/* eslint-disable @next/next/no-img-element -- recipe images come from arbitrary external sources */
import { UtensilsCrossed } from "lucide-react";
import NextLink from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { recipeTitle } from "@/lib/format";
import type { RecipeSummary } from "@/lib/api/contracts";

interface RecipeImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/** Image with a placeholder so the content structure holds when the image is missing or fails. */
export function RecipeImage({ src, alt, className }: RecipeImageProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} 이미지 없음`}
        className={cn("flex items-center justify-center bg-surface-strong text-border-strong", className)}
      >
        <UtensilsCrossed className="size-1/3 max-h-10 max-w-10" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={alt} className={cn("object-cover", className)} onError={() => setFailed(true)} />;
}

interface RecipeCardProps {
  recipe: RecipeSummary;
  href?: string;
  /** Status or time information defined for the screen. */
  meta?: ReactNode;
  /** Screen-specific actions, rendered outside the link area. */
  actions?: ReactNode;
  layout?: "horizontal" | "hero";
  className?: string;
}

export function RecipeCard({ recipe, href, meta, actions, layout = "horizontal", className }: RecipeCardProps) {
  const title = recipeTitle(recipe.title);
  const body =
    layout === "hero" ? (
      <>
        <RecipeImage src={recipe.imageUrl} alt={title} className="aspect-[16/10] w-full rounded-md" />
        <div className="mt-3 flex flex-col gap-2">
          <h3 className="text-heading-sm text-ink">{title}</h3>
          {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </>
    ) : (
      <div className="flex items-center gap-3">
        <RecipeImage src={recipe.imageUrl} alt={title} className="size-16 shrink-0 rounded-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-body-lg font-semibold text-ink">{title}</h3>
          {meta && <div className="flex flex-wrap items-center gap-2 text-caption text-muted">{meta}</div>}
        </div>
      </div>
    );

  return (
    <div className={className}>
      {href ? (
        <NextLink href={href} className="block rounded-md focus-visible:outline-2">
          {body}
        </NextLink>
      ) : (
        body
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
