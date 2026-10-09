import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface MyTask {
  id: number;
  documentId?: number;
  documentCode?: string;
  employeeId?: number;
  employeeName?: string;
  employeeEmail?: string;
  employeePhone?: string;
  employeeJobTitle?: string;
  employeeDepartment?: string;
  employeeSupervisorName?: string;
  title: string;
  // review, approve, revise, comment, download_approval, access_approval, employee_review, employee_approve,
  // and every other kind of assignment (hub_approval, training, bug, lead_followup ...) shown generically
  taskType: string;
  taskKey?: string;
  typeLabel?: string;
  reference?: string;
  description?: string;
  link?: string;
  isOverdue?: boolean;
  status: string;
  createdAt: string | null;
  dueDate: string | null;
  downloadRequestId?: number;
  accessRequestId?: number;
  requesterId?: number;
  requesterName?: string;
  reason?: string;
  reviewerId?: number;
  reviewerName?: string;
  approverId?: number;
  approverName?: string;
  reviewCompleted?: boolean;
  approveCompleted?: boolean;
  returnedByName?: string | null;
  returnNote?: string | null;
  commentCount?: number;
}

// Task types with their own buttons in the task screens; anything else opens task.link
export const SPECIAL_TASK_TYPES = new Set([
  'review', 'approve', 'download_approval', 'access_approval', 'employee_review', 'employee_approve',
]);

export interface TaskPerformance {
  tasksAssigned: number;
  tasksCompleted: number;
  tasksCompletedOnTime: number;
  tasksCompletedLate: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksTransferred: number;
  reworkCount: number;
  totalTaskMinutes: number;
  avgTurnaroundMinutes: number | null;
  avgDelayMinutes: number | null;
  onTimeRate: number | null;
  completionRate: number | null;
  efficiencyPercent: number | null;
  performanceScore: number | null;
  breakdown: Record<string, { label: string; completed: number; onTime: number; late: number; open: number; avgMinutes: number | null }>;
}

export function useTaskPerformance(params?: { userId?: number; month?: number; year?: number }) {
  const search = new URLSearchParams();
  if (params?.userId) search.set('userId', String(params.userId));
  if (params?.month) search.set('month', String(params.month));
  if (params?.year) search.set('year', String(params.year));
  const qs = search.toString();
  return useQuery<TaskPerformance>({
    queryKey: [`/api/task-performance${qs ? `?${qs}` : ''}`],
    staleTime: 30 * 1000,
  });
}

// "3h 20m", "2d 4h"
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
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
