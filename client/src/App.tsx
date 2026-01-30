import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChatPage from "@/pages/chat";
import DashboardPage from "@/pages/dashboard";
import ConversationsPage from "@/pages/conversations";
import EmbedPage from "@/pages/embed";
import EmbedWithIdPage, { EmbedContext } from "@/pages/embed-with-id";
import AuthPage from "@/pages/auth";
import LogsPage from "@/pages/logs";
import HelpPage from "@/pages/help";
import IntegrationPage from "@/pages/integration";
import NotFound from "@/pages/not-found";

interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: 'superadmin' | 'admin' | 'user';
}

function useAuth() {
  // Skip auth check for embed routes - they use token-based auth
  const isEmbedRoute = window.location.pathname.startsWith('/embed');
  
  // Check if user has embed token (from sessionStorage OR URL params)
  let embedToken: string | null = null;
  try {
    // Check URL params first (for iframe third-party context)
    const urlParams = new URLSearchParams(window.location.search);
    embedToken = urlParams.get('token') || sessionStorage.getItem('embedToken');
  } catch {}
  
  const hasEmbedToken = !!embedToken;
  
  return useQuery<AuthUser | null>({
    // Use different query key for embed token auth to avoid cache conflicts
    queryKey: hasEmbedToken ? ["/api/auth/user", "embed"] : ["/api/auth/user"],
    queryFn: async () => {
      // Include embed token if available (for embed users navigating to other pages)
      const headers: Record<string, string> = {};
      
      // Get token from URL params or sessionStorage
      let token: string | null = null;
      try {
        const urlParams = new URLSearchParams(window.location.search);
        token = urlParams.get('token') || sessionStorage.getItem('embedToken');
        if (token) {
          headers['X-Embed-Token'] = token;
        }
      } catch {}
      
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
    staleTime: 5 * 60 * 1000,
    enabled: !isEmbedRoute, // Don't fetch for embed routes
  });
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/conversations" component={ConversationsPage} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/help" component={HelpPage} />
      <Route path="/embed/:embedId" component={EmbedWithIdPage} />
      <Route path="/embed" component={EmbedPage} />
      <Route path="/integration" component={IntegrationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Parse embed context from URL params
function getEmbedContextFromUrl(): { embedId: string | null; role: 'superadmin' | 'admin' | 'user' | null; displayId: string | null; token: string | null } {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmbedId = urlParams.get('embed');
    const urlToken = urlParams.get('token');
    
    let embedId = urlEmbedId;
    let embedToken = urlToken;
    
    // Fall back to sessionStorage if URL params not present
    if (!embedId || !embedToken) {
      try {
        embedId = sessionStorage.getItem('currentEmbedId');
        embedToken = sessionStorage.getItem('embedToken');
      } catch {}
    }
    
    if (embedId && embedToken) {
      // Get role from sessionStorage (NOT from token - embedToken is not a JWT)
      let role: 'superadmin' | 'admin' | 'user' = 'user';
      try {
        const storedRole = sessionStorage.getItem('embedRole');
        if (storedRole === 'superadmin' || storedRole === 'admin' || storedRole === 'user') {
          role = storedRole;
        }
      } catch {}
      
      let displayId: string | null = null;
      try {
        displayId = localStorage.getItem(`embed_display_id_${embedId}`);
      } catch {}
      
      return { embedId, role, displayId, token: embedToken };
    }
  } catch {}
  return { embedId: null, role: null, displayId: null, token: null };
}

function EmbedAwareRouter() {
  // Get embed context data synchronously to avoid render issues
  const contextData = getEmbedContextFromUrl();
  
  const embedContext = {
    isEmbed: true,
    embedId: contextData.embedId,
    role: contextData.role,
    embedName: null,
    displayId: contextData.displayId,
    sessionId: null,
    jwtUsername: null,
    jwtTenant: null,
    onRecoverSession: async () => false,
  };
  
  console.log('[EmbedAwareRouter] context:', embedContext);

  return (
    <EmbedContext.Provider value={embedContext}>
      <Switch>
        <Route path="/" component={ChatPage} />
        <Route path="/logs" component={LogsPage} />
        <Route path="/help" component={HelpPage} />
        <Route path="/integration" component={IntegrationPage} />
        <Route path="/embed/:embedId" component={EmbedWithIdPage} />
        <Route path="/embed" component={EmbedPage} />
        <Route component={NotFound} />
      </Switch>
    </EmbedContext.Provider>
  );
}

function UnauthenticatedRouter() {
  // Check if user has embed token - from sessionStorage OR URL params
  let hasEmbedToken = false;
  try {
    // Check URL params first (for iframe third-party context)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      hasEmbedToken = true;
      console.log('[UnauthenticatedRouter] Found token in URL params');
    } else {
      hasEmbedToken = !!sessionStorage.getItem('embedToken');
      console.log('[UnauthenticatedRouter] sessionStorage token:', hasEmbedToken);
    }
  } catch (e) {
    console.log('[UnauthenticatedRouter] Error checking token:', e);
  }
  
  console.log('[UnauthenticatedRouter] hasEmbedToken:', hasEmbedToken);
  
  // If user has embed token, show all routes with embed context
  if (hasEmbedToken) {
    console.log('[UnauthenticatedRouter] Rendering EmbedAwareRouter');
    return <EmbedAwareRouter />;
  }
  
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/embed/:embedId" component={EmbedWithIdPage} />
      <Route path="/embed" component={EmbedPage} />
      <Route component={AuthPage} />
    </Switch>
  );
}

