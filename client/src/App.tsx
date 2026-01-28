import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChatPage from "@/pages/chat";
import DashboardPage from "@/pages/dashboard";
import ConversationsPage from "@/pages/conversations";
import EmbedPage from "@/pages/embed";
import EmbedWithIdPage from "@/pages/embed-with-id";
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
  return useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
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

function UnauthenticatedRouter() {
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

function AppContent() {
  const { data: user, isLoading, error } = useAuth();

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
    return <AuthenticatedRouter />;
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
