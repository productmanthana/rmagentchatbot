import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ErrorLog, ErrorLogStatus } from "@shared/schema";
import { ERROR_LOG_STATUSES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useEmbedContext } from "./embed-with-id";

const CLIENT_ROLE_MAP: Record<string, 'user' | 'admin' | 'superadmin'> = {
  "admin": "admin",
  "super admin": "superadmin",
  "superadmin": "superadmin",
  "poc members": "user",
  "pocmembers": "user",
  "poradmingroup": "admin",
  "pormanagers": "user",
  "administrator": "admin",
  "manager": "admin",
  "supervisor": "admin",
  "user": "user",
  "member": "user",
  "viewer": "user",
  "guest": "user",
  "owner": "superadmin",
  "root": "superadmin",
};

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return atob(base64);
}

function decodeJwtRole(token: string): 'superadmin' | 'admin' | 'user' | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const roleFields = [
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role",
      "role", "roles", "Role", "Roles", "user_role", "userRole",
      "UserRole", "user_type", "userType",
    ];
    let clientRole: string | null = null;
    for (const field of roleFields) {
      if (payload[field]) {
        const val = payload[field];
        clientRole = Array.isArray(val) ? val[0] : String(val);
        break;
      }
    }
    if (!clientRole) return null;
    const mapped = CLIENT_ROLE_MAP[clientRole.toLowerCase()];
    return mapped || 'user';
  } catch {
    return null;
  }
}

// Parse embed context from URL params (for iframe third-party context)
function getEmbedContextFromUrl(): { isEmbed: boolean; embedId: string | null; role: 'superadmin' | 'admin' | 'user' | null } {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmbedId = urlParams.get('embed');
    const urlToken = urlParams.get('token') || urlParams.get('jwt') || urlParams.get('auth');
    
    if (urlEmbedId) {
      let role: 'superadmin' | 'admin' | 'user' | null = null;
      if (urlToken) {
        role = decodeJwtRole(urlToken);
      }
      if (!role) {
        try {
          const jwtToken = sessionStorage.getItem('jwtToken');
          if (jwtToken) role = decodeJwtRole(jwtToken);
        } catch {}
      }
      return { isEmbed: true, embedId: urlEmbedId, role };
    }
  } catch {}
  return { isEmbed: false, embedId: null, role: null };
}

async function recoverEmbedSession(): Promise<string | null> {
  try {
    let jwtToken: string | null = null;
    let embedId: string | null = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      jwtToken = urlParams.get('token') || urlParams.get('jwt') || urlParams.get('auth');
      embedId = urlParams.get('embed');
    } catch {}
    if (!jwtToken) {
      try { jwtToken = sessionStorage.getItem('jwtToken'); } catch {}
    }
    if (!embedId) {
      try { embedId = sessionStorage.getItem('currentEmbedId'); } catch {}
    }
    if (!jwtToken || !embedId) {
      console.warn('[QueryLogs] Cannot recover session - missing JWT or embedId');
      return null;
    }
    console.log('[QueryLogs] Recovering session with embedId:', embedId, 'jwtToken length:', jwtToken.length);
    const res = await fetch('/api/embed/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ embedId, parentOrigin: window.location.origin, jwtToken }),
    });
    if (!res.ok) {
      console.error('[QueryLogs] Session recovery failed:', res.status);
      return null;
    }
    const data = await res.json();
    if (data.success && data.token) {
      try {
        sessionStorage.setItem('embedToken', data.token);
        sessionStorage.setItem('currentEmbedId', embedId);
        if (data.role) sessionStorage.setItem('embedRole', data.role);
      } catch {}
      console.log('[QueryLogs] Session recovered successfully, role:', data.role);
      return data.token;
    }
    return null;
  } catch (error) {
    console.error('[QueryLogs] Session recovery error:', error);
    return null;
  }
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  ArrowLeft,
  Trash2,
  MessageSquare,
  Calendar,
  FileText,
  Lock,
  Check,
  Clock,
  Wrench,
  CheckCircle2,
  ChevronDown,
  Pencil,
  X,
  Save,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Helper function to clean up JSON content in log fields for display
function cleanLogContent(content: string | null | undefined): string {
  if (!content) return "";
  
  // Check if content looks like JSON (starts with { or contains JSON-like patterns)
  const isJsonLike = content.trim().startsWith('{') || 
                     content.includes('"sql_query"') || 
                     content.includes('"ai_insights"') ||
                     content.includes('"backgroundColor"') ||
                     content.includes('"message":');
  
  if (isJsonLike) {
    try {
      // Try to parse and extract just the message field
      const parsed = JSON.parse(content);
      if (parsed.message && typeof parsed.message === 'string') {
        return parsed.message;
      }
    } catch {
      // Not valid JSON, try to extract message using regex
      const messageMatch = content.match(/"message"\s*:\s*"([^"]+)"/);
      if (messageMatch) {
        return messageMatch[1];
      }
    }
    // If we can't extract a clean message, return a generic one
    return "[Response data - see chat for details]";
  }
  
  return content;
}

