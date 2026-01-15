import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useGmailStatus() {
  return useQuery<{ connected: boolean; error?: string }>({
    queryKey: ['/api/gmail/status'],
    staleTime: 60000,
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
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  isUnread: boolean;
  labels: string[];
}

export interface SendEmailData {
  to: string;
  subject: string;
  body: string;
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

export function useLabels() {
  return useQuery<{ id: string; name: string; type: string }[]>({
    queryKey: ['/api/gmail/labels'],
  });
}
