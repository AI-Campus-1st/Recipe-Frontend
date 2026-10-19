import { vi } from "vitest";

/** Shared `next/navigation` router mock (wired up in tests/setup.ts). */
export const routerMock = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn(), forward: vi.fn() };
