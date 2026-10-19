import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { GenerateMealPlanModal } from "@/features/meal-plans/GenerateMealPlanModal";
import { WeeklyScreen } from "@/features/meal-plans/WeeklyScreen";
import { API_BASE_URL } from "@/lib/api/client";
import { addDays, formatDateWithWeekday, monthOf, startOfWeek, todayISO, weekDates } from "@/lib/date";
import { server } from "@/mocks/server";
import { renderWithProviders } from "../test-utils";

const nextWeek = addDays(startOfWeek(todayISO()), 7);

describe("GenerateMealPlanModal", () => {
  it("disables generation and explains why when every day is off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GenerateMealPlanModal open onClose={() => {}} weekStart={nextWeek} plannedDates={[]} />);

    const submit = screen.getByRole("button", { name: "식단 생성" });
    expect(submit).toBeEnabled();

    for (const date of weekDates(nextWeek)) {
      await user.click(screen.getByRole("switch", { name: `${formatDateWithWeekday(date)} 요리 여부` }));
    }
    expect(submit).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("요리할 날짜를 하나 이상 선택해 주세요.");
  });

  it("disables the servings stepper for days that are off and keeps servings ≥ 1", async () => {
    const user = userEvent.setup();
    const label = formatDateWithWeekday(nextWeek);
    renderWithProviders(<GenerateMealPlanModal open onClose={() => {}} weekStart={nextWeek} plannedDates={[]} />);

    const decrease = screen.getByRole("button", { name: `${label} 인분 줄이기` });
    expect(decrease).toBeDisabled(); // already at the minimum of 1
    await user.click(screen.getByRole("button", { name: `${label} 인분 늘리기` }));
    expect(within(screen.getByRole("group", { name: `${label} 인분` })).getByText("2인분")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: `${label} 요리 여부` }));
    expect(screen.getByRole("button", { name: `${label} 인분 늘리기` })).toBeDisabled();
  });

  it("sends only enabled days with default cooking times", async () => {
    const user = userEvent.setup();
    let requestBody: unknown;
    server.use(
      http.post(`${API_BASE_URL}/meal-plans/generate`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ results: [], plan: { weekStart: nextWeek, weekEnd: addDays(nextWeek, 6), entries: [], generation: { status: "complete", failedDates: [] } } });
      }),
    );
    renderWithProviders(
      <GenerateMealPlanModal open onClose={() => {}} weekStart={nextWeek} plannedDates={[]} initialDates={[nextWeek, addDays(nextWeek, 5)]} />,
    );
    await user.click(screen.getByRole("button", { name: "식단 생성" }));
    await waitFor(() =>
      expect(requestBody).toEqual({
        days: [
          { date: nextWeek, servings: 1, cookMinutes: 30 },
          { date: addDays(nextWeek, 5), servings: 1, cookMinutes: 70 },
        ],
      }),
    );
  });

  it("keeps the modal open and reports a server error", async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_BASE_URL}/meal-plans/generate`, () => HttpResponse.json({ code: "server_error", message: "AI 오류" }, { status: 500 })));
    renderWithProviders(<GenerateMealPlanModal open onClose={() => {}} weekStart={nextWeek} plannedDates={[]} />);
    await user.click(screen.getByRole("button", { name: "식단 생성" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("기존 식단은 유지돼요");
    expect(screen.getByRole("dialog", { name: "주간 식단 생성" })).toBeInTheDocument();
  });
});

describe("WeeklyScreen", () => {
  it("shows every day of the week and changes one meal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WeeklyScreen />);
    const list = await screen.findByRole("list", { name: "날짜별 식단" });
    expect(screen.getByRole("banner")).toHaveTextContent(/^주간 식단$/);
    expect(screen.queryByRole("button", { name: "다음 주" })).not.toBeInTheDocument();
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText("전체 생성 완료")).toBeInTheDocument();

    const monday = formatDateWithWeekday(startOfWeek(todayISO()));
    await user.click(screen.getByRole("button", { name: new RegExp(monday.replace(/[()]/g, "\\$&")) }));
    await user.click(screen.getByRole("button", { name: "식단 변경" }));
    const dialog = screen.getByRole("dialog", { name: "식단 변경" });
    expect(within(dialog).getByText("제육볶음")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "변경 요청" }));

    expect(await screen.findByText(/식단을 .+\(으\)로 변경했어요/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows an empty state with a generation CTA for a week without meals", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WeeklyScreen />);
    await screen.findByRole("list", { name: "날짜별 식단" });
    // Weeks are changed from the month week strip (the header has no week navigation).
    const target = addDays(startOfWeek(todayISO()), 14);
    if (monthOf(target) !== monthOf(startOfWeek(todayISO()))) await user.click(screen.getByRole("button", { name: "다음 달" }));
    const [, m, d] = target.split("-").map(Number);
    await user.click(await screen.findByRole("button", { name: new RegExp(`${m}월 ${d}일부터`) }));
    expect(await screen.findByText("이번 주 식단이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주간 식단 생성" })).toBeInTheDocument();
  });
});
