import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";

export function useAuth() {
  // Don't auto-redirect here; let the app decide when to show the auth page.
  const [, _navigate] = useLocation();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
        });
        if (response.status === 401) {
          // Not authenticated — return null (not undefined, as react-query doesn't allow undefined)
          return null;
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.statusText}`);
        }
        return response.json();
      } catch (err) {
        // Suppress 401 errors (expected for unauthenticated users on public pages)
        const error = err as any;
        if (error?.message?.includes("401")) {
          return null;
        }
        throw err;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: user as User | null,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
