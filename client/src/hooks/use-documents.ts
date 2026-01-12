import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Document } from "@shared/schema";
import type { DocumentInput, DocumentUpdateInput, SubmitForReviewInput, ApproveInput, RejectInput } from "@shared/routes";

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

export function useSubmitForReview() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: SubmitForReviewInput }) => {
      const res = await apiRequest('POST', `/api/documents/${id}/submit-review`, data);
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

export function useApproveDocument() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ApproveInput }) => {
      const res = await apiRequest('POST', `/api/documents/${id}/approve`, data);
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

export function useRejectDocument() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RejectInput }) => {
      const res = await apiRequest('POST', `/api/documents/${id}/reject`, data);
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
