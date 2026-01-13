import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface MyTask {
  id: number;
  documentId: number;
  documentCode: string;
  title: string;
  taskType: 'prepare' | 'review' | 'approve';
  status: string;
  createdAt: string | null;
  dueDate: string | null;
}

export interface DocumentTask {
  id: number;
  documentId: number;
  taskNumber: string;
  taskType: string;
  assignedToId: number;
  assignedById: number;
  status: string;
  targetDate: string;
  targetHours: number;
  assignedAt: string;
  completedAt: string | null;
  earlyHours: number | null;
  delayHours: number | null;
  performancePoints: number | null;
  isVisible: boolean;
  documentCode?: string;
  documentTitle?: string;
  currentDelayHours?: number;
}

export function useMyTasks() {
  return useQuery<MyTask[]>({
    queryKey: ['/api/my-tasks'],
  });
}

export function useDocumentTasks() {
  return useQuery<DocumentTask[]>({
    queryKey: ['/api/document-tasks'],
  });
}

export interface AllDocumentTask extends DocumentTask {
  assignedToName?: string;
}

export function useAllDocumentTasks(enabled: boolean = true) {
  return useQuery<AllDocumentTask[]>({
    queryKey: ['/api/document-tasks/all'],
    retry: false, // Don't retry if user doesn't have access
    enabled, // Only fetch if explicitly enabled (for managers only)
  });
}

export function useDocumentTasksForDocument(documentId: number | null) {
  return useQuery<DocumentTask[]>({
    queryKey: ['/api/documents', documentId, 'tasks'],
    enabled: !!documentId,
  });
}

export function useCompleteTask() {
  return useMutation({
    mutationFn: async ({ documentId, taskType, comments, approverId }: { 
      documentId: number; 
      taskType: 'prepare' | 'review' | 'approve';
      comments?: string;
      approverId?: number;
    }) => {
      const res = await apiRequest('POST', `/api/my-tasks/${documentId}/complete`, {
        taskType,
        comments,
        approverId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });
}

export function useCompleteDocumentTask() {
  return useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest('POST', `/api/document-tasks/${taskId}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
}

export function usePokeTask() {
  return useMutation({
    mutationFn: async ({ taskId, message }: { taskId: number; message?: string }) => {
      const res = await apiRequest('POST', `/api/document-tasks/${taskId}/poke`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
}
