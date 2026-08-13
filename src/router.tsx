import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createMilaQueryClient } from "@/app/query-client";

export const getRouter = () => {
  const queryClient = createMilaQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
