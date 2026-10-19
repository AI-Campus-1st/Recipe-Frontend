import type { BadgeTone } from "@/components/StatusBadge";
import type { RecipeCategory, RecipeStatus } from "@/lib/api/contracts";

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  main: "메인",
  simple: "간단",
  soup: "국",
  side: "반찬",
  sauce: "소스",
};

export const STATUS_BADGE: Record<RecipeStatus, { label: string; tone: BadgeTone }> = {
  importing: { label: "수집 중", tone: "progress" },
  needs_review: { label: "확인 필요", tone: "warning" },
  saved: { label: "저장 완료", tone: "success" },
  failed: { label: "수집 실패", tone: "error" },
};

export const FIELD_LABELS: Record<string, string> = {
  title: "레시피명",
  baseServings: "기준 인분",
  cookMinutes: "조리 시간",
  ingredients: "재료",
  steps: "조리 순서",
};

/** Sources the extractor supports (Tooltip content). */
export const SUPPORTED_SOURCES = ["유튜브", "만개의 레시피", "네이버 블로그", "인스타그램"];

export function validateRecipeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "레시피 URL을 입력해 주세요.";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "http 또는 https로 시작하는 URL을 입력해 주세요.";
    return null;
  } catch {
    return "올바른 URL 형식이 아닙니다.";
  }
}
