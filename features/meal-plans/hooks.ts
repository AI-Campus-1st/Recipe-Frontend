"use client";

import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mealPlansApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import type { CookingReviewRequest, GenerateMealPlanRequest, ISODate } from "@/lib/api/contracts";

export function useWeeklyPlan(weekStart: ISODate) {
  return useQuery({ queryKey: queryKeys.week(weekStart), queryFn: () => mealPlansApi.week(weekStart) });
}

export function useMonthSummary(month: string) {
  return useQuery({ queryKey: queryKeys.month(month), queryFn: () => mealPlansApi.month(month) });
}

export function useMealDetail(entryId: string) {
  return useQuery({ queryKey: queryKeys.meal(entryId), queryFn: () => mealPlansApi.detail(entryId) });
}

export function useTodayMeal() {
  return useQuery({ queryKey: queryKeys.today, queryFn: () => mealPlansApi.today() });
}

/** Meal plan changes also change the shopping list, today's meal and cooking views. */
function useInvalidatePlans() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of [queryKeys.mealPlansAll, queryKeys.shoppingAll, queryKeys.today, queryKeys.mealAll, queryKeys.recipesAll]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
}

export const GENERATE_MUTATION_KEY = ["mealPlans", "generate"] as const;

export function useGenerateMealPlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationKey: GENERATE_MUTATION_KEY,
    mutationFn: (body: GenerateMealPlanRequest) => mealPlansApi.generate(body),
    onSettled: invalidate,
  });
}

/** True while a meal plan generation request is in flight anywhere in the app. */
export function useIsGenerating() {
  return useIsMutating({ mutationKey: GENERATE_MUTATION_KEY }) > 0;
}

export function useRegenerateMeal() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: ({ entryId, comment }: { entryId: string; comment?: string }) => mealPlansApi.regenerate(entryId, comment),
    onSuccess: invalidate,
  });
}

export function useCompleteMeal() {
  const invalidate = useInvalidatePlans();
  return useMutation({ mutationFn: (entryId: string) => mealPlansApi.complete(entryId), onSuccess: invalidate });
}

export function useReviewCookingLog() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: ({ logId, ...body }: CookingReviewRequest & { logId: string }) => mealPlansApi.review(logId, body),
    onSuccess: invalidate,
  });
}
