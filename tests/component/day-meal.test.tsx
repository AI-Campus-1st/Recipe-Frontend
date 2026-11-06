import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeeklyScreen } from "@/features/meal-plans/WeeklyScreen";
import { API_BASE_URL } from "@/lib/api/client";
import { formatDateWithWeekday } from "@/lib/date";
import { createSeed, getDb, resetDb } from "@/mocks/db";
import * as api from "@/mocks/service";
import { server } from "@/mocks/server";
import { renderWithProviders } from "../test-utils";

/**
 * MEAL-001 day meal flows on the weekly screen. The clock is fixed to Friday 2026-11-06 so past/today/future
 * days are deterministic. Seed for that week: Mon 제육볶음, Tue 된장찌개, Thu 크림 파스타 (past),
 * Fri (today) 김치볶음밥 + 오이무침, Sat 춘천 닭갈비; Wed and Sun are empty.
 */
const TODAY = "2026-11-06";
const label = (date: string) => formatDateWithWeekday(date);
const escape = (value: string) => value.replace(/[()]/g, "\\$&");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
  resetDb(createSeed());
});
afterEach(() => vi.useRealTimers());

async function renderWeek() {
  const user = userEvent.setup();
  renderWithProviders(<WeeklyScreen />);
  // Present in both the empty-week state and the day list.
  await screen.findByRole("button", { name: "하루 식단 생성" }, { timeout: 5000 });
  const list = () => screen.getByRole("list", { name: "날짜별 식단" });
  const day = (date: string) => within(list()).getAllByRole("listitem").find((item) => item.textContent?.includes(label(date)))!;
  const expand = async (date: string) => user.click(within(day(date)).getByRole("button", { name: new RegExp(escape(label(date))) }));
  return { user, day, expand };
}

