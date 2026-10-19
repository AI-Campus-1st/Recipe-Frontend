---
# Repository Instructions

## Product
Next.js application for weekly meal planning based on saved recipes: importing recipes from external URLs, generating and editing weekly meal plans, building a consolidated shopping list with ingredient substitutes, and recording cooking history. All application data is accessed through the FastAPI backend.

## Stack
- Next.js App Router + React
- TypeScript (`strict: true`)
- Tailwind CSS
- Vitest + React Testing Library
- Playwright
- pnpm

## Structure
- `app/`: Routes and layouts
- `components/`: Shared UI components
- `features/`: Feature-specific UI, hooks, and logic
- `services/`: Application services and use cases
- `lib/`: API clients and shared utilities
- `mocks/`: Mock API handlers and fixtures
- `tests/`: Integration and E2E tests

Follow existing repository conventions.

## Architecture
- Separate UI, application logic, and infrastructure concerns.
- Keep components focused on rendering and interactions.
- Centralize API communication in shared clients or feature-specific adapters.
- Keep API and business logic out of UI components.
- Use existing components and design patterns; avoid unnecessary abstractions.
- Route all data access and mutations through FastAPI. Never connect directly to a database or introduce Prisma.
- Keep server-only credentials out of client code.

## API & Mocking
- Define TypeScript API contracts based on the FastAPI specification.
- Centralize request handling, authentication, response parsing, and error handling.
- Use mock API handlers, preferably MSW if compatible with the existing setup, before backend endpoints are available.
- Keep mocks separate from production code and aligned with expected API contracts.
- Mock success, empty, loading, validation, authorization, and server-error scenarios.
- Enable mocks explicitly in development and tests; never use them in production or silently fall back to them.
- Account for Next.js server/client boundaries; browser-level mocks do not automatically intercept server-side requests.
- Replace mocks with real API calls without unnecessary UI changes, then verify integration against the actual backend.

## UI
- Implement appropriate loading, empty, success, disabled, and error states.
- Follow existing responsive design and component conventions.
- Preserve semantic HTML, keyboard accessibility, and focus behavior.
- Keep UI state separate from server state.
- Treat client-side validation as supplementary; backend validation remains authoritative.

## Testing
- Use Vitest and React Testing Library for unit and component tests.
- Use deterministic fixtures and mock API handlers.
- Test user interactions, API states, validation, and error handling.
- Use Playwright for critical end-to-end flows.
- Do not weaken assertions to pass tests.

## Commands
- Install: `pnpm install`
- Development: `pnpm dev`
- Tests: `pnpm test`
- Type check: `pnpm typecheck`
- Lint: `pnpm lint`
- E2E: `pnpm test:e2e`
- Build: `pnpm build`

Use commands defined in `package.json`. Run relevant checks for each change.
---