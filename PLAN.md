# Frontend 작업 계획

> 근거 문서: `docs/product/DEFINITION.md`, `docs/product/FEATURE_SPEC.md`, `docs/design/BASE.md`, `docs/design/pages/*.md`, `docs/design/components/*.md`, `docs/design/SCREEN.md`
> 백엔드는 나중에 구현 → 모든 데이터는 **MSW mock API**로 제공하고, 실제 FastAPI 연동 시 UI 변경 없이 교체할 수 있게 한다.

---

## 0. 문서 우선순위 (충돌 시)

1. `FEATURE_SPEC.md` (도메인 규칙)
2. `docs/design/pages/*.md`, `components/*.md` (최신·구체적인 화면 명세)
3. `BASE.md` (토큰·형태)
4. `SCREEN.md` (초기 초안 — 위 문서와 다르면 위 문서를 따른다)

주요 충돌과 적용 방향:

| 항목 | SCREEN.md (초안) | 적용 기준 |
|---|---|---|
| 식단 상태 | `초안 → 확정` 2단계, 초안 검토 화면(PLAN-03), 확정 다이얼로그 | **생성 즉시 확정**, draft 없음 (FEATURE_SPEC §2, WEEKLY.md) → PLAN-03·DIALOG-01 제외 |
| 장보기 구매 수량 | 인라인 편집 구매 수량 | **구매 수량 필드 없음**, 준비 여부 체크만 (SHOPPING.md) |
| 재료 사용 출처 상세(SHOP-02) | 바텀시트 제공 | **레시피 출처 목록 표시 안 함** (SHOPPING.md) → 제외 (데이터는 보존) |
| 메뉴 변경 요청 | 필수 입력 + 후보 목록 선택 | **선택 입력**, `변경 요청` 제출 → 결과 반영 (WEEKLY.md, FEATURE_SPEC F-03) |
| 레시피 추출 결과 검토 | 별도 편집 화면(RECIPE-03) | 목록의 `확인 필요` 상태 → **수정/반영 Modal** (RECIPE.md) |
| 레시피 카테고리 | P1 | `메인/간단/국/반찬/소스` 카테고리 탭 제공 (RECIPE.md) |

---

## 1. 기술 스택 & 초기 세팅

`frontend/CLAUDE.md` 기준.

- Next.js (App Router) + React + TypeScript `strict`
- Tailwind CSS — `BASE.md §5` CSS 변수를 `globals.css`에 정의하고 Tailwind theme에서 변수 참조 (컴포넌트에서 값 재정의 금지)
- Pretendard 폰트 (CDN 또는 `next/font/local`)
- 서버 상태: TanStack Query (로딩/에러/재시도/무효화 일관 처리) — UI 상태와 분리
- Mock: MSW (브라우저 worker + Node server for Vitest). `NEXT_PUBLIC_API_MOCKING=enabled`일 때만 활성화, 프로덕션 미사용
- 테스트: Vitest + React Testing Library, Playwright (E2E)
- 패키지 매니저: pnpm (현재 미설치 → `corepack enable`로 활성화)
- 스크립트: `dev`, `build`, `test`, `typecheck`, `lint`, `test:e2e`

## 2. 디렉터리 구조

```text
frontend/
├── app/
│   ├── layout.tsx              # AppShell (430px 캔버스 + BottomNav + ToastProvider + MSW 부트)
│   ├── page.tsx                # HOME-01 홈
│   ├── weekly/page.tsx         # 주간 식단
│   ├── shopping/page.tsx       # 장보기
│   ├── recipes/page.tsx        # 레시피
│   └── cook/[mealId]/[recipeId]/page.tsx   # 상세 조리 화면 (주/곁들임 공용)
├── components/                 # 공통 UI (docs/design/components 1:1 대응)
├── features/
│   ├── home/  weekly/  shopping/  recipes/  cooking/
│   │   └── (feature UI, hooks, mappers)
├── services/                   # 유스케이스 (장보기 계산, 날짜/주차 계산 등 순수 로직)
├── lib/
│   ├── api/client.ts           # fetch 래퍼: base URL, 응답 파싱, 에러 정규화
│   ├── api/contracts.ts        # TS API 계약 (FastAPI 스펙 가정)
│   ├── coupang.ts              # F-07 쿠팡 검색 URL 단일 유틸
│   └── date.ts
├── mocks/
│   ├── handlers.ts             # MSW 핸들러 (지연·시나리오·에러 매핑)
│   ├── service.ts              # mock 백엔드 도메인 로직 (FEATURE_SPEC 규칙 재현)
│   ├── fixtures.ts             # 결정적 fixture (레시피·추출 템플릿·대체 규칙)
│   ├── db.ts                   # 인메모리 상태 + 시나리오 전환 (dev에서는 localStorage 유지)
│   └── browser.ts / server.ts  # 브라우저 worker / Vitest용 node 서버
└── tests/
    ├── unit/  component/  e2e/
```

