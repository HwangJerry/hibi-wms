import type { AppRouter } from "@hibi/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_TRPC_URL = "/trpc";

function getTrpcUrl() {
  return import.meta.env.VITE_TRPC_URL ?? DEFAULT_TRPC_URL;
}

export function TrpcProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpLink({
          url: getTrpcUrl(),
          fetch: (url, init) =>
            fetch(url, {
              ...init,
              credentials: "include",
            }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
