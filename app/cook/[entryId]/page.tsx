import { CookScreen } from "@/features/cooking/CookScreen";

export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ recipe?: string }>;
}) {
  const { entryId } = await params;
  const { recipe } = await searchParams;
  return <CookScreen key={`${entryId}:${recipe ?? ""}`} entryId={decodeURIComponent(entryId)} recipeId={recipe} />;
}
