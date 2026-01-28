import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import type { Chat, Message } from '@shared/schema';

// ═══════════════════════════════════════════════════════════════
// EMBED TOKEN HELPER - For token-based auth in iframes
// ═══════════════════════════════════════════════════════════════

function getEmbedHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const embedToken = sessionStorage.getItem('embedToken');
    if (embedToken) {
      headers['X-Embed-Token'] = embedToken;
    }
  } catch {}
  return headers;
}

// ═══════════════════════════════════════════════════════════════
// CACHE CONFIGURATION - Optimized for instant switching like ChatGPT/Claude
// ═══════════════════════════════════════════════════════════════

// Messages stay fresh for 60 seconds - no refetch during this time
const MESSAGES_STALE_TIME = 60 * 1000; // 60 seconds

// Keep messages in cache for 5 minutes even after unmounting
const MESSAGES_GC_TIME = 5 * 60 * 1000; // 5 minutes

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export interface CreateChatParams {
  title?: string;
}

export interface CreateMessageParams {
  chatId: string;
  type: 'user' | 'bot';
  content: string;
  response?: any;
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
}

// ═══════════════════════════════════════════════════════════════
// REACT QUERY HOOKS - CHATS
// ═══════════════════════════════════════════════════════════════

export function useChats() {
  return useQuery<Chat[]>({
    queryKey: ['/api/chats'],
    queryFn: async () => {
      const response = await fetch('/api/chats', { 
        credentials: 'include',
        headers: getEmbedHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      return data.data;
    },
  });
}

export function useChat(chatId: string | null) {
  return useQuery<Chat | null>({
    queryKey: ['/api/chats', chatId],
    queryFn: async () => {
      if (!chatId) return null;
      const response = await fetch(`/api/chats/${chatId}`, { 
        credentials: 'include',
        headers: getEmbedHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch chat');
      const data = await response.json();
      return data.data;
    },
    enabled: !!chatId,
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CreateChatParams) => {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getEmbedHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'Failed to create chat');
      }
      const data = await response.json();
      return data.data as Chat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
  });
}

export function useUpdateChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ chatId, title }: { chatId: string; title: string }) => {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getEmbedHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ title }),
      });
      
      if (!response.ok) throw new Error('Failed to update chat');
      const data = await response.json();
      return data.data as Chat;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats', variables.chatId] });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (chatId: string) => {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getEmbedHeaders(),
      });
      
      if (!response.ok) throw new Error('Failed to delete chat');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// REACT QUERY HOOKS - MESSAGES
// ═══════════════════════════════════════════════════════════════

export function useMessages(chatId: string | null) {
  const queryClient = useQueryClient();
  
  return useQuery<Message[]>({
    queryKey: ['/api/chats', chatId, 'messages'],
    queryFn: async () => {
      if (!chatId) return [];
      const response = await fetch(`/api/chats/${chatId}/messages`, { 
        credentials: 'include',
        headers: getEmbedHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.data;
    },
    enabled: !!chatId,
    // Keep cached data fresh for 60 seconds - instant switching
    staleTime: MESSAGES_STALE_TIME,
    // Keep in cache for 5 minutes even after unmounting
    gcTime: MESSAGES_GC_TIME,
    // Return cached data immediately while refetching in background
    placeholderData: (previousData) => previousData,
    // Never show loading state if we have cached data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

// Prefetch messages for a chat - call on hover for instant loading
export function prefetchMessages(queryClient: QueryClient, chatId: string) {
  queryClient.prefetchQuery({
    queryKey: ['/api/chats', chatId, 'messages'],
    queryFn: async () => {
      const response = await fetch(`/api/chats/${chatId}/messages`, { 
        credentials: 'include',
        headers: getEmbedHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.data;
    },
    staleTime: MESSAGES_STALE_TIME,
  });
}

// Get cached messages without triggering a fetch
export function getCachedMessages(queryClient: QueryClient, chatId: string): Message[] | undefined {
  return queryClient.getQueryData<Message[]>(['/api/chats', chatId, 'messages']);
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CreateMessageParams) => {
      const { chatId, ...messageData } = params;
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getEmbedHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(messageData),
      });
      
      if (!response.ok) throw new Error('Failed to create message');
      const data = await response.json();
      return data.data as Message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/chats', variables.chatId, 'messages'],
        refetchType: 'none'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
  });
}
