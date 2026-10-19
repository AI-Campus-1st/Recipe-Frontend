"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shoppingApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import type { ApplySubstituteRequest, ISODate, ShoppingList } from "@/lib/api/contracts";

export function useShoppingList(weekStart: ISODate) {
  return useQuery({ queryKey: queryKeys.shopping(weekStart), queryFn: () => shoppingApi.list(weekStart) });
}

export function useSubstituteOptions(weekStart: ISODate, itemId: string | null) {
  return useQuery({
    queryKey: queryKeys.substitutes(weekStart, itemId ?? ""),
    queryFn: () => shoppingApi.substitutes(weekStart, itemId as string),
    enabled: itemId !== null,
    staleTime: 0,
  });
}

export function useSetItemChecked(weekStart: ISODate) {
  const queryClient = useQueryClient();
  const key = queryKeys.shopping(weekStart);
  return useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) => shoppingApi.setChecked(weekStart, itemId, checked),
    // Optimistic toggle (applied synchronously so the checkbox never snaps back);
    // rolled back on failure so the list never shows an unsaved state.
    onMutate: async ({ itemId, checked }) => {
      const previous = queryClient.getQueryData<ShoppingList>(key);
      if (previous) {
        const items = previous.items.map((item) => (item.id === itemId ? { ...item, checked } : item));
        queryClient.setQueryData<ShoppingList>(key, {
          ...previous,
          items,
          neededCount: items.filter((item) => !item.checked).length,
        });
      }
      await queryClient.cancelQueries({ queryKey: key });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (list) => queryClient.setQueryData(key, list),
  });
}

export function useApplySubstitute(weekStart: ISODate) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: ApplySubstituteRequest & { itemId: string }) =>
      shoppingApi.applySubstitute(weekStart, itemId, body),
    onSuccess: (list) => {
      queryClient.setQueryData(queryKeys.shopping(weekStart), list);
      void queryClient.invalidateQueries({ queryKey: queryKeys.mealAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.today });
    },
  });
}
