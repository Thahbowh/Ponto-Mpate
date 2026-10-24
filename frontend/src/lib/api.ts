const BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
const TOKEN_KEY = "ponto-mpate-token";

export const AUTH_EXPIRED_EVENT = "ponto-mpate:auth-expired";

// Guarded so it is safe during server-side rendering
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => {
    if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
  },
  clear: () => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
  },
};

export type FieldDetail = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  details?: FieldDetail[];

  constructor(message: string, status: number, details?: FieldDetail[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** Field-level validation messages, keyed by field name. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) out[d.field] = d.message;
    return out;
  }
}

export interface ApiBody<T> {
  success: boolean;
  data: T;
  duplicate?: boolean;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiBody<T>> {
  const token = tokenStore.get();
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Could not reach the server, so this could not be confirmed. Please check your connection and try again.",
      0
    );
  }

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    // response was not JSON
  }

  if (!response.ok || !json?.success) {
    if (response.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(
      json?.error?.message ?? "Something went wrong. Please try again.",
      response.status,
      json?.error?.details
    );
  }

  return json as ApiBody<T>;
}

/** Returns just the `data` part of a successful response. */
export async function api<T>(path: string, options?: RequestOptions): Promise<T> {
  return (await request<T>(path, options)).data;
}
