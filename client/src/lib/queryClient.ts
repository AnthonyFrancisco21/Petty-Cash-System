import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey. Support forms like:
    // ["/api/vouchers"] or ["/api/vouchers", { status: 'pending' }]
    let url = "";
    if (Array.isArray(queryKey) && typeof queryKey[0] === "string") {
      url = queryKey[0];
      const maybeParams = queryKey[1];
      if (maybeParams && typeof maybeParams === "object") {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(maybeParams as any)) {
          if (v === undefined || v === null) continue;
          params.append(k, String(v));
        }
        const qs = params.toString();
        if (qs) url = `${url}?${qs}`;
      }
    } else {
      url = String(queryKey.join("/"));
    }

    const res = await fetch(url, { credentials: "include" });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as any;
    }

    await throwIfResNotOk(res);
    return (await res.json()) as any;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
