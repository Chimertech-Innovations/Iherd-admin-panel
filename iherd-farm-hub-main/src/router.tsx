import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000, // 10 minutes cache freshness across entire app
        gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
        refetchOnWindowFocus: false, // Prevent Firestore reads on tab/window switch
        refetchOnMount: false, // Serve from cache if already loaded
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
