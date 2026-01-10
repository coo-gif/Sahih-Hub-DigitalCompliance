import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DocumentFeedback } from "@shared/schema";

export function useDocumentFeedback(documentId: number | null) {
  return useQuery<DocumentFeedback[]>({
    queryKey: ['/api/documents', documentId, 'feedback'],
    enabled: !!documentId,
  });
}

export function useCreateFeedback() {
  return useMutation({
    mutationFn: async (data: { 
      documentId: number; 
      content: string; 
      feedbackType: 'comment' | 'correction' | 'suggestion';
      role: 'reviewer' | 'approver';
    }) => {
      const response = await apiRequest(
        "POST", 
        `/api/documents/${data.documentId}/feedback`,
        { 
          content: data.content, 
          feedbackType: data.feedbackType,
          role: data.role 
        }
      );
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', variables.documentId, 'feedback'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
}

export function useMarkFeedbackAddressed() {
  return useMutation({
    mutationFn: async (feedbackId: number) => {
      const response = await apiRequest("POST", `/api/feedback/${feedbackId}/address`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
  });
}
