import { Suspense } from "react";
import { LoadingState } from "@/components/States";
import { RecipesScreen } from "@/features/recipes/RecipesScreen";

export default function RecipesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecipesScreen />
    </Suspense>
  );
}