## 3. 디자인 토큰 & 앱 프레임 (BASE.md)

- 컬러·타이포(`display`~`badge`)·radius·spacing·shadow 토큰을 CSS 변수 + Tailwind 유틸로 매핑
- 앱 캔버스: 최대 430px, 중앙 정렬, 바깥 배경 `surface-soft`, 좌우 패딩 20px
- 하단 내비 64px + `safe-area-inset-bottom` 고정, 본문 하단 여백 확보, 하단 고정 CTA와 겹치지 않게 배치
- 반응형 breakpoint 레이아웃 변경 없음
- 터치 타깃 ≥ 44×44px, 상태는 색 + 텍스트/아이콘 병기, 아이콘 단독 버튼은 `aria-label`
- 아이콘: 단순 선형 아이콘 (lucide-react)

## 4. 공통 컴포넌트 (`components/`)

| 컴포넌트 | 핵심 요구사항 |
|---|---|
| `Button` | primary / secondary / ghost / destructive, 기본·비활성·로딩, 로딩 중 중복 클릭 방지 |
| `Link` | 내부 이동(`next/link`)과 외부 링크(새 탭, `rel="noopener noreferrer"`, 외부 아이콘) 구분 |
| `Modal` | 제목·설명·본문·하단 액션, 포커스 트랩·ESC 닫기·포커스 복귀, 내부 스크롤, 제출 중 닫기 방지 |
| `Toast` | success / error / info, 자동 사라짐(오류는 더 길게), 동일 메시지 중복 억제, 선택적 액션(재시도) |
| `Accordion` | 헤더 클릭 토글, chevron + `aria-expanded`, `compact` 변형(식단 없는 날짜용 낮은 높이) |
| `StatusBadge` | 진행 중 / 성공 / 확인 필요 / 실패 / 중립(시간) — 텍스트 + 아이콘 |
| `List` / `ListItem` | 일관된 간격, 빈 상태 슬롯 |
| `TextInput` / `TextArea` | 라벨, 필수/선택 표기, 제출 시 오류 메시지, 값 보존 |
| `Checkbox` | 44px 터치 영역, 라벨 연결 |
| `Toggle` / `Stepper` | Toggle off 시 Stepper 비활성, Stepper는 1 이상 정수 |
| `Tooltip` | hover/focus/tap으로 열림, 키보드 접근 |
| `FloatingActionButton` | 라벨 `레시피 추가`, 하단 내비 위에 배치, 콘텐츠 가림 최소화 |
| `RecipeCard` | 이미지(실패 시 플레이스홀더)·레시피명·시간, 문서에 없는 배지 금지 |
| `BottomNavigation` | 홈 / 주간 식단 / 장보기(필요 재료 수 badge) / 레시피, 현재 탭 `aria-current` |
| `WeeklyStatus` | 주간 범위, 월 주차 리스트 + Dot(식단 존재 primary), 생성 상태 Badge |
| `ScreenHeader` | 제목/날짜/주간 이동 — 화면별 명세에 정의된 요소만 |
| `EmptyState` / `LoadingState` / `ErrorState` | 이유 + 다음 행동 CTA |

## 5. 화면별 구현

### 5.1 홈 (`HOME.md`) — `/`
- Header: 오늘 날짜만
- 오늘 식단 있음: 오늘의 레시피 카드(이미지, 레시피명, 예상 조리 시간 배지, `재료 정보` Accordion — 계획 인분 + 재료/필요량), 곁들임 레시피 목록(선택 시 상세 조리), 요리 완료 상태(완료 여부·시각), 하단 고정 `조리 시작`
- 오늘 식단 없음: `오늘 확정된 메뉴가 없습니다.` + `주간 식단 보기`/`식단 만들기`, 저장 레시피 0개면 레시피 등록 진입
- 레시피 추가 FAB + Modal(URL, 선택적 레시피 이름, Tooltip 출처 안내, `추가`/`취소`) → Toast
- 미확인 값은 `미확인` 표시, 문서에 없는 배지·알림·공유 아이콘 금지

### 5.2 상세 조리 화면 — `/cook/[mealId]/[recipeId]`
- 순서: 이미지 → 레시피명·예상 시간·계획 인분 → 조리 순서 → 이전 평가·메모 → 곁들임 링크/카드 → 재료·필요량 → 하단 고정 `요리 완료`
- `요리 완료`: 1회 동작, 멱등 처리(중복 클릭 시 동일 상태), 완료 시각 저장
- 완료 후 요리 평가 Modal: 별점 + 한 줄 코멘트, `등록`/`스킵`. 실패·스킵해도 완료 유지, 성공 시 Toast
- 대체 재료가 적용된 레시피는 원문 조리 순서와 분리된 `대체 시 조리 안내` 표시

