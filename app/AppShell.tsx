"use client";

import type { ReactNode } from "react";
import { BottomNavigation } from "@/components/BottomNavigation";
import { useShoppingList } from "@/features/shopping/hooks";
import { startOfWeek, todayISO } from "@/lib/date";

/** Mobile-dimension app frame (BASE.md §4.1): max 430px, centered, fixed bottom navigation. */
export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useShoppingList(startOfWeek(todayISO()));
  return (
    <div className="app-frame relative min-h-dvh bg-canvas">
      <main className="pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom)+24px)]">{children}</main>
      <BottomNavigation shoppingNeededCount={data?.neededCount} />
    </div>
  );
}
