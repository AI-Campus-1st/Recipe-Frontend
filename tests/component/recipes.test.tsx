import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AddRecipeModal } from "@/features/recipes/AddRecipeModal";
import { RecipeDetailScreen } from "@/features/recipes/RecipeDetailScreen";
import { RecipesScreen } from "@/features/recipes/RecipesScreen";
import { routerMock } from "../router-mock";
import { API_BASE_URL } from "@/lib/api/client";
import { server } from "@/mocks/server";
import { getTodayMeal } from "@/mocks/service";
import { renderWithProviders } from "../test-utils";

describe("AddRecipeModal", () => {
  it("validates the URL on submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddRecipeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/레시피 URL/), "ftp://example.com");
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("http 또는 https로 시작하는 URL을 입력해 주세요.")).toBeInTheDocument();
  });

  it("points to the existing recipe for duplicate sources, without saving a copy", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddRecipeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/레시피 URL/), "https://youtu.be/jeyuk001?si=share");
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByText(/이미 저장된 레시피예요:/)).toHaveTextContent("제육볶음");
    expect(screen.getByRole("button", { name: "기존 레시피 보기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "별도로 저장" })).not.toBeInTheDocument();
  });

  it("keeps the input when the request fails", async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_BASE_URL}/recipes/import`, () => HttpResponse.json({ code: "server_error", message: "서버 오류" }, { status: 500 })));
    renderWithProviders(<AddRecipeModal open onClose={() => {}} />);
    const input = screen.getByLabelText(/레시피 URL/);
    await user.type(input, "https://blog.naver.com/a/1");
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("레시피를 추가하지 못했어요.");
    expect(input).toHaveValue("https://blog.naver.com/a/1");
  });

  it("shows supported sources in a tooltip", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddRecipeModal open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "수집 가능한 출처" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("유튜브 · 만개의 레시피 · 네이버 블로그");
  });
});

describe("RecipeDetailScreen", () => {
  it("shows the saved recipe with base servings and previous reviews, without 요리 완료", async () => {
    renderWithProviders(<RecipeDetailScreen recipeId="r-jeyuk" />);
    expect(await screen.findByRole("heading", { level: 2, name: "제육볶음" })).toBeInTheDocument();
    expect(screen.getByText("기준 2인분")).toBeInTheDocument();
    expect(screen.getByText("돼지고기에 양념을 넣고 10분간 재운다.")).toBeInTheDocument();
    expect(screen.getByText("고추장을 조금 줄이면 더 좋을 듯")).toBeInTheDocument();
    expect(screen.getByText("400g")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "요리 완료" })).not.toBeInTheDocument();
  });

  it("shows an error for an unknown recipe", async () => {
    renderWithProviders(<RecipeDetailScreen recipeId="nope" />);
    expect(await screen.findByText("레시피을(를) 찾을 수 없습니다.")).toBeInTheDocument();
  });

  it("lists linked side dishes linking to their detail", async () => {
    renderWithProviders(<RecipeDetailScreen recipeId="r-jeyuk" />);
    const section = await screen.findByRole("region", { name: "곁들임 레시피" });
    expect(await within(section).findByRole("link", { name: /시금치나물/ })).toHaveAttribute("href", "/recipes/r-spinach");
    expect(within(section).getByRole("link", { name: /계란말이/ })).toHaveAttribute("href", "/recipes/r-egg-roll");
  });

  it("links and unlinks side dishes from the modal with search", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipeDetailScreen recipeId="r-jeyuk" />);
    const section = await screen.findByRole("region", { name: "곁들임 레시피" });
    await within(section).findByRole("link", { name: /시금치나물/ });
    await user.click(within(section).getByRole("button", { name: "곁들임 레시피 연결" }));

    const dialog = await screen.findByRole("dialog", { name: "곁들임 레시피 연결" });
    expect(await within(dialog).findByRole("checkbox", { name: /시금치나물/ })).toBeChecked();
    expect(within(dialog).queryByRole("checkbox", { name: /제육볶음/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox", { name: /시금치나물/ }));
    await user.type(within(dialog).getByLabelText(/레시피 검색/), "오이");
    expect(within(dialog).queryByRole("checkbox", { name: /계란말이/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox", { name: /오이무침/ }));
    await user.click(within(dialog).getByRole("button", { name: "연결" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await within(section).findByRole("link", { name: /오이무침/ })).toBeInTheDocument();
    expect(within(section).queryByRole("link", { name: /시금치나물/ })).not.toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /계란말이/ })).toBeInTheDocument();
  });

  it("selects an AI-recommended side dish", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipeDetailScreen recipeId="r-cream-pasta" />);
    const section = await screen.findByRole("region", { name: "곁들임 레시피" });
    expect(await within(section).findByText("연결된 곁들임 레시피가 없어요.")).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "곁들임 레시피 연결" }));

    const dialog = await screen.findByRole("dialog", { name: "곁들임 레시피 연결" });
    await user.click(within(dialog).getByRole("button", { name: "추천받기" }));
    const ai = within(dialog).getByRole("region", { name: "AI 곁들임 추천" });
    const [first] = await within(ai).findAllByRole("checkbox");
    await user.click(first);
    expect(first).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "연결" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await within(section).findAllByRole("link")).toHaveLength(1);
  });
});

describe("RecipesScreen", () => {
  it("lists recipes with status badges and filters by category", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipesScreen />);
    const review = await screen.findByRole("listitem", { name: "어묵볶음" });
    expect(within(review).getByText("확인 필요")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "이름 미확인 레시피" })).toHaveTextContent("수집 실패");

    await user.click(screen.getByRole("button", { name: "국" }));
    expect(await screen.findByRole("listitem", { name: "된장찌개" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "제육볶음" })).not.toBeInTheDocument();
  });

  it("filters the list by recipe name together with the category", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipesScreen />);
    await screen.findByRole("listitem", { name: "된장찌개" });
    const search = screen.getByRole("searchbox", { name: "레시피 이름 검색" });

    await user.type(search, "볶음");
    expect(screen.getByRole("listitem", { name: "제육볶음" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "어묵볶음" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "된장찌개" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "반찬" }));
    expect(await screen.findByRole("listitem", { name: "어묵볶음" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "제육볶음" })).not.toBeInTheDocument();
    expect(search).toHaveValue("볶음");

    await user.clear(search);
    await user.type(search, "없는요리");
    expect(screen.getByText("'없는요리' 이름의 레시피가 없어요")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "검색어 지우기" })[0]);
    expect(search).toHaveValue("");
    expect(await screen.findByRole("listitem", { name: "어묵볶음" })).toBeInTheDocument();
  });

  it("opens the detail screen only for saved recipes", async () => {
    const user = userEvent.setup();
    routerMock.push.mockClear();
    renderWithProviders(<RecipesScreen />);
    const saved = await screen.findByRole("listitem", { name: "제육볶음" });
    await user.click(within(saved).getByRole("button", { name: "제육볶음 상세 보기" }));
    expect(routerMock.push).toHaveBeenCalledWith("/recipes/r-jeyuk");

    const review = screen.getByRole("listitem", { name: "어묵볶음" });
    expect(within(review).queryByRole("button", { name: /상세 보기/ })).not.toBeInTheDocument();
  });

  it("confirms a reviewed recipe", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipesScreen />);
    const review = await screen.findByRole("listitem", { name: "어묵볶음" });
    await user.click(within(review).getByRole("button", { name: "정보 확인하기" }));
    const dialog = screen.getByRole("dialog", { name: "레시피 확인" });
    expect(within(dialog).getByText(/확인 필요/)).toBeInTheDocument(); // cook time is uncertain
    await user.click(within(dialog).getByRole("button", { name: "확인 처리" }));
    expect(await screen.findByText("레시피를 저장했어요.")).toBeInTheDocument();
    expect(await within(await screen.findByRole("listitem", { name: "어묵볶음" })).findByText("저장 완료")).toBeInTheDocument();
  });

  it("shows the server error on the field when a revision is sent without a comment", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipesScreen />);
    const review = await screen.findByRole("listitem", { name: "어묵볶음" });
    await user.click(within(review).getByRole("button", { name: "정보 확인하기" }));
    const dialog = screen.getByRole("dialog", { name: "레시피 확인" });
    await user.click(within(dialog).getByRole("button", { name: "수정사항 반영 요청" }));
    expect(await within(dialog).findByText("수정할 내용을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "레시피 확인" })).toBeInTheDocument();
    expect(screen.queryByText(/수정 요청을 보냈어요/)).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/수정 요청사항/), "조리 시간은 15분이에요");
    expect(within(dialog).queryByText("수정할 내용을 입력해 주세요.")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "수정사항 반영 요청" }));
    expect(await screen.findByText(/수정 요청을 보냈어요/)).toBeInTheDocument();
  });

  it("asks before deleting and removes the recipe", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipesScreen />);
    // 소고기미역국 only appears in last week's history.
    const item = await screen.findByRole("listitem", { name: "소고기미역국" });
    await user.click(within(item).getByRole("button", { name: "소고기미역국 삭제" }));
    const dialog = screen.getByRole("dialog", { name: "레시피 삭제" });
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("레시피를 삭제했어요.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "소고기미역국" })).not.toBeInTheDocument());
  });

  it("refuses to delete a recipe used by an upcoming meal", async () => {
    const user = userEvent.setup();
    const todayTitle = getTodayMeal().meal!.main.recipe.title!;
    renderWithProviders(<RecipesScreen />);
    const item = await screen.findByRole("listitem", { name: todayTitle });
    await user.click(within(item).getByRole("button", { name: `${todayTitle} 삭제` }));
    await user.click(within(screen.getByRole("dialog", { name: "레시피 삭제" })).getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("예정된 식단에 사용 중인 레시피는 삭제할 수 없습니다.");
    expect(screen.getByRole("listitem", { name: todayTitle })).toBeInTheDocument();
  });

  it("shows an error state with retry when loading fails", async () => {
    server.use(http.get(`${API_BASE_URL}/recipes`, () => HttpResponse.json({ code: "server_error", message: "서버 오류" }, { status: 500 })));
    renderWithProviders(<RecipesScreen />);
    expect(await screen.findByText("서버 오류")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