describe("day cards (MEAL-001)", () => {
  it("applies the button rules for past, empty and planned days", async () => {
    const { day, expand } = await renderWeek();

    // Past empty day: nothing to open.
    expect(within(day("2026-11-04")).queryByRole("button")).not.toBeInTheDocument();

    // Future empty day: AI 추천 + 직접 생성.
    await expand("2026-11-08");
    expect(within(day("2026-11-08")).getByRole("button", { name: "AI 추천" })).toBeInTheDocument();
    expect(within(day("2026-11-08")).getByRole("button", { name: "직접 생성" })).toBeInTheDocument();

    // Past meal: 수정·삭제 disabled.
    await expand("2026-11-02");
    expect(within(day("2026-11-02")).getByRole("button", { name: "수정" })).toBeDisabled();
    expect(within(day("2026-11-02")).getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(within(day("2026-11-02")).getByText("지난 날짜의 식단은 바꿀 수 없어요.")).toBeInTheDocument();

    // Today's meal: 수정·삭제 only, no AI change and no cooking-time text.
    await expand(TODAY);
    expect(within(day(TODAY)).getByRole("button", { name: "수정" })).toBeEnabled();
    expect(within(day(TODAY)).getByRole("button", { name: "삭제" })).toBeEnabled();
    expect(within(day(TODAY)).queryByRole("button", { name: "완료 취소" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "식단 변경" })).not.toBeInTheDocument();
    expect(screen.queryByText(/조리 시간 기준/)).not.toBeInTheDocument();
  });

  it("deletes a meal after confirmation", async () => {
    const { user, day, expand } = await renderWeek();
    await expand(TODAY);
    await user.click(within(day(TODAY)).getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("dialog", { name: "식단 삭제" });
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(await screen.findByText(`${label(TODAY)} 식단을 삭제했어요.`)).toBeInTheDocument();
    await waitFor(() => expect(day(TODAY)).toHaveTextContent("식단 없음"));
    expect(getDb().entries.some((e) => e.date === TODAY)).toBe(false);
  });

  it("requires 완료 취소 before editing a completed meal and warns about reviews", async () => {
    const entry = api.getWeeklyPlan(TODAY).entries.find((e) => e.date === TODAY)!;
    const { cookingLogs } = api.completeMeal(entry.id);
    api.reviewCookingLog(cookingLogs[0].cookingLogId, 4, null);
    const { user, day, expand } = await renderWeek();

    await expand(TODAY);
    expect(within(day(TODAY)).getByRole("button", { name: "수정" })).toBeDisabled();
    expect(within(day(TODAY)).getByText("완료 취소 후 수정할 수 있어요.")).toBeInTheDocument();
    await user.click(within(day(TODAY)).getByRole("button", { name: "완료 취소" }));

    const dialog = screen.getByRole("dialog", { name: "요리 완료 취소" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("별점·메모도 함께 지워져요");
    await user.click(within(dialog).getByRole("button", { name: "완료 취소" }));

    expect(await screen.findByText(`${label(TODAY)} 식단의 요리 완료를 취소했어요.`)).toBeInTheDocument();
    await waitFor(() => expect(within(day(TODAY)).getByRole("button", { name: "수정" })).toBeEnabled());
    expect(getDb().logs.some((l) => l.entryId === entry.id)).toBe(false);
  });
});

describe("DayMealModal (MEAL-001)", () => {
  it("creates a meal for a chosen date, saving only checked sides", async () => {
    const { user, day } = await renderWeek();
    await user.click(screen.getByRole("button", { name: "하루 식단 생성" }));
    const dialog = screen.getByRole("dialog", { name: "하루 식단 생성" });

    // Today ~ +6 days.
    const chips = within(within(dialog).getByRole("group", { name: "날짜 선택" })).getAllByRole("button");
    expect(chips).toHaveLength(7);
    expect(chips[0]).toHaveTextContent(label(TODAY));
    expect(chips[6]).toHaveTextContent(label("2026-11-12"));
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: new RegExp(escape(label("2026-11-08"))) }));
    await user.click(within(dialog).getByRole("button", { name: "주 레시피 선택" }));
    const picker = screen.getByRole("dialog", { name: "주 레시피 선택" });
    await user.click(await within(picker).findByRole("button", { name: /제육볶음/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "주 레시피 선택" })).not.toBeInTheDocument());

    // Linked sides appear checked; uncheck one, then add another recipe as a side.
    const spinach = await within(dialog).findByRole("checkbox", { name: /시금치나물/ });
    const eggRoll = within(dialog).getByRole("checkbox", { name: /계란말이/ });
    expect(spinach).toBeChecked();
    expect(eggRoll).toBeChecked();
    await user.click(eggRoll);
    await user.click(within(dialog).getByRole("button", { name: "곁들임 추가" }));
    const sidePicker = screen.getByRole("dialog", { name: "곁들임 추가" });
    expect(within(sidePicker).getByRole("button", { name: /제육볶음/ })).toBeDisabled();
    await user.click(within(sidePicker).getByRole("button", { name: /감자조림/ }));
    expect(await within(dialog).findByRole("checkbox", { name: /감자조림/ })).toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "인분 늘리기" }));
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(await screen.findByText(`${label("2026-11-08")} 식단을 저장했어요.`)).toBeInTheDocument();
    const saved = getDb().entries.find((e) => e.date === "2026-11-08")!;
    expect(saved).toMatchObject({ mainRecipeId: "r-jeyuk", sideRecipeIds: ["r-spinach", "r-potato"], servings: 2, cookMinutesLimit: 360 });
    await waitFor(() => expect(day("2026-11-08")).not.toHaveTextContent("식단 없음"));
  });

  it("switches to edit mode for a planned date and blocks completed dates", async () => {
    const saturday = api.getWeeklyPlan(TODAY).entries.find((e) => e.date === "2026-11-07")!;
    api.completeMeal(saturday.id);
    const { user } = await renderWeek();
    await user.click(screen.getByRole("button", { name: "하루 식단 생성" }));
    const dialog = screen.getByRole("dialog", { name: "하루 식단 생성" });

    expect(await within(dialog).findByRole("button", { name: new RegExp(escape(label("2026-11-07"))) })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: new RegExp(escape(label(TODAY))) }));
    expect(screen.getByRole("dialog", { name: "식단 수정" })).toBe(dialog);
    expect(within(dialog).getByText("김치볶음밥")).toBeInTheDocument();
    expect(await within(dialog).findByRole("checkbox", { name: /오이무침/ })).toBeChecked();
  });

  it("edits a meal from its card by replacing the main recipe", async () => {
    const { user, day, expand } = await renderWeek();
    await expand(TODAY);
    await user.click(within(day(TODAY)).getByRole("button", { name: "수정" }));
    const dialog = screen.getByRole("dialog", { name: "식단 수정" });
    expect(within(dialog).queryByRole("group", { name: "날짜 선택" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "변경" }));
    const picker = screen.getByRole("dialog", { name: "주 레시피 선택" });
    await user.click(await within(picker).findByRole("button", { name: /참치마요 덮밥/ }));
    // 김치볶음밥's linked side goes with it.
    await waitFor(() => expect(within(dialog).queryByRole("checkbox", { name: /오이무침/ })).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(await screen.findByText(`${label(TODAY)} 식단을 저장했어요.`)).toBeInTheDocument();
    expect(getDb().entries.find((e) => e.date === TODAY)).toMatchObject({ mainRecipeId: "r-tuna-mayo", sideRecipeIds: [] });
  });

  it("shows the server's 409 message and keeps the form", async () => {
    server.use(
      http.put(`${API_BASE_URL}/meal-plans/days/:date`, () =>
        HttpResponse.json({ code: "conflict", message: "지난 날짜의 식단은 변경할 수 없습니다." }, { status: 409 }),
      ),
    );
    const { user, day, expand } = await renderWeek();
    await expand(TODAY);
    await user.click(within(day(TODAY)).getByRole("button", { name: "수정" }));
    const dialog = screen.getByRole("dialog", { name: "식단 수정" });
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(await screen.findByText("식단을 저장하지 못했어요. 지난 날짜의 식단은 변경할 수 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "식단 수정" })).toBeInTheDocument();
    expect(within(dialog).getByText("김치볶음밥")).toBeInTheDocument();
  });
});

describe("RecipePickerModal (MEAL-001)", () => {
  async function openPicker() {
    const { user } = await renderWeek();
    await user.click(screen.getByRole("button", { name: "하루 식단 생성" }));
    await user.click(screen.getByRole("button", { name: "주 레시피 선택" }));
    return { user, picker: screen.getByRole("dialog", { name: "주 레시피 선택" }) };
  }
  const names = (picker: HTMLElement) =>
    within(within(picker).getByRole("list", { name: "레시피 목록" }))
      .getAllByRole("button")
      .map((b) => b.querySelector("span span")?.textContent);

  it("combines category, name search and sorting", async () => {
    const { user, picker } = await openPicker();
    await within(picker).findByRole("list", { name: "레시피 목록" });
    // Only saved recipes; 확인 필요 / 수집 실패 recipes are not offered.
    expect(within(picker).queryByRole("button", { name: /어묵볶음/ })).not.toBeInTheDocument();

    // Default: least recently cooked — recipes cooked last week come last, the most recent one at the end.
    expect(within(picker).getByRole("combobox", { name: "정렬" })).toHaveValue("least_recent");
    expect(names(picker).slice(-3)).toEqual(["제육볶음", "소고기미역국", "불고기 정식"]);

    await user.selectOptions(within(picker).getByRole("combobox", { name: "정렬" }), "rating");
    expect(names(picker).slice(0, 2)).toEqual(["불고기 정식", "제육볶음"]);

    await user.click(within(picker).getByRole("button", { name: "반찬" }));
    expect(names(picker)).toEqual(expect.arrayContaining(["계란말이", "시금치나물", "감자조림", "오이무침"]));
    expect(names(picker)).not.toContain("제육볶음");

    await user.type(within(picker).getByRole("searchbox", { name: "레시피 이름 검색" }), "시금치");
    expect(names(picker)).toEqual(["시금치나물"]);

    await user.type(within(picker).getByRole("searchbox", { name: "레시피 이름 검색" }), "없는이름");
    expect(within(picker).getByText("조건에 맞는 레시피가 없어요")).toBeInTheDocument();
  });

  it("shows an empty state with a way to add recipes", async () => {
    resetDb(createSeed({ empty: true }));
    const { picker } = await openPicker();
    expect(await within(picker).findByText("저장된 레시피가 없어요")).toBeInTheDocument();
    expect(within(picker).getByRole("link", { name: "레시피 추가하러 가기" })).toHaveAttribute("href", "/recipes");
  });
});
