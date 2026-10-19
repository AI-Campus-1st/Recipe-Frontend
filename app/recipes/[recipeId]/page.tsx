import { RecipeDetailScreen } from "@/features/recipes/RecipeDetailScreen";

export default async function RecipeDetailPage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
  return <RecipeDetailScreen recipeId={decodeURIComponent(recipeId)} />;
}
