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

export function useMyTasks() {
  return useQuery<MyTask[]>({
    queryKey: ['/api/my-tasks'],
  });
}

export function useCompleteTask() {
  return useMutation({
    mutationFn: async ({ documentId, taskType, comments }: { 
      documentId: number; 
      taskType: 'prepare' | 'review' | 'approve';
      comments?: string;
    }) => {
      const res = await apiRequest('POST', `/api/my-tasks/${documentId}/complete`, {
        taskType,
        comments,
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