### 5.3 주간 식단 (`WEEKLY.md`) — `/weekly`
- Header: 주간 범위 + 이전/다음 주
- `WeeklyStatus`: 생성 중 / 일부 생성 완료 / 전체 생성 완료 / 실패
- Action Bar: `주간 식단 생성`
- 날짜별 Accordion 리스트: 식단 있음 → RecipeCard + 열면 `식단 변경`, 곁들임 Accordion / 식단 없음 → 낮은 높이, 열면 `식단 생성`
- 날짜·레시피 선택 → 상세 조리 화면
- **주간 식단 생성 Modal**: 요일별 Toggle + Stepper(인분), 평일 30분/주말 70분 기본값은 요청에 포함, 전체 off면 버튼 비활성 + 안내, 중복 제출 방지, 부분 실패 시 성공 날짜만 반영
- **식단 변경 Modal**: 현재 날짜·식단 표시, 선택적 Text Area, `취소`/`변경 요청`, 실패 시 기존 식단 유지
- 빈 주: 안내 + `주간 식단 생성` CTA. 미배정 날짜 전용 재생성 버튼·큰 빈 카드 금지

### 5.4 장보기 (`SHOPPING.md`) — `/shopping`
- Header: `장보기` + 주간 범위/이동, `WeeklyStatus`, Summary(필요한 재료 수)
- 재료 항목: 재료명, 필요량·단위(합산 불가 단위는 원문 단위 병기), 준비 완료 Checkbox, 대체 재료 정보·적용 상태
- 미준비 시 하단 액션: `대체 관리`(대체 후보 있을 때), `쿠팡 검색`(외부 Link, 대체 적용 시 대체 재료명) / 준비 완료 시 숨김
- **대체 관리 Modal**: 대상 레시피·날짜 명시(전역 적용 아님), 후보 1~2개(필요량·비율, 맛 차이, 조리 변경 여부, 주의사항·불확실성), 수량 불확실 시 사용자 확인 요구, 적용 → 목록 갱신 + Toast, 실패 시 기존 목록 유지
- 확정 식단 없음: 식단 확정 후 목록이 생성된다는 안내

### 5.5 레시피 (`RECIPE.md`) — `/recipes`
- Header: `레시피` (추가 버튼 없음), 카테고리 탭 `메인/간단/국/반찬/소스`
- 리스트 항목: 이미지, 레시피명, StatusBadge(`수집 중`/`확인 필요`/`저장 완료`/`수집 실패`), 조리 기록 Accordion, 상태별 액션, 삭제(확인 Modal)
- `수집 중` 항목은 polling으로 상태 갱신
- FAB `레시피 추가` → 추가 Modal (URL 검증: http/https만, 중복 URL이면 기존 레시피 안내)
- **수정/반영 Modal**: `확인 필요` → `수정사항 반영 요청`(선택 입력) / `확인 처리`(재료 필수 검증), `수집 실패` → `재시도`(기존 URL) / `수정 요청`
- 실패해도 입력 URL 보존, 목록 요약 표시 금지

## 6. API 계약 (가정, mock 기준)

백엔드 미구현이므로 아래를 TS 계약 초안으로 정의하고 `lib/api/contracts.ts`에 둔다. 백엔드 설계 시 이 문서를 맞춰 갱신한다.

| Method | Path | 용도 |
|---|---|---|
| GET | `/recipes?category=` | 레시피 목록 (조리 기록 포함) |
| GET | `/recipes/{id}` | 레시피 상세 |
| POST | `/recipes/import` | URL 수집 요청 (출처 중복 시 409 `duplicate_recipe` + 기존 레시피, 별도 저장 없음. 삭제된 출처는 복구 후 200) |
| POST | `/recipes/{id}/retry` | 기존 URL로 재수집 |
| POST | `/recipes/{id}/revision-requests` | 수정사항 반영 요청 (선택 comment) |
| POST | `/recipes/{id}/confirm` | 확인 처리 (재료 필수, 누락 시 422 fieldErrors) |
| DELETE | `/recipes/{id}` | 삭제 (오늘 이후 식단에 사용 중이면 409) |
| GET | `/meal-plans/weeks/{weekStart}` | 주간 식단 + 생성 상태 |
| GET | `/meal-plans/months/{YYYY-MM}` | 월 주차별 식단 존재 여부 |
| POST | `/meal-plans/generate` | 선택 날짜별 `{date, servings, cookMinutes}` → 날짜별 성공/실패 결과 |
| POST | `/meal-plans/entries/{id}/regenerate` | 날짜별 식단 변경 (선택 comment, 실패 시 기존 유지) |
| GET | `/meal-plans/entries/{id}` | 상세 조리 (인분 환산 재료·대체 안내·이전 기록) |
| POST | `/meal-plans/entries/{id}/complete` | 요리 완료 (멱등) |
| GET | `/meals/today` | 오늘 식단 + 저장 레시피 존재 여부 |
| PUT | `/cooking-logs/{id}/review` | 평가·메모 |
| GET | `/shopping-lists/{weekStart}` | 장보기 목록 (출처 관계 포함) |
| PATCH | `/shopping-lists/{weekStart}/items/{itemId}` | 준비 여부 |
| GET | `/shopping-lists/{weekStart}/items/{itemId}/substitutes` | 대체 후보 (레시피·날짜별) |
| POST | `/shopping-lists/{weekStart}/items/{itemId}/substitutes/apply` | 대체 적용 (해당 레시피·날짜만) |

