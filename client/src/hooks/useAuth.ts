import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

// Get embed token from URL params or sessionStorage
function getEmbedToken(): string | null {
  try {
    // Check URL params first (for iframe third-party context)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) return urlToken;
    
    // Fall back to sessionStorage
    return sessionStorage.getItem('embedToken');
  } catch {
    return null;
  }
}

export function useAuth() {
  const embedToken = getEmbedToken();
  
  const { data: user, isLoading, error } = useQuery<User | null>({
    // Use different query key for embed auth to avoid cache conflicts
    queryKey: embedToken ? ["/api/auth/user", "embed"] : ["/api/auth/user"],
    queryFn: async () => {
      // Include embed token if available (for embed users navigating to other pages)
      const headers: Record<string, string> = {};
      const token = getEmbedToken();
      if (token) {
        headers['X-Embed-Token'] = token;
      }
      
      const response = await fetch("/api/auth/user", {
        credentials: "include",
        headers,
      });
      if (response.status === 401) {
        return null;
      }
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