const STATUS_CONFIG: Record<ErrorLogStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/20", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-[#3B82F6]/10 text-[#2563EB] border-[#3B82F6]/20", icon: Wrench },
  resolved: { label: "Resolved", color: "bg-[#10B981]/10 text-[#059669] border-[#10B981]/20", icon: Check },
  completed: { label: "Completed", color: "bg-[#8B5CF6]/10 text-[#7C3AED] border-[#8B5CF6]/20", icon: CheckCircle2 },
  results_sent: { label: "Results Sent", color: "bg-[#06B6D4]/10 text-[#0891B2] border-[#06B6D4]/20", icon: Send },
};

export default function LogsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  
  // Get embed context for navigation
  const contextEmbed = useEmbedContext();
  const urlEmbed = getEmbedContextFromUrl();
  const isEmbed = contextEmbed.isEmbed || urlEmbed.isEmbed;
  const embedId = contextEmbed.embedId || urlEmbed.embedId;
  const backUrl = isEmbed && embedId ? `/embed/${embedId}` : "/";
  
  // For embed users, check embed context role; for regular users, check auth user
  // Priority: EmbedContext role > URL JWT-decoded role > sessionStorage role > default 'user'
  let embedRole = contextEmbed.role;
  if (!embedRole && urlEmbed.role) {
    embedRole = urlEmbed.role;
  }
  if (!embedRole && isEmbed) {
    try {
      embedRole = sessionStorage.getItem('embedRole') as 'superadmin' | 'admin' | 'user' | null;
    } catch {}
  }
  const effectiveRole = isEmbed ? (embedRole || 'user') : ((user as any)?.role || 'user');
  
  // Check multiple signals for embed auth - embedToken in sessionStorage,
  // OR embed context is active, OR URL has embed params
  let hasEmbedAuth = false;
  try {
    const hasEmbedToken = !!sessionStorage.getItem('embedToken');
    const hasUrlEmbedParams = !!new URLSearchParams(window.location.search).get('embed');
    hasEmbedAuth = isEmbed && (hasEmbedToken || hasUrlEmbedParams || contextEmbed.isEmbed);
  } catch {
    hasEmbedAuth = isEmbed;
  }
  
  // All hooks MUST be called before any conditional returns (React rules of hooks)
  const { data: errorLogsData, isLoading, refetch } = useQuery<{ success: boolean; data: ErrorLog[] }>({
    queryKey: ["/api/error-logs"],
    queryFn: async () => {
      const fetchWithToken = async (token: string | null, includeJwtFallback = false) => {
        const headers: Record<string, string> = {};
        if (token) {
          headers['X-Embed-Token'] = token;
        }
        if (includeJwtFallback) {
          let jwt: string | null = null;
          let eid: string | null = null;
          try {
            const urlParams = new URLSearchParams(window.location.search);
            jwt = urlParams.get('token') || urlParams.get('jwt') || urlParams.get('auth');
            eid = urlParams.get('embed');
          } catch {}
          if (!jwt) try { jwt = sessionStorage.getItem('jwtToken'); } catch {}
          if (!eid) try { eid = sessionStorage.getItem('currentEmbedId'); } catch {}
          if (jwt) headers['X-JWT-Token'] = jwt;
          if (eid) headers['X-Embed-Id'] = eid;
        }
        console.log('[QueryLogs] Fetching /api/error-logs with embedToken:', token ? `${token.substring(0, 8)}...` : 'none', 'jwtFallback:', includeJwtFallback);
        return fetch("/api/error-logs", { credentials: "include", headers });
      };

      let embedToken: string | null = null;
      try { embedToken = sessionStorage.getItem('embedToken'); } catch {}

      let res = await fetchWithToken(embedToken, isEmbed);

      if (res.status === 401 && isEmbed) {
        console.warn('[QueryLogs] 401 - attempting client-side session recovery...');
        const newToken = await recoverEmbedSession();
        if (newToken) {
          console.log('[QueryLogs] Session recovered, retrying with new token');
          res = await fetchWithToken(newToken, false);
        }
      }

      if (isEmbed) {
        const newEmbedToken = res.headers.get('X-New-Embed-Token');
        if (newEmbedToken) {
          try { sessionStorage.setItem('embedToken', newEmbedToken); } catch {}
          console.log('[QueryLogs] Got new embed token from server JWT fallback, role preserved');
        }
      }

      if (!res.ok) {
        if (res.status === 401) {
          console.warn('[QueryLogs] 401 after recovery attempt - returning empty');
          return { success: true, data: [] };
        }
        throw new Error(`Failed to fetch error logs: ${res.status}`);
      }
      const data = await res.json();
      console.log('[QueryLogs] Fetched', data?.data?.length || 0, 'logs successfully');
      return data;
    },
    refetchOnMount: "always",
    staleTime: 0,
    enabled: !!user || hasEmbedAuth, // Fetch when user OR embed is authenticated
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/error-logs/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      await refetch();
      toast({
        title: "Log deleted",
        description: "The query log has been removed.",
      });
      setDeleteLogId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete query log. Please try again.",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", "/api/error-logs/bulk-delete", { ids });
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      await refetch();
      toast({
        title: "Logs deleted",
        description: `${data.deletedCount || selectedLogIds.size} query log(s) have been removed.`,
      });
      setSelectedLogIds(new Set());
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Bulk delete failed",
        description: "Failed to delete selected query logs. Please try again.",
      });
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: async ({ id, developer_comment, status }: { id: string; developer_comment?: string | null; status?: ErrorLogStatus }) => {
      return apiRequest("PATCH", `/api/error-logs/${id}`, { developer_comment, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      toast({
        title: "Log updated",
        description: "The query log has been updated.",
      });
      setEditingCommentId(null);
      setEditingCommentText("");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update query log. Please try again.",
      });
    },
  });

  // Derive computed values after hooks - use effectiveRole (from embed context OR auth)
  const isSuperadmin = effectiveRole === 'superadmin';
  const isAdmin = effectiveRole === 'admin';
  const canAccessQueryLogs = isSuperadmin || isAdmin;
  const errorLogs = errorLogsData?.data || [];
  
  const canViewChat = (log: ErrorLog) => {
    if (!log.user_id) return true;
    return user?.id && user.id === log.user_id;
  };

  // Show loading while auth is checking (skip for embed users who have embedToken)
  if (authLoading && !hasEmbedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!canAccessQueryLogs) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Lock className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
        <p className="text-gray-500 mb-4">Only admin and superadmin users can access Query Logs.</p>
        <Link href={backUrl}>
          <Button variant="outline" className="text-[#3B82F6]">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chat
          </Button>
        </Link>
      </div>
    );
  }

  const handleDeleteLog = (id: string) => {
    setDeleteLogId(id);
  };

  const confirmDelete = () => {
    if (deleteLogId) {
      deleteLogMutation.mutate(deleteLogId);
    }
  };

  const handleStatusChange = (id: string, status: ErrorLogStatus) => {
    updateLogMutation.mutate({ id, status });
  };

  const startEditingComment = (log: ErrorLog) => {
    setEditingCommentId(log.id);
    setEditingCommentText(log.developer_comment || "");
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const saveComment = (id: string) => {
    updateLogMutation.mutate({ id, developer_comment: editingCommentText || null });
  };

  const toggleSelectLog = (id: string) => {
    const newSelected = new Set(selectedLogIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLogIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLogIds.size === errorLogs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(errorLogs.map(log => log.id)));
    }
  };

  const confirmBulkDelete = () => {
    if (selectedLogIds.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedLogIds));
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href={backUrl}>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]"
              data-testid="button-back-to-chat"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#111827] flex items-center gap-2">
              <FileText className="h-6 w-6 text-[#3B82F6]" />
              Query Logs
            </h1>
            <p className="text-sm text-[#6B7280]">
              View and manage logged queries for review
            </p>
          </div>
        </div>

        <Card className="border border-[#E5E7EB]">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[#111827] flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#6B7280]" />
                All Query Logs ({errorLogs.length})
              </CardTitle>
              {selectedLogIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="flex items-center gap-2"
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected ({selectedLogIds.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border border-[#E5E7EB] rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : errorLogs.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-[#D1D5DB] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[#374151] mb-2">
                  No query logs yet
                </h3>
                <p className="text-sm text-[#6B7280] max-w-md mx-auto">
                  When you want to log a query for review, use the "Log Query" button.
                  Logged queries will appear here.
                </p>
                <Link href={backUrl}>
                  <Button
                    className="mt-4 bg-[#8BC34A] hover:bg-[#689F38] text-white"
                    data-testid="button-go-to-chat"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Go to Chat
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="w-full">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="border-b border-[#E5E7EB]">
                      <TableHead className="text-[#6B7280] font-medium w-[3%]">
                        <Checkbox
                          checked={errorLogs.length > 0 && selectedLogIds.size === errorLogs.length}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[4%]">S.No</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[8%]">Date</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[11%]">User</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[15%]">Question</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[12%]">Error</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[12%]">Comment</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[15%]">Developer Comment</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[12%]">Status</TableHead>
                      <TableHead className="text-[#6B7280] font-medium w-[8%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorLogs.map((log, index) => {
                      const status = (log.status as ErrorLogStatus) || "pending";
                      const statusConfig = STATUS_CONFIG[status];
                      const StatusIcon = statusConfig.icon;
                      
                      return (
                        <TableRow
                          key={log.id}
                          className={`border-b border-[#E5E7EB] hover:bg-[#F3F4F6] ${selectedLogIds.has(log.id) ? 'bg-[#EFF6FF]' : ''}`}
                          data-testid={`row-error-log-${log.id}`}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedLogIds.has(log.id)}
                              onCheckedChange={() => toggleSelectLog(log.id)}
                              data-testid={`checkbox-select-log-${log.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-[#374151] font-medium text-center">
                            {index + 1}
                          </TableCell>
                          <TableCell className="text-sm text-[#374151]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-[#9CA3AF]" />
                              {format(new Date(log.created_at), "MMM d, yyyy")}
                            </div>
                            <div className="text-xs text-[#9CA3AF] mt-0.5">
                              {format(new Date(log.created_at), "h:mm a")}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-[#374151]">
                            <div className="text-sm text-[#6366F1] truncate" title={log.user_email || undefined}>
                              {log.user_email || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell className="overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm text-[#111827] line-clamp-3 break-words cursor-default">
                                  {log.question}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-md bg-white border shadow-lg p-3">
                                <p className="text-sm text-[#374151] whitespace-pre-wrap">{log.question}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm text-[#DC2626] line-clamp-3 break-words cursor-default">
                                  {cleanLogContent(log.error_message) || "Unknown error"}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-md bg-white border shadow-lg p-3">
                                <p className="text-sm text-[#374151] whitespace-pre-wrap">{cleanLogContent(log.error_message) || "Unknown error"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm text-[#6B7280] line-clamp-3 break-words cursor-default">
                                  {log.user_comment || <span className="text-[#9CA3AF] italic">None</span>}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-md bg-white border shadow-lg p-3">
                                <p className="text-sm text-[#374151] whitespace-pre-wrap">{log.user_comment || "No comment"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="overflow-hidden">
                            {editingCommentId === log.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  placeholder="Add developer notes..."
                                  className="min-h-[60px] text-sm resize-none"
                                  data-testid={`input-developer-comment-${log.id}`}
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[#10B981] hover:text-[#059669] hover:bg-[#10B981]/10"
                                    onClick={() => saveComment(log.id)}
                                    disabled={updateLogMutation.isPending}
                                    data-testid={`button-save-comment-${log.id}`}
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#E5E7EB]"
                                    onClick={cancelEditingComment}
                                    data-testid={`button-cancel-comment-${log.id}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-sm text-[#374151] line-clamp-3 break-words flex-1 cursor-default">
                                      {log.developer_comment || (
                                        <span className="text-[#9CA3AF] italic">No developer notes</span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  {log.developer_comment && (
                                    <TooltipContent side="bottom" className="max-w-md bg-white border shadow-lg p-3">
                                      <p className="text-sm text-[#374151] whitespace-pre-wrap">{log.developer_comment}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#E5E7EB] shrink-0"
                                  onClick={() => startEditingComment(log)}
                                  data-testid={`button-edit-comment-${log.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`h-7 px-2 text-xs font-medium border whitespace-nowrap ${statusConfig.color}`}
                                  data-testid={`button-status-${log.id}`}
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig.label}
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white">
                                {ERROR_LOG_STATUSES.map((s) => {
                                  const config = STATUS_CONFIG[s];
                                  const Icon = config.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={s}
                                      onClick={() => handleStatusChange(log.id, s)}
                                      className="flex items-center gap-2 cursor-pointer"
                                      data-testid={`menu-status-${s}-${log.id}`}
                                    >
                                      <Icon className="h-3.5 w-3.5" />
                                      {config.label}
                                      {status === s && <Check className="h-3.5 w-3.5 ml-auto" />}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {canViewChat(log) ? (
                                <Link href={`/?chat=${log.chat_id}`}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-[#3B82F6] hover:text-[#2563EB] hover:bg-[#3B82F6]/10"
                                    data-testid={`button-view-chat-${log.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                </Link>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-[#9CA3AF] cursor-not-allowed"
                                      disabled
                                      data-testid={`button-view-chat-disabled-${log.id}`}
                                    >
                                      <Lock className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>This chat belongs to another user</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-[#DC2626] hover:text-[#B91C1C] hover:bg-[#DC2626]/10"
                                onClick={() => handleDeleteLog(log.id)}
                                data-testid={`button-delete-log-${log.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteLogId} onOpenChange={() => setDeleteLogId(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#111827]">Delete Query Log</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              Are you sure you want to delete this query log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#111827]">Delete Selected Logs</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              Are you sure you want to delete {selectedLogIds.size} selected query log(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedLogIds.size} Log(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
