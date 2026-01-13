import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Document } from "@shared/schema";
import type { DocumentInput, DocumentUpdateInput } from "@shared/routes";

export function useDocuments(filters?: { status?: string; category?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.category) params.append('category', filters.category);
  const queryString = params.toString();
  const url = queryString ? `/api/documents?${queryString}` : '/api/documents';
  
  return useQuery<Document[]>({
    queryKey: [url],
  });
}

export function useDocument(id: number) {
  return useQuery<Document>({
    queryKey: ['/api/documents', id],
    enabled: !!id,
  });
}

export function useCreateDocument() {
  return useMutation({
    mutationFn: async (data: DocumentInput) => {
      const res = await apiRequest('POST', '/api/documents', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
  });
}

export function useUpdateDocument() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DocumentUpdateInput }) => {
      const res = await apiRequest('PUT', `/api/documents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
  });
}

export function useDeleteDocument() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
  });
}

export function useSubmitDocumentForReview() {
  return useMutation({
    mutationFn: async ({ id, reviewerId, approverId, notes }: { id: number; reviewerId: number; approverId?: number; notes?: string }) => {
      const res = await apiRequest('POST', `/api/documents/${id}/submit-review`, { reviewerId, approverId, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
    },
  });
}

// Document Access Control
export function useDocumentAccessCheck(documentId: number) {
  return useQuery<{ hasAccess: boolean }>({
    queryKey: ['/api/documents', documentId, 'access'],
    enabled: !!documentId,
  });
}

export function useDocumentAccessRequests(filters?: { documentId?: number; requesterId?: number; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.documentId) params.append('documentId', String(filters.documentId));
  if (filters?.requesterId) params.append('requesterId', String(filters.requesterId));
  if (filters?.status) params.append('status', filters.status);
  const queryString = params.toString();
  const url = queryString ? `/api/document-access-requests?${queryString}` : '/api/document-access-requests';
  
  return useQuery<any[]>({
    queryKey: ['/api/document-access-requests', filters],
  });
}

export function useMyDocumentAccessRequests() {
  return useQuery<any[]>({
    queryKey: ['/api/document-access-requests', { mine: true }],
  });
}

export function useCreateDocumentAccessRequest() {
  return useMutation({
    mutationFn: async (data: { documentId: number; requestReason?: string }) => {
      const res = await apiRequest('POST', '/api/document-access-requests', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
}

export function useApproveDocumentAccessRequest() {
  return useMutation({
    mutationFn: async ({ id, decisionNote }: { id: number; decisionNote?: string }) => {
      const res = await apiRequest('POST', `/api/document-access-requests/${id}/approve`, { decisionNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-access'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
    },
  });
}

export function useRejectDocumentAccessRequest() {
  return useMutation({
    mutationFn: async ({ id, decisionNote }: { id: number; decisionNote?: string }) => {
      const res = await apiRequest('POST', `/api/document-access-requests/${id}/reject`, { decisionNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
    },
  });
}

export function useDocumentAccess(filters?: { documentId?: number; userId?: number }) {
  const params = new URLSearchParams();
  if (filters?.documentId) params.append('documentId', String(filters.documentId));
  if (filters?.userId) params.append('userId', String(filters.userId));
  const queryString = params.toString();
  const url = queryString ? `/api/document-access?${queryString}` : '/api/document-access';
  
  return useQuery<any[]>({
    queryKey: ['/api/document-access', filters],
  });
}
