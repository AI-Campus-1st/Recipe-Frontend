import type { RecipeCategory, RecipeIngredient } from "@/lib/api/contracts";

/** Deterministic seed data for mocks and tests. */

export interface RecipeFixture {
  id: string;
  title: string;
  sourceUrl: string;
  category: RecipeCategory;
  baseServings: number | null;
  cookMinutes: number | null;
  ingredients: Array<Omit<RecipeIngredient, "id" | "ingredientId">>;
  steps: string[];
  sideDishIds?: string[];
}

const ing = (name: string, quantity: number | null, unit: string | null) => ({ name, quantity, unit });

export const SAVED_RECIPES: RecipeFixture[] = [
  {
    id: "r-kimchi-rice",
    title: "김치볶음밥",
    sourceUrl: "https://www.10000recipe.com/recipe/6835511",
    category: "simple",
    baseServings: 1,
    cookMinutes: 20,
    ingredients: [ing("밥", 1, "공기"), ing("김치", 100, "g"), ing("대파", 0.5, "대"), ing("계란", 1, "개"), ing("식용유", 15, "ml")],
    steps: ["대파를 송송 썰어 기름에 볶아 파기름을 낸다.", "잘게 썬 김치를 넣고 3분간 볶는다.", "밥을 넣고 고루 볶은 뒤 계란 프라이를 올린다."],
    sideDishIds: ["r-cucumber"],
  },
  {
    id: "r-jeyuk",
    title: "제육볶음",
    sourceUrl: "https://www.youtube.com/watch?v=jeyuk001",
    category: "main",
    baseServings: 2,
    cookMinutes: 30,
    ingredients: [
      ing("돼지고기 앞다리살", 400, "g"),
      ing("양파", 1, "개"),
      ing("대파", 1, "대"),
      ing("고추장", 2, "큰술"),
      ing("고춧가루", 1, "큰술"),
      ing("간장", 1, "큰술"),
    ],
    steps: ["돼지고기에 양념을 넣고 10분간 재운다.", "양파와 대파를 썬다.", "센 불에 고기를 볶다가 채소를 넣고 마무리한다."],
    sideDishIds: ["r-spinach", "r-egg-roll"],
  },
  {
    id: "r-doenjang",
    title: "된장찌개",
    sourceUrl: "https://blog.naver.com/cook/doenjang",
    category: "soup",
    baseServings: 2,
    cookMinutes: 25,
    ingredients: [ing("된장", 2, "큰술"), ing("두부", 0.5, "모"), ing("애호박", 0.5, "개"), ing("양파", 0.5, "개"), ing("대파", 0.5, "대")],
    steps: ["물 500ml에 된장을 푼다.", "애호박과 양파를 넣고 끓인다.", "두부와 대파를 넣고 5분 더 끓인다."],
    sideDishIds: ["r-egg-roll"],
  },
  {
    id: "r-seaweed-soup",
    title: "소고기미역국",
    sourceUrl: "https://www.10000recipe.com/recipe/6900001",
    category: "soup",
    baseServings: 3,
    cookMinutes: 40,
    ingredients: [ing("건미역", 20, "g"), ing("소고기 국거리", 200, "g"), ing("국간장", 2, "큰술"), ing("참기름", 1, "큰술")],
    steps: ["미역을 30분간 불린다.", "참기름에 소고기를 볶는다.", "미역을 넣고 볶다가 물을 붓고 30분 끓인다."],
    sideDishIds: ["r-potato"],
  },
  {
    id: "r-cream-pasta",
    title: "크림 파스타",
    sourceUrl: "https://www.youtube.com/watch?v=pasta002",
    category: "main",
    baseServings: 2,
    cookMinutes: 25,
    ingredients: [ing("스파게티면", 200, "g"), ing("생크림", 300, "ml"), ing("버터", 20, "g"), ing("베이컨", 100, "g"), ing("양파", 0.5, "개")],
    steps: ["면을 8분간 삶는다.", "버터에 베이컨과 양파를 볶는다.", "생크림을 붓고 졸인 뒤 면을 넣어 버무린다."],
  },
  {
    id: "r-dakgalbi",
    title: "춘천 닭갈비",
    sourceUrl: "https://blog.naver.com/cook/dakgalbi",
    category: "main",
    baseServings: 3,
    cookMinutes: 50,
    ingredients: [ing("닭다리살", 600, "g"), ing("양배추", 0.25, "통"), ing("고구마", 1, "개"), ing("고추장", 3, "큰술"), ing("대파", 1, "대")],
    steps: ["닭고기를 양념에 30분 재운다.", "채소를 큼직하게 썬다.", "팬에 모두 넣고 20분간 볶는다."],
    sideDishIds: ["r-cucumber"],
  },
  {
    id: "r-bulgogi-set",
    title: "불고기 정식",
    sourceUrl: "https://www.10000recipe.com/recipe/6900002",
    category: "main",
    baseServings: 2,
    cookMinutes: 60,
    ingredients: [ing("소고기 불고기용", 300, "g"), ing("양파", 1, "개"), ing("당근", 0.5, "개"), ing("간장", 4, "큰술"), ing("설탕", 1, "큰술")],
    steps: ["고기에 간장, 설탕, 다진 마늘로 양념한다.", "30분 재운다.", "채소와 함께 볶는다."],
    sideDishIds: ["r-potato", "r-spinach"],
  },
  {
    id: "r-tuna-mayo",
    title: "참치마요 덮밥",
    sourceUrl: "https://www.youtube.com/watch?v=tuna003",
    category: "simple",
    baseServings: 1,
    cookMinutes: 10,
    ingredients: [ing("밥", 1, "공기"), ing("참치캔", 1, "캔"), ing("마요네즈", 2, "큰술"), ing("김가루", null, null)],
    steps: ["참치의 기름을 뺀다.", "마요네즈와 섞는다.", "밥 위에 올리고 김가루를 뿌린다."],
  },
  {
    id: "r-egg-roll",
    title: "계란말이",
    sourceUrl: "https://www.10000recipe.com/recipe/6900003",
    category: "side",
    baseServings: 2,
    cookMinutes: 15,
    ingredients: [ing("계란", 4, "개"), ing("대파", 0.25, "대"), ing("당근", 0.25, "개")],
    steps: ["계란을 풀고 다진 채소를 섞는다.", "약불에서 조금씩 말아 익힌다."],
  },
  {
    id: "r-spinach",
    title: "시금치나물",
    sourceUrl: "https://blog.naver.com/cook/spinach",
    category: "side",
    baseServings: 2,
    cookMinutes: 10,
    ingredients: [ing("시금치", 200, "g"), ing("국간장", 0.5, "큰술"), ing("참기름", 1, "작은술")],
    steps: ["시금치를 30초간 데친다.", "찬물에 헹궈 물기를 짠다.", "양념에 무친다."],
  },
  {
    id: "r-potato",
    title: "감자조림",
    sourceUrl: "https://www.10000recipe.com/recipe/6900004",
    category: "side",
    baseServings: 2,
    cookMinutes: 25,
    ingredients: [ing("감자", 2, "개"), ing("간장", 3, "큰술"), ing("설탕", 1, "큰술")],
    steps: ["감자를 깍둑썬다.", "간장 양념과 물을 넣고 졸인다."],
  },
  {
    id: "r-cucumber",
    title: "오이무침",
    sourceUrl: "https://blog.naver.com/cook/cucumber",
    category: "side",
    baseServings: 2,
    cookMinutes: 10,
    ingredients: [ing("오이", 1, "개"), ing("고춧가루", 1, "작은술"), ing("식초", 1, "큰술")],
    steps: ["오이를 얇게 썬다.", "양념과 함께 버무린다."],
  },
];

