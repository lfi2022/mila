import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/services/api/client";

export function createMilaQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (attempt, error) =>
          attempt < 2 && (!(error instanceof ApiError) || error.status >= 500),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
