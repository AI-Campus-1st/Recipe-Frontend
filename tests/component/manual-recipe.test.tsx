import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddRecipeModal } from "@/features/recipes/AddRecipeModal";
import { ManualRecipeModal } from "@/features/recipes/ManualRecipeModal";
import { API_BASE_URL } from "@/lib/api/client";
import type { RecipeCreateRequest } from "@/lib/api/contracts";
import { server } from "@/mocks/server";
import { routerMock } from "../router-mock";
import { renderWithProviders } from "../test-utils";

/** Records `POST /recipes` bodies while letting the mock handler answer. */
function capturePosts() {
  const bodies: RecipeCreateRequest[] = [];
  server.events.on("request:start", async ({ request }) => {
    if (request.method === "POST" && new URL(request.url).pathname === "/recipes") bodies.push(await request.clone().json());
  });
  return bodies;
}

afterEach(() => server.events.removeAllListeners("request:start"));

const dialog = () => screen.getByRole("dialog", { name: "레시피 직접 입력" });

describe("ManualRecipeModal (RECIPE-001)", () => {
  it("opens from 직접 입력 in the add-recipe modal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddRecipeModal open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "직접 입력" }));
    expect(await screen.findByRole("dialog", { name: "레시피 직접 입력" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "레시피 추가" })).not.toBeInTheDocument());
  });

  it("does not submit without a title or ingredients and shows the messages under the fields", async () => {
    const user = userEvent.setup();
    const bodies = capturePosts();
    renderWithProviders(<ManualRecipeModal open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByLabelText(/레시피명/)).toHaveAccessibleDescription("레시피명을 입력해 주세요.");
    expect(screen.getByText("재료를 1개 이상 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText(/레시피명/)).toHaveFocus();
    expect(bodies).toHaveLength(0);
  });

  it("saves number + unit amounts and one step per line, then opens the highlighted recipe", async () => {
    const user = userEvent.setup();
    const bodies = capturePosts();
    const onClose = vi.fn();
    renderWithProviders(<ManualRecipeModal open onClose={onClose} />);
    await screen.findByRole("option", { name: "큰술" });

    await user.type(screen.getByLabelText(/레시피명/), "마늘 소스");
    await user.selectOptions(screen.getByLabelText("카테고리"), "소스");
    await user.type(screen.getByLabelText("조리 시간(분)"), "5");
    await user.type(screen.getByLabelText("재료 1 이름"), "다진 마늘");
    await user.type(screen.getByLabelText("재료 1 수량"), "2");
    await user.selectOptions(screen.getByLabelText("재료 1 단위"), "큰술");
    await user.click(screen.getByRole("button", { name: "재료 추가" }));
    await user.type(screen.getByLabelText("재료 2 이름"), "소금");
    await user.selectOptions(screen.getByLabelText("재료 2 단위"), "약간");
    expect(screen.getByLabelText("재료 2 수량")).toBeDisabled();
    await user.type(screen.getByLabelText(/조리 순서/), "1. 마늘을 다진다.{enter}{enter}2) 마요네즈와 섞는다.{enter}③ 소금으로 간한다.");
    expect(screen.getByText("3단계")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith(expect.stringMatching(/^\/recipes\?highlight=r-\d+$/)));
    expect(bodies).toEqual([
      {
        title: "마늘 소스",
        category: "sauce",
        cookMinutes: 5,
        ingredients: [{ name: "다진 마늘", amount: "2큰술" }, { name: "소금", amount: "약간" }],
        steps: ["마늘을 다진다.", "마요네즈와 섞는다.", "소금으로 간한다."],
      },
    ]);
    expect(screen.getByText("레시피를 저장했어요.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    // Types a whole form: ~3s alone, slower when the suite runs in parallel.
  }, 15_000);

  it("shows server field errors next to the field and keeps the input", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE_URL}/recipes`, () =>
        HttpResponse.json(
          { code: "validation_error", message: "입력값 오류", fieldErrors: { sourceUrl: "참고 URL을 확인해 주세요." } },
          { status: 422 },
        ),
      ),
    );
    const onClose = vi.fn();
    renderWithProviders(<ManualRecipeModal open onClose={onClose} />);
    await user.type(screen.getByLabelText(/레시피명/), "김치볶음밥");
    await user.type(screen.getByLabelText("재료 1 이름"), "김치");
    await user.type(screen.getByLabelText(/참고 URL/), "https://example.com/a");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("참고 URL을 확인해 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText(/레시피명/)).toHaveValue("김치볶음밥");
    expect(screen.getByLabelText("재료 1 이름")).toHaveValue("김치");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the input and shows an error toast when saving fails", async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_BASE_URL}/recipes`, () => HttpResponse.json({ code: "server_error", message: "서버 오류" }, { status: 500 })));
    renderWithProviders(<ManualRecipeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/레시피명/), "김치볶음밥");
    await user.type(screen.getByLabelText("재료 1 이름"), "김치");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText(/레시피를 저장하지 못했어요/)).toBeInTheDocument();
    expect(screen.getByLabelText(/레시피명/)).toHaveValue("김치볶음밥");
  });

  it("asks before closing when something was typed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ManualRecipeModal open onClose={onClose} />);

    await user.click(within(dialog()).getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText(/레시피명/), "김치");
    await user.click(within(dialog()).getByRole("button", { name: "닫기" }));
    const confirm = await screen.findByRole("dialog", { name: "작성을 그만할까요?" });
    expect(confirm).toHaveTextContent("작성 중인 내용이 사라져요.");
    await user.click(within(confirm).getByRole("button", { name: "계속 작성" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/레시피명/)).toHaveValue("김치");

    await user.click(within(dialog()).getByRole("button", { name: "취소" }));
    await user.click(within(await screen.findByRole("dialog", { name: "작성을 그만할까요?" })).getByRole("button", { name: "나가기" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("removes ingredient rows, keeping at least one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ManualRecipeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText("재료 1 이름"), "양파");
    await user.click(screen.getByRole("button", { name: "재료 추가" }));
    await user.type(screen.getByLabelText("재료 2 이름"), "대파");
    await user.click(screen.getByRole("button", { name: "재료 1 삭제" }));
    expect(screen.getByLabelText("재료 1 이름")).toHaveValue("대파");
    await user.click(screen.getByRole("button", { name: "재료 1 삭제" }));
    expect(screen.getByLabelText("재료 1 이름")).toHaveValue("");
  });
});