/** Templates the mock "extractor" returns for imported URLs. Some values are intentionally unknown. */
export const EXTRACTION_TEMPLATES: Array<Omit<RecipeFixture, "id" | "sourceUrl"> & { uncertainFields: string[] }> = [
  {
    title: "어묵볶음",
    category: "side",
    baseServings: 2,
    cookMinutes: null,
    ingredients: [ing("사각어묵", 3, "장"), ing("양파", 0.5, "개"), ing("간장", 1, "큰술")],
    steps: ["어묵을 썬다.", "양파와 함께 볶다가 간장으로 간한다."],
    uncertainFields: ["cookMinutes"],
  },
  {
    title: "닭가슴살 샐러드",
    category: "simple",
    baseServings: null,
    cookMinutes: 15,
    ingredients: [ing("닭가슴살", 1, "팩"), ing("양상추", null, null), ing("방울토마토", 6, "개")],
    steps: ["채소를 씻어 물기를 뺀다.", "닭가슴살을 찢어 올린다."],
    uncertainFields: ["baseServings", "ingredients"],
  },
  {
    title: "순두부찌개",
    category: "soup",
    baseServings: 2,
    cookMinutes: 20,
    ingredients: [],
    steps: ["고추기름을 낸다.", "순두부와 물을 넣고 끓인다."],
    uncertainFields: ["ingredients"],
  },
];

