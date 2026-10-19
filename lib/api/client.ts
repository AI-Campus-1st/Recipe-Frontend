import type { ApiErrorBody, ApiErrorCode } from "./contracts";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | "network_error";
  readonly fieldErrors: Record<string, string>;
  readonly details: unknown;

  constructor(status: number, body: Omit<Partial<ApiErrorBody>, "code"> & { code: ApiError["code"] }) {
    super(body.message ?? "요청을 처리하지 못했습니다.");
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors ?? {};
    this.details = body.details;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

/** Hook for attaching auth headers once authentication is defined. */
function authHeaders(): Record<string, string> {
  return {};
}

function fallbackCode(status: number): ApiErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422 || status === 400) return "validation_error";
  return "server_error";
}

export async function apiRequest<T>(path: string, { method = "GET", body, signal }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, { code: "network_error", message: "네트워크에 연결할 수 없습니다." });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!response.ok) {
    const errorBody = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(response.status, {
      code: errorBody.code ?? fallbackCode(response.status),
      message: errorBody.message ?? defaultMessage(response.status),
      fieldErrors: errorBody.fieldErrors,
      details: errorBody.details,
    });
  }

  return data as T;
}

function defaultMessage(status: number): string {
  if (status === 401 || status === 403) return "로그인이 필요합니다.";
  if (status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  return "요청을 처리하지 못했습니다.";
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
}
