import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest } from "@/services/api/client";

describe("central API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the versioned base URL and includes cookie credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest<{ ok: boolean }>("/health/live")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/health/live",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("normalizes the API error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "NOPE", message: "Refusé" } }), {
          status: 403,
        }),
      ),
    );
    await expect(apiRequest("/private")).rejects.toEqual(
      expect.objectContaining<ApiError>({ status: 403, code: "NOPE", message: "Refusé" }),
    );
  });
});