// Wrapper to provide embed context for non-embed routes when embed token exists
function EmbedContextWrapper({ children, user }: { children: React.ReactNode; user: AuthUser | null }) {
  console.log('[EmbedContextWrapper] Mounting, user:', user?.id);
  const [embedData, setEmbedData] = useState<{
    embedId: string | null;
    role: 'superadmin' | 'admin' | 'user' | null;
    displayId: string | null;
    sessionId: string | null;
  }>({ embedId: null, role: null, displayId: null, sessionId: null });

  useEffect(() => {
    // Check if we have embed token from URL params OR sessionStorage (for iframe third-party context)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlEmbedId = urlParams.get('embed');
      const urlToken = urlParams.get('token');
      
      // Use URL params first, fall back to sessionStorage
      let embedId = urlEmbedId;
      let embedToken = urlToken;
      
      if (!embedId || !embedToken) {
        embedToken = sessionStorage.getItem('embedToken');
        embedId = sessionStorage.getItem('currentEmbedId');
      }
      
      if (embedToken && embedId) {
        // Parse token to get role
        let role: 'superadmin' | 'admin' | 'user' = 'user';
        try {
          const tokenData = JSON.parse(atob(embedToken.split('.')[1] || '{}'));
          role = tokenData.role || 'user';
        } catch {}
        
        // Get display ID from localStorage
        const storedDisplayId = localStorage.getItem(`embed_display_id_${embedId}`);
        
        setEmbedData({
          embedId: embedId,
          role: role,
          displayId: storedDisplayId,
          sessionId: user?.id || null,
        });
      }
    } catch {}
  }, [user]);

  // If we have embed data, provide the context
  console.log('[EmbedContextWrapper] embedData:', embedData);
  if (embedData.embedId) {
    console.log('[EmbedContextWrapper] Providing embed context');
    const embedContext = {
      isEmbed: true,
      embedId: embedData.embedId,
      role: embedData.role,
      embedName: null,
      displayId: embedData.displayId,
      sessionId: embedData.sessionId,
      jwtUsername: null,
      jwtTenant: null,
      onRecoverSession: async () => false, // Recovery only works on main embed page
    };

    return (
      <EmbedContext.Provider value={embedContext}>
        {children}
      </EmbedContext.Provider>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  // Use wouter's useLocation to properly detect path changes during client-side navigation
  const [location] = useLocation();
  
  // Check if we're on an embed route - skip auth check for embeds
  const isEmbedRoute = location.startsWith('/embed');
  
  // Debug logging - use window.location.search for query params (wouter doesn't include them in location)
  const urlParams = new URLSearchParams(window.location.search);
  const hasUrlToken = !!urlParams.get('token');
  const hasUrlEmbed = !!urlParams.get('embed');
  console.log('[AppContent] path:', location, 'isEmbedRoute:', isEmbedRoute, 'hasUrlToken:', hasUrlToken, 'hasUrlEmbed:', hasUrlEmbed);
  
  // For embed routes, render directly without auth check (embed has its own auth)
  if (isEmbedRoute) {
    return (
      <Switch>
        <Route path="/embed/:embedId" component={EmbedWithIdPage} />
        <Route path="/embed" component={EmbedPage} />
      </Switch>
    );
  }

  // For embed navigation with token in URL (e.g., /help?embed=xxx&token=xxx), skip auth and use EmbedAwareRouter
  if (hasUrlToken && hasUrlEmbed) {
    console.log('[AppContent] Embed navigation detected, using EmbedAwareRouter');
    return <EmbedAwareRouter />;
  }
  
  const { data: user, isLoading, error } = useAuth();
  console.log('[AppContent] user:', JSON.stringify(user), 'isLoading:', isLoading, 'error:', error, 'willRenderUnauth:', !isLoading && !user);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8BC34A] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Auth error:", error);
  }

  if (user) {
    return (
      <EmbedContextWrapper user={user}>
        <AuthenticatedRouter />
      </EmbedContextWrapper>
    );
  }

  return <UnauthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
