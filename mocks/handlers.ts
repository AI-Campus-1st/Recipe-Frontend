import { delay, http, HttpResponse, type HttpResponseResolver } from "msw";
import type {
  ApplySubstituteRequest,
  CookingReviewRequest,
  GenerateMealPlanRequest,
  ImportRecipeRequest,
  RecipeCreateRequest,
  RegenerateMealRequest,
  RevisionRequest,
  SideDishRecommendationRequest,
} from "@/lib/api/contracts";
import { API_BASE_URL } from "@/lib/api/client";
import { currentScenario } from "./db";
import * as api from "./service";

const url = (path: string) => `${API_BASE_URL}${path}`;
const LATENCY_MS = process.env.NODE_ENV === "test" ? 0 : 350;

/** Wraps a resolver with scenario switching, latency and MockHttpError → HTTP error mapping. */
function route(resolver: HttpResponseResolver): HttpResponseResolver {
  return async (info) => {
    const scenario = currentScenario();
    await delay(scenario === "slow" ? 2500 : LATENCY_MS);
    if (scenario === "server-error") {
      return HttpResponse.json({ code: "server_error", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
    if (scenario === "unauthorized") {
      return HttpResponse.json({ code: "unauthorized", message: "로그인이 필요합니다." }, { status: 401 });
    }
    try {
      return await resolver(info);
    } catch (error) {
      if (error instanceof api.MockHttpError) return HttpResponse.json(error.body, { status: error.status });
      throw error;
    }
  };
}

async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export const handlers = [
  /* Recipes */
  http.get(
    url("/recipes"),
    route(({ request }) => HttpResponse.json(api.listRecipes(new URL(request.url).searchParams.get("category")))),
  ),
  /* RECIPE-001: manual input */
  http.post(
    url("/recipes"),
    route(async ({ request }) => HttpResponse.json(api.createRecipe(await body<RecipeCreateRequest>(request)), { status: 201 })),
  ),
  http.post(
    url("/recipes/import"),
    route(async ({ request }) => {
      const { recipe, restored } = api.importRecipe(await body<ImportRecipeRequest>(request));
      return HttpResponse.json(recipe, { status: restored ? 200 : 202 });
    }),
  ),
  http.get(url("/recipes/:id"), route(({ params }) => HttpResponse.json(api.getRecipe(String(params.id))))),
  http.post(url("/recipes/:id/retry"), route(({ params }) => HttpResponse.json(api.retryRecipe(String(params.id)), { status: 202 }))),
  http.post(
    url("/recipes/:id/revision-requests"),
    route(async ({ params, request }) =>
      HttpResponse.json(api.requestRevision(String(params.id), (await body<RevisionRequest>(request)).comment), { status: 202 }),
    ),
  ),
  http.post(url("/recipes/:id/confirm"), route(({ params }) => HttpResponse.json(api.confirmRecipe(String(params.id))))),
  http.delete(
    url("/recipes/:id"),
    route(({ params }) => {
      api.deleteRecipe(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  /* Side dishes */
  http.get(url("/recipes/:id/side-dishes"), route(({ params }) => HttpResponse.json(api.listSideDishes(String(params.id))))),
  http.put(
    url("/recipes/:id/side-dishes/:sideId"),
    route(({ params }) => HttpResponse.json(api.linkSideDish(String(params.id), String(params.sideId)))),
  ),
  http.delete(
    url("/recipes/:id/side-dishes/:sideId"),
    route(({ params }) => {
      api.unlinkSideDish(String(params.id), String(params.sideId));
      return new HttpResponse(null, { status: 204 });
    }),
  ),
  http.post(
    url("/recipes/:id/side-dishes/recommendations"),
    route(async ({ params, request }) =>
      HttpResponse.json(api.recommendSideDishes(String(params.id), (await body<SideDishRecommendationRequest>(request)).limit)),
    ),
  ),

  /* Meal plans */
  http.get(url("/meal-plans/weeks/:weekStart"), route(({ params }) => HttpResponse.json(api.getWeeklyPlan(String(params.weekStart))))),
  http.get(url("/meal-plans/months/:month"), route(({ params }) => HttpResponse.json(api.getMonthSummary(String(params.month))))),
  http.post(
    url("/meal-plans/generate"),
    route(async ({ request }) => HttpResponse.json(api.generateMealPlan(await body<GenerateMealPlanRequest>(request)))),
  ),
  http.post(
    url("/meal-plans/entries/:id/regenerate"),
    route(async ({ params, request }) =>
      HttpResponse.json(api.regenerateMeal(String(params.id), (await body<RegenerateMealRequest>(request)).comment)),
    ),
  ),
  http.get(url("/meal-plans/entries/:id"), route(({ params }) => HttpResponse.json(api.getMealDetail(String(params.id))))),
  http.post(
    url("/meal-plans/entries/:id/complete"),
    route(({ params }) => HttpResponse.json(api.completeMeal(String(params.id)))),
  ),
  http.get(url("/meals/today"), route(() => HttpResponse.json(api.getTodayMeal()))),
  http.put(
    url("/cooking-logs/:id/review"),
    route(async ({ params, request }) => {
      const { rating, memo } = await body<CookingReviewRequest>(request);
      return HttpResponse.json(api.reviewCookingLog(String(params.id), rating, memo));
    }),
  ),

  /* Shopping list */
  http.get(url("/shopping-lists/:weekStart"), route(({ params }) => HttpResponse.json(api.getShoppingList(String(params.weekStart))))),
  http.patch(
    url("/shopping-lists/:weekStart/items/:itemId"),
    route(async ({ params, request }) => {
      const { checked } = await body<{ checked: boolean }>(request);
      return HttpResponse.json(api.setItemChecked(String(params.weekStart), decodeURIComponent(String(params.itemId)), !!checked));
    }),
  ),
  http.get(
    url("/shopping-lists/:weekStart/items/:itemId/substitutes"),
    route(({ params }) =>
      HttpResponse.json(api.getSubstituteOptions(String(params.weekStart), decodeURIComponent(String(params.itemId)))),
    ),
  ),
  http.post(
    url("/shopping-lists/:weekStart/items/:itemId/substitutes/apply"),
    route(async ({ params, request }) =>
      HttpResponse.json(
        api.applySubstitute(
          String(params.weekStart),
          decodeURIComponent(String(params.itemId)),
          await body<ApplySubstituteRequest>(request),
        ),
      ),
    ),
  ),

  /* Units (RECIPE-001) */
  http.get(url("/units"), route(() => HttpResponse.json(api.listUnits()))),
];
