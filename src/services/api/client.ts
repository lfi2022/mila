import { runtimeConfig } from "@/config/runtime";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { csrf?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 15_000);
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (init.csrf) {
    const csrf = readCookie(`${runtimeConfig.authCookieName}_csrf`);
    if (csrf) headers.set("x-csrf-token", csrf);
  }
  let response: Response;
  try {
    const baseUrl =
      typeof window === "undefined" ? runtimeConfig.apiServerBaseUrl : runtimeConfig.apiBaseUrl;
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "REQUEST_TIMEOUT", "La requête a expiré.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mila:session-expired"));
    }
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "La requête a échoué.",
    );
  }
  return payload as T;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : undefined;
}
