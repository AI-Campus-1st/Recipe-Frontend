import { WeeklyScreen } from "@/features/meal-plans/WeeklyScreen";

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<{ create?: string }> }) {
  const { create } = await searchParams;
  return <WeeklyScreen openGenerateForToday={create === "today"} />;
}