/** Re-extraction result after a revision request (fills what was missing). */
export const REVISED_INGREDIENTS: Array<Omit<RecipeIngredient, "id" | "ingredientId">> = [
  ing("순두부", 1, "봉"),
  ing("고춧가루", 1, "큰술"),
  ing("계란", 1, "개"),
  ing("대파", 0.5, "대"),
];

export const SUPPORTED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "10000recipe.com",
  "blog.naver.com",
  "m.blog.naver.com",
  "instagram.com",
];

export interface SubstituteRule {
  name: string;
  /** Multiplier on the original quantity; null when the amount cannot be confirmed. */
  factor: number | null;
  /** Unit of the substitute; null keeps the original unit. */
  unit: string | null;
  ratioLabel: string | null;
  tasteDifference: string;
  cookingChange: string | null;
  caution: string | null;
}

/** Mock "AI" substitute suggestions keyed by normalized ingredient name. */
export const SUBSTITUTE_RULES: Record<string, SubstituteRule[]> = {
  버터: [
    {
      name: "식용유",
      factor: 0.8,
      unit: "ml",
      ratioLabel: "버터 10g → 식용유 8ml",
      tasteDifference: "버터 특유의 고소한 풍미가 줄어듭니다.",
      cookingChange: null,
      caution: null,
    },
    {
      name: "마가린",
      factor: 1,
      unit: null,
      ratioLabel: "1 : 1",
      tasteDifference: "맛 차이가 거의 없습니다.",
      cookingChange: null,
      caution: "트랜스지방 함량을 확인하세요.",
    },
  ],
  생크림: [
    {
      name: "우유",
      factor: 1,
      unit: null,
      ratioLabel: "1 : 1",
      tasteDifference: "소스가 더 묽고 가벼운 맛이 납니다.",
      cookingChange: "농도를 맞추려면 2~3분 더 졸이세요.",
      caution: null,
    },
    {
      name: "무가당 두유",
      factor: null,
      unit: null,
      ratioLabel: null,
      tasteDifference: "콩 향이 약간 납니다.",
      cookingChange: "센 불에서 분리될 수 있어 약불로 데우세요.",
      caution: "필요량은 농도를 보며 조절해야 해 확정할 수 없습니다.",
    },
  ],
  돼지고기앞다리살: [
    {
      name: "닭다리살",
      factor: 1,
      unit: null,
      ratioLabel: "1 : 1",
      tasteDifference: "담백하고 기름기가 적습니다.",
      cookingChange: "닭고기는 속까지 완전히 익혀야 합니다.",
      caution: null,
    },
  ],
  대파: [
    {
      name: "쪽파",
      factor: 1,
      unit: null,
      ratioLabel: "1 : 1",
      tasteDifference: "향이 조금 더 순합니다.",
      cookingChange: null,
      caution: null,
    },
  ],
  시금치: [
    {
      name: "청경채",
      factor: 1,
      unit: null,
      ratioLabel: "1 : 1",
      tasteDifference: "아삭한 식감이 더해집니다.",
      cookingChange: "데치는 시간을 1분으로 늘리세요.",
      caution: null,
    },
  ],
  고춧가루: [
    {
      name: "고추장",
      factor: null,
      unit: null,
      ratioLabel: null,
      tasteDifference: "단맛과 감칠맛이 더해집니다.",
      cookingChange: "다른 양념의 간을 줄여야 합니다.",
      caution: "매운 정도가 달라 필요량을 확정할 수 없습니다.",
    },
  ],
  감자: [
    {
      name: "고구마",
      factor: 1,
      unit: null,
      ratioLabel: "1 : 1",
      tasteDifference: "단맛이 강해집니다.",
      cookingChange: "조리 시간이 5분 정도 짧아집니다.",
      caution: null,
    },
  ],
};
