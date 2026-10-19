import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CookScreen } from "@/features/cooking/CookScreen";
import { HomeScreen } from "@/features/home/HomeScreen";
import { ShoppingScreen } from "@/features/shopping/ShoppingScreen";
import { API_BASE_URL } from "@/lib/api/client";
import { createSeed, resetDb } from "@/mocks/db";
import { server } from "@/mocks/server";
import { getTodayMeal } from "@/mocks/service";
import { renderWithProviders } from "../test-utils";

const itemNamed = async (name: string) => {
  const list = await screen.findByRole("list", { name: "재료 목록" });
  const label = within(list).getByText(name, { selector: "span" });
  return label.closest("li") as HTMLElement;
};

describe("ShoppingScreen", () => {
  it("shows needed amounts, the Coupang link and hides actions once prepared", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShoppingScreen />);
    const butter = await itemNamed("버터");
    expect(screen.getByRole("banner")).toHaveTextContent(/^장보기$/);
    const coupang = within(butter).getByRole("link", { name: /쿠팡 검색/ });
    expect(coupang).toHaveAttribute("href", "https://www.coupang.com/np/search?q=%EB%B2%84%ED%84%B0");
    expect(coupang).toHaveAttribute("target", "_blank");
    expect(within(butter).getByRole("button", { name: "대체 관리" })).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "장보기 요약" });
    const before = Number(within(summary).getByText(/^\d+$/).textContent);

    await user.click(within(butter).getByRole("checkbox"));
    await waitFor(() => expect(within(butter).queryByRole("link", { name: /쿠팡 검색/ })).not.toBeInTheDocument());
    expect(within(butter).queryByRole("button", { name: "대체 관리" })).not.toBeInTheDocument();
    await waitFor(() => expect(Number(within(summary).getByText(/^\d+$/).textContent)).toBe(before - 1));
  });

  it("applies a substitute and searches with the substitute name", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShoppingScreen />);
    await user.click(within(await itemNamed("버터")).getByRole("button", { name: "대체 관리" }));
    const dialog = screen.getByRole("dialog", { name: "대체 관리" });
    await user.click(await within(dialog).findByRole("radio", { name: /식용유/ }));
    await user.click(within(dialog).getByRole("button", { name: "이 메뉴에 적용" }));

    expect(await screen.findByText(/버터을\(를\) 식용유\(으\)로 바꿨어요/)).toBeInTheDocument();
    const oil = await itemNamed("식용유");
    expect(within(oil).getByText("대체 적용")).toBeInTheDocument();
    expect(within(oil).getByRole("link", { name: /쿠팡 검색/ })).toHaveAttribute(
      "href",
      "https://www.coupang.com/np/search?q=%EC%8B%9D%EC%9A%A9%EC%9C%A0",
    );
  });

  it("requires confirmation before applying an uncertain substitute", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShoppingScreen />);
    await user.click(within(await itemNamed("생크림")).getByRole("button", { name: "대체 관리" }));
    const dialog = screen.getByRole("dialog", { name: "대체 관리" });
    await user.click(await within(dialog).findByRole("radio", { name: /무가당 두유/ }));
    const apply = within(dialog).getByRole("button", { name: "이 메뉴에 적용" });
    expect(apply).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: /직접 확인하고 준비할게요/ }));
    expect(apply).toBeEnabled();
  });

  it("explains that the list appears after a meal plan is confirmed", async () => {
    resetDb(createSeed({ empty: true }));
    renderWithProviders(<ShoppingScreen />);
    expect(await screen.findByText("장보기 목록이 아직 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "주간 식단 보기" })).toHaveAttribute("href", "/weekly");
  });

  it("rolls back a check that failed to save", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${API_BASE_URL}/shopping-lists/:week/items/:id`, () =>
        HttpResponse.json({ code: "server_error", message: "저장 실패" }, { status: 500 }),
      ),
    );
    renderWithProviders(<ShoppingScreen />);
    const checkbox = within(await itemNamed("버터")).getByRole("checkbox");
    await user.click(checkbox);
    expect(await screen.findByRole("alert")).toHaveTextContent("준비 여부를 저장하지 못했어요.");
    expect(checkbox).not.toBeChecked();
  });
});

describe("Cooking", () => {
  it("completes once, then offers an optional review", async () => {
    const user = userEvent.setup();
    const { meal } = getTodayMeal();
    renderWithProviders(<CookScreen entryId={meal!.entry.id} />);

    await user.click(await screen.findByRole("button", { name: "요리 완료" }));
    const dialog = await screen.findByRole("dialog", { name: "요리 평가" });
    expect(within(dialog).getByRole("button", { name: "등록" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "스킵" }));

    expect(await screen.findByText(/요리 완료 ·/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "요리 완료" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "평가 남기기" })).toBeInTheDocument();
  });

  it("requires a rating before saving a review", async () => {
    const user = userEvent.setup();
    const { meal } = getTodayMeal();
    renderWithProviders(<CookScreen entryId={meal!.entry.id} />);
    await user.click(await screen.findByRole("button", { name: "요리 완료" }));
    const dialog = await screen.findByRole("dialog", { name: "요리 평가" });
    await user.type(within(dialog).getByLabelText(/한 줄 코멘트/), "메모만 남김");
    expect(within(dialog).getByRole("button", { name: "등록" })).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: "3점" }));
    expect(within(dialog).getByRole("button", { name: "등록" })).toBeEnabled();
  });

  it("saves a review", async () => {
    const user = userEvent.setup();
    const { meal } = getTodayMeal();
    renderWithProviders(<CookScreen entryId={meal!.entry.id} />);
    await user.click(await screen.findByRole("button", { name: "요리 완료" }));
    const dialog = await screen.findByRole("dialog", { name: "요리 평가" });
    await user.click(within(dialog).getByRole("radio", { name: "4점" }));
    await user.type(within(dialog).getByLabelText(/한 줄 코멘트/), "간이 딱 좋았다");
    await user.click(within(dialog).getByRole("button", { name: "등록" }));
    expect(await screen.findByText("평가를 등록했어요.")).toBeInTheDocument();
    expect(await screen.findByText("간이 딱 좋았다")).toBeInTheDocument();
  });
});

describe("HomeScreen", () => {
  it("shows today's recipe, ingredients and the cooking CTA", async () => {
    const user = userEvent.setup();
    const { meal } = getTodayMeal();
    renderWithProviders(<HomeScreen />);
    expect(await screen.findByRole("heading", { name: meal!.main.recipe.title! })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "조리 시작" })).toHaveAttribute("href", `/cook/${meal!.entry.id}`);
    await user.click(screen.getByRole("button", { name: "재료 정보" }));
    expect(screen.getByText(/계획 인분/)).toBeInTheDocument();
  });

  it("guides to create a meal plan and add recipes when there is nothing yet", async () => {
    resetDb(createSeed({ empty: true }));
    renderWithProviders(<HomeScreen />);
    expect(await screen.findByText("오늘 확정된 메뉴가 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "주간 식단 보기" })).toHaveAttribute("href", "/weekly");
    expect(screen.getByRole("link", { name: "식단 만들기" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "레시피 추가" }).length).toBeGreaterThan(0);
  });
});
