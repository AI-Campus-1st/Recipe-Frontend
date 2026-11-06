import { expect, test, type Page } from "@playwright/test";

/** Critical flows against the MSW-mocked app (`NEXT_PUBLIC_API_MOCKING=enabled`). */

async function freshStart(page: Page, path = "/") {
  // `?scenario=default` reseeds the mock database so every test starts from the same fixtures.
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}scenario=default`);
}

test("add a recipe, confirm it, and see it saved", async ({ page }) => {
  await freshStart(page, "/recipes");
  await page.getByRole("button", { name: "레시피 추가" }).last().click();
  const dialog = page.getByRole("dialog", { name: "레시피 추가" });
  await dialog.getByLabel(/레시피 URL/).fill("https://www.10000recipe.com/recipe/e2e-1");
  await dialog.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText("레시피 수집을 시작했어요.", { exact: false })).toBeVisible();

  // Newest first: the imported recipe is the first list item.
  const item = page.getByRole("list").first().getByRole("listitem").first();
  await expect(item.getByText("수집 중")).toBeVisible();
  // Polling moves it to 확인 필요 once collection finishes. This fixture extracts no ingredients.
  await expect(item.getByText("확인 필요")).toBeVisible({ timeout: 10_000 });
  await item.getByRole("button", { name: "정보 확인하기" }).click();

  const review = page.getByRole("dialog", { name: "레시피 확인" });
  await expect(review.getByRole("button", { name: "확인 처리" })).toBeDisabled();
  await review.getByLabel(/수정 요청사항/).fill("재료 목록을 다시 확인해 주세요");
  await review.getByRole("button", { name: "수정사항 반영 요청" }).click();
  await expect(page.getByText("수정 요청을 보냈어요.", { exact: false })).toBeVisible();

  await expect(item.getByText("수집 중")).toBeVisible();
  await expect(item.getByText("확인 필요")).toBeVisible({ timeout: 10_000 });
  await item.getByRole("button", { name: "정보 확인하기" }).click();
  await page.getByRole("dialog", { name: "레시피 확인" }).getByRole("button", { name: "확인 처리" }).click();
  await expect(item.getByText("저장 완료")).toBeVisible();

  // Saved recipes open their detail screen.
  await page.getByRole("button", { name: "제육볶음 상세 보기" }).click();
  await expect(page).toHaveURL(/\/recipes\/r-jeyuk$/);
  await expect(page.getByRole("heading", { level: 2, name: "제육볶음" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "재료" })).toBeVisible();
});

test("generate a meal plan for next week", async ({ page }) => {
  await freshStart(page, "/weekly");
  // The header has no week navigation; weeks are picked from the month week strip.
  await page.getByRole("list", { name: /주차$/ }).getByRole("button", { name: /식단 없음$/ }).first().click();
  await expect(page.getByText("이번 주 식단이 없어요")).toBeVisible();
  await page.getByRole("button", { name: "주간 식단 생성" }).click();

  const dialog = page.getByRole("dialog", { name: "주간 식단 생성" });
  const switches = dialog.getByRole("switch");
  await expect(switches).toHaveCount(7);
  // Keep only the first two days on.
  for (let i = 2; i < 7; i += 1) await switches.nth(i).click();
  await dialog.getByRole("button", { name: "식단 생성" }).click();

  await expect(page.getByText("2일 식단을 생성했어요.")).toBeVisible();
  await expect(page.getByText("전체 생성 완료")).toBeVisible();
  const days = page.getByRole("list", { name: "날짜별 식단" }).getByRole("listitem");
  await expect(days.filter({ hasText: "식단 없음" })).toHaveCount(5);
});

test("day meal: create with an unchecked linked side, edit, undo completion, delete; past days locked", async ({ page }) => {
  // Friday 2026-11-06 so the seeded week has past, today and future days (Mon 제육볶음 is past, today 김치볶음밥).
  await page.clock.setFixedTime(new Date("2026-11-06T10:00:00"));
  await freshStart(page, "/weekly");
  const days = page.getByRole("list", { name: "날짜별 식단" }).getByRole("listitem");
  const monday = days.filter({ hasText: "11월 2일 (월)" });
  const today = days.filter({ hasText: "11월 6일 (금)" });
  // Idempotent: the card keeps its open state when it turns from empty to planned.
  const expandToday = async () => {
    const header = today.getByRole("button", { name: /11월 6일 \(금\)/ });
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  };

  // Past day: nothing can change.
  await monday.getByRole("button", { name: /11월 2일 \(월\)/ }).click();
  await expect(monday.getByRole("button", { name: "수정" })).toBeDisabled();
  await expect(monday.getByRole("button", { name: "삭제" })).toBeDisabled();

  // Delete today's meal.
  await expandToday();
  await today.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog", { name: "식단 삭제" }).getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("11월 6일 (금) 식단을 삭제했어요.")).toBeVisible();
  await expect(today).toContainText("식단 없음");

  // `하루 식단 생성`: 제육볶음 with one of its two linked sides unchecked.
  await page.getByRole("button", { name: "하루 식단 생성" }).click();
  const create = page.getByRole("dialog", { name: "하루 식단 생성" });
  await create.getByRole("button", { name: /11월 6일 \(금\)/ }).click();
  await create.getByRole("button", { name: "주 레시피 선택" }).click();
  await page.getByRole("dialog", { name: "주 레시피 선택" }).getByRole("button", { name: /제육볶음/ }).click();
  await expect(create.getByRole("checkbox", { name: /시금치나물/ })).toBeChecked();
  await create.getByRole("checkbox", { name: /계란말이/ }).uncheck();
  await create.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("11월 6일 (금) 식단을 저장했어요.")).toBeVisible();
  await expect(today).toContainText("제육볶음");
  await expandToday();
  await today.getByRole("button", { name: "곁들임 1개" }).click();
  await expect(today.getByRole("link", { name: "시금치나물" })).toBeVisible();
  await expect(today.getByRole("link", { name: "계란말이" })).toHaveCount(0);

  // `수정`: replace the main recipe; the shopping list follows.
  await today.getByRole("button", { name: "수정" }).click();
  const edit = page.getByRole("dialog", { name: "식단 수정" });
  await edit.getByRole("button", { name: "변경" }).click();
  await page.getByRole("dialog", { name: "주 레시피 선택" }).getByRole("button", { name: /참치마요 덮밥/ }).click();
  await edit.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("11월 6일 (금) 식단을 저장했어요.")).toBeVisible();
  await expect(today).toContainText("참치마요 덮밥");
  await page.getByRole("link", { name: "장보기" }).click();
  await expect(page.getByText("참치캔", { exact: true })).toBeVisible();

  // Complete it from the cooking screen, then `완료 취소` unlocks `수정`.
  await page.getByRole("link", { name: "주간 식단" }).click();
  await today.getByRole("link").first().click();
  await page.getByRole("button", { name: "요리 완료" }).click();
  // Escape instead of `스킵`: the Next dev issues badge overlaps that button on this viewport.
  await expect(page.getByRole("dialog", { name: "요리 평가" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "요리 평가" })).toHaveCount(0);
  await page.getByRole("link", { name: "주간 식단" }).click();
  await expandToday();
  await expect(today.getByRole("button", { name: "수정" })).toBeDisabled();
  await today.getByRole("button", { name: "완료 취소" }).click();
  await page.getByRole("dialog", { name: "요리 완료 취소" }).getByRole("button", { name: "완료 취소" }).click();
  await expect(page.getByText("11월 6일 (금) 식단의 요리 완료를 취소했어요.")).toBeVisible();
  await expect(today.getByRole("button", { name: "수정" })).toBeEnabled();
});

test("prepare ingredients and apply a substitute on the shopping list", async ({ page }) => {
  await freshStart(page, "/shopping");
  const summary = page.getByRole("region", { name: "장보기 요약" });
  await expect(summary).toContainText("필요한 재료");
  const butter = page.getByRole("listitem").filter({ has: page.getByText("버터", { exact: true }) });

  await expect(butter.getByRole("link", { name: /쿠팡 검색/ })).toHaveAttribute("href", /coupang\.com\/np\/search\?q=%EB%B2%84%ED%84%B0/);
  await butter.getByRole("button", { name: "대체 관리" }).click();
  const dialog = page.getByRole("dialog", { name: "대체 관리" });
  await dialog.getByRole("radio", { name: /식용유/ }).check();
  await dialog.getByRole("button", { name: "이 메뉴에 적용" }).click();
  await expect(page.getByText(/식용유\(으\)로 바꿨어요/)).toBeVisible();

  const oil = page.getByRole("listitem").filter({ has: page.getByText("식용유", { exact: true }) });
  await expect(oil.getByText("대체 적용")).toBeVisible();
  // Controlled checkbox: the optimistic cache update re-renders on the next tick, so click and then assert.
  const saved = page.waitForResponse((r) => r.url().includes("/shopping-lists/") && r.request().method() === "PATCH");
  await oil.getByRole("checkbox").click();
  await expect(oil.getByRole("checkbox")).toBeChecked();
  expect((await saved).ok()).toBe(true);
  await expect(oil.getByRole("link", { name: /쿠팡 검색/ })).toHaveCount(0);
  // Reload without `?scenario=` (which would reseed) to confirm the state persisted.
  await page.goto("/shopping");
  await expect(page.getByRole("listitem").filter({ has: page.getByText("식용유", { exact: true }) }).getByRole("checkbox")).toBeChecked();
});

test("start cooking from home, complete, and skip the review", async ({ page }) => {
  await freshStart(page, "/");
  await page.getByRole("link", { name: "조리 시작" }).click();
  await expect(page.getByRole("heading", { name: "조리 순서" })).toBeVisible();
  await page.getByRole("button", { name: "요리 완료" }).click();
  const review = page.getByRole("dialog", { name: "요리 평가" });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "스킵" }).click();
  await expect(page.getByText(/요리 완료 ·/)).toBeVisible();

  await page.getByRole("link", { name: "홈" }).click();
  await expect(page.getByLabel("요리 완료 상태")).toContainText("요리 완료");
});