JSON 필드는 camelCase (Pydantic `alias_generator=to_camel`). 계약 원본은 `lib/api/contracts.ts`.

- 에러 정규화: `{ code, message, details? }` → validation / unauthorized / conflict / server / network
- mock 시나리오: URL에 `?scenario=default|empty|slow|server-error|unauthorized` (localStorage에 저장, `default`/`empty`는 mock DB 재시드). validation·부분 실패는 데이터로 재현 (예: URL에 `fail` 포함 시 첫 수집 실패, 조리 시간 짧은 날짜는 생성 실패)

## 6-1. 실행 방법

```bash
pnpm install
pnpm dev:mock      # MSW mock API로 실행 (백엔드 없이)
pnpm test          # Vitest 단위·컴포넌트 테스트
pnpm test:e2e      # Playwright E2E (mock 서버 자동 실행)
```

실제 백엔드 연동 시 `NEXT_PUBLIC_API_BASE_URL`만 설정하고 `pnpm dev`로 실행한다 (`.env.example` 참고).

## 7. 도메인 로직 (`services/`, 단위 테스트 대상)

- 장보기 계산은 원칙적으로 백엔드 책임이나, mock DB에서 동일 규칙을 재현: `수량 × (계획 인분 ÷ 기준 인분)`, 정규화 재료명 + 호환 단위만 합산, 보유 여부 유지/신규 항목 기본 미보유, 불필요 항목 제거
- 주간 범위 계산(주 시작 요일은 미확정 → 설정값 하나로 분리, 기본 월요일 가정)
- 평일/주말 기본 조리 시간
- `lib/coupang.ts`: `https://www.coupang.com/np/search?q=${encodeURIComponent(name)}`

## 8. 작업 순서 (마일스톤)

1. **세팅**: Next.js 프로젝트 생성, Tailwind 토큰, Pretendard, ESLint, Vitest, Playwright, MSW, TanStack Query
2. **앱 셸**: 430px 캔버스, BottomNavigation, ToastProvider, 라우트 골격
3. **공통 컴포넌트** + 컴포넌트 테스트
4. **API 계약 + mock DB/handlers/fixtures**
5. **레시피 화면** (추가 → 수집 상태 → 확인/수정 → 삭제) — 이후 화면의 데이터 원천
6. **주간 식단 화면** (생성 Modal, 변경 Modal, 부분 실패)
7. **홈 + 상세 조리 + 평가 Modal**
8. **장보기 화면** (체크, 대체 관리, 쿠팡 링크, BottomNav badge 연동)
9. **E2E**: 레시피 추가 → 식단 생성 → 장보기 체크/대체 → 조리 완료·평가
10. **검증**: `typecheck`, `lint`, `test`, `build`, 브라우저 프리뷰 확인 (390px 기준)

## 9. 결정 사항

1. **Header**: 각 화면 명세의 Header 정의를 따른다 (`BASE.md`의 Header 제외 문구 삭제됨).
2. **곁들임 연결/해제 UI**(F-04): 이번 MVP 화면에서 제외. 식단에 연결된 곁들임 표시는 유지.
3. **주 시작 요일**: 확정 → 월요일, 월간 주차는 월과 하루 이상 겹치는 주 포함 (`lib/date.ts`)
4. **별점 척도**: 확정 → 1~5 정수, 평가 저장 시 필수 (`RATING_MIN`/`RATING_MAX`)
5. **`frontend/CLAUDE.md`의 Product 설명**: 레시피·식단 앱으로 수정 완료
6. **인증**: 로그인 화면 명세 없음 → 단일 사용자 가정, API 클라이언트에만 인증 훅 자리 마련
