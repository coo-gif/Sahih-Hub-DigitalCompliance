import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface GmailStatus {
  connected: boolean;
  mode?: 'oauth' | 'smtp' | 'connector';
  sendOnly?: boolean;
  oauthAvailable?: boolean;
  connectedAt?: string;
  error?: string;
}

export function useGmailStatus() {
  return useQuery<GmailStatus>({
    queryKey: ['/api/gmail/status'],
    staleTime: 60000,
  });
}

export function useConnectGmail() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/gmail/connect', {
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start Gmail connection');
      }
      return response.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      window.location.href = data.authUrl;
    },
  });
}

export function useDisconnectGmail() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/gmail/disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/unread-count'] });
    },
  });
}

export interface EmailListItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  labelIds?: string[];
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  snippet: string;
  body: string;
  isUnread: boolean;
  labels?: string[];
  labelIds?: string[];
  attachments?: EmailAttachment[];
}

export interface SendEmailData {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: { filename: string; mimeType: string; content: string }[];
  inReplyTo?: string;
  references?: string;
}

export function useEmails(maxResults: number = 20, label: string = 'INBOX') {
  return useQuery<EmailListItem[]>({
    queryKey: ['/api/gmail/emails', maxResults, label],
    queryFn: async () => {
      const response = await fetch(`/api/gmail/emails?maxResults=${maxResults}&label=${label}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      return response.json();
    },
    refetchInterval: 60000,
  });
}

export function useEmail(id: string | null) {
  return useQuery<EmailMessage>({
    queryKey: ['/api/gmail/emails', id],
    queryFn: async () => {
      const response = await fetch(`/api/gmail/emails/${id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch email');
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useSendEmail() {
  return useMutation({
    mutationFn: async (data: SendEmailData) => {
      const response = await apiRequest('POST', '/api/gmail/send', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
    },
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['/api/gmail/unread-count'],
    refetchInterval: 30000,
  });
}

export function useMarkAsRead() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/gmail/mark-read/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/unread-count'] });
    },
  });
}

export function useDeleteEmail() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/gmail/delete/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/unread-count'] });
    },
  });
}

export function useArchiveEmail() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/gmail/archive/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
    },
  });
}

export function useStarEmail() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/gmail/star/${id}`);
      return { ...(await response.json()), id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/thread'] });
    },
  });
}

export function useUnstarEmail() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/gmail/unstar/${id}`);
      return { ...(await response.json()), id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/thread'] });
    },
  });
}

export function useMarkAsSpam() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/gmail/spam/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/unread-count'] });
    },
  });
}

export function useMarkAsUnread() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/gmail/mark-unread/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/unread-count'] });
    },
  });
}

export function useMoveToFolder() {
  return useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
      const response = await apiRequest('POST', `/api/gmail/move/${id}`, { folder });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/unread-count'] });
    },
  });
}

export function useLabels() {
  return useQuery<{ id: string; name: string; type: string }[]>({
    queryKey: ['/api/gmail/labels'],
  });
}

export function useThread(threadId: string | null) {
  return useQuery<EmailMessage[]>({
    queryKey: ['/api/gmail/thread', threadId],
    queryFn: async () => {
      const response = await fetch(`/api/gmail/thread/${threadId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch thread');
      }
      return response.json();
    },
    enabled: !!threadId,
  });
}

export interface AIDraftRequest {
  prompt: string;
  context?: string;
  action: 'compose' | 'reply' | 'grammar' | 'summarize';
}

export function useAIDraft() {
  return useMutation({
    mutationFn: async (data: AIDraftRequest) => {
      const response = await apiRequest('POST', '/api/gmail/ai-draft', data);
      return response.json() as Promise<{ result: string }>;
    },
  });
}
