import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      // Include embed token if available (for embed users navigating to other pages)
      const headers: Record<string, string> = {};
      try {
        const embedToken = sessionStorage.getItem('embedToken');
        if (embedToken) {
          headers['X-Embed-Token'] = embedToken;
        }
      } catch {}
      
      const response = await fetch("/api/auth/user", {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      return response.json();
    },
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
