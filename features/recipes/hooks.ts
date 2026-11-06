"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipesApi, sideDishesApi, unitsApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import type { ImportRecipeRequest, RecipeCategory, RecipeCreateRequest } from "@/lib/api/contracts";

const POLL_MS = 1500;

export function useRecipes(category: RecipeCategory | null) {
  return useQuery({
    queryKey: queryKeys.recipes(category),
    queryFn: () => recipesApi.list(category),
    // Keep polling while any recipe is still being collected.
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "importing") ? POLL_MS : false),
  });
}

export function useRecipe(id: string) {
  return useQuery({ queryKey: queryKeys.recipe(id), queryFn: () => recipesApi.detail(id) });
}

function useInvalidateRecipes() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recipesAll });
    void queryClient.invalidateQueries({ queryKey: queryKeys.today });
  };
}

export function useImportRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation({ mutationFn: (body: ImportRecipeRequest) => recipesApi.import(body), onSuccess: invalidate });
}

export function useRetryRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation({ mutationFn: (id: string) => recipesApi.retry(id), onSuccess: invalidate });
}

export function useRequestRevision() {
  const invalidate = useInvalidateRecipes();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => recipesApi.requestRevision(id, comment),
    onSuccess: invalidate,
  });
}

export function useConfirmRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation({ mutationFn: (id: string) => recipesApi.confirm(id), onSuccess: invalidate });
}

export function useDeleteRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation({ mutationFn: (id: string) => recipesApi.remove(id), onSuccess: invalidate });
}

/* ---------- Side dishes (F-04) ---------- */

export function useSideDishes(recipeId: string) {
  return useQuery({ queryKey: queryKeys.sideDishes(recipeId), queryFn: () => sideDishesApi.list(recipeId) });
}

/** Applies the modal selection as link/unlink calls on this recipe's pairs only. */
export function useSaveSideDishes(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ link, unlink }: { link: string[]; unlink: string[] }) => {
      for (const sideId of link) await sideDishesApi.link(recipeId, sideId);
      for (const sideId of unlink) await sideDishesApi.unlink(recipeId, sideId);
    },
    // Refetch even on failure so the list shows whichever pairs were saved.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.sideDishes(recipeId) }),
  });
}

/** AI candidates are suggestions only; nothing is linked until the user saves. */
export function useRecommendSideDishes(recipeId: string) {
  return useMutation({ mutationFn: () => sideDishesApi.recommend(recipeId) });
}

/* ---------- Manual recipe input & units (RECIPE-001) ---------- */

export function useCreateRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation({ mutationFn: (body: RecipeCreateRequest) => recipesApi.create(body), onSuccess: invalidate });
}

/** Units change only from the admin page, so the list is cached for the session. */
export function useUnits() {
  return useQuery({ queryKey: queryKeys.units, queryFn: () => unitsApi.list(), staleTime: Infinity, gcTime: Infinity });
}
