"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

interface ScreenHeaderProps {
  title: ReactNode;
  /** Small text above the title (e.g. a date range). */
  eyebrow?: ReactNode;
  /** Show a back button. */
  back?: boolean;
  /** Right-side controls defined by the screen spec. */
  trailing?: ReactNode;
}

export function ScreenHeader({ title, eyebrow, back = false, trailing }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex min-h-[var(--app-header-height)] items-center gap-1 border-b border-hairline bg-canvas/95 px-3 backdrop-blur">
      {back && (
        <button
          type="button"
          aria-label="뒤로 가기"
          onClick={() => router.back()}
          className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-soft"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
      )}
      <div className={back ? "min-w-0 flex-1" : "min-w-0 flex-1 pl-2"}>
        {eyebrow && <p className="text-caption text-muted">{eyebrow}</p>}
        <h1 className="truncate text-heading-sm text-ink">{title}</h1>
      </div>
      {trailing}
    </header>
  );
}
