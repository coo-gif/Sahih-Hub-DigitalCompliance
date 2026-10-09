import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Employee, EmployeeTask } from "@shared/schema";
import type { EmployeeInput, EmployeeUpdateInput, EmployeeTaskInput, EmployeeTaskUpdateInput } from "@shared/routes";

export function useEmployees(filters?: { status?: string; department?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.department) params.append('department', filters.department);
  const queryString = params.toString();
  const url = queryString ? `/api/employees?${queryString}` : '/api/employees';
  
  return useQuery<Employee[]>({
    queryKey: [url],
  });
}

export function useEmployee(id: number) {
  return useQuery<Employee>({
    queryKey: [`/api/employees/${id}`],
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  return useMutation({
    mutationFn: async (data: EmployeeInput) => {
      const res = await apiRequest('POST', '/api/employees', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
    },
  });
}

export function useUpdateEmployee() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmployeeUpdateInput }) => {
      const res = await apiRequest('PUT', `/api/employees/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
    },
  });
}

export function useDeleteEmployee() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employee-tasks'] });
    },
  });
}

export function useEmployeeTasks(filters?: { employeeId?: number; status?: string; documentId?: number }) {
  const params = new URLSearchParams();
  if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
  if (filters?.status) params.append('status', filters.status);
  if (filters?.documentId) params.append('documentId', String(filters.documentId));
  const queryString = params.toString();
  const url = queryString ? `/api/employee-tasks?${queryString}` : '/api/employee-tasks';
  
  return useQuery<EmployeeTask[]>({
    queryKey: [url],
  });
}

export function useEmployeeTask(id: number) {
  return useQuery<EmployeeTask>({
    queryKey: [`/api/employee-tasks/${id}`],
    enabled: !!id,
  });
}

export function useCreateEmployeeTask() {
  return useMutation({
    mutationFn: async (data: EmployeeTaskInput) => {
      const res = await apiRequest('POST', '/api/employee-tasks', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-tasks'] });
    },
  });
}

export function useUpdateEmployeeTask() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmployeeTaskUpdateInput }) => {
      const res = await apiRequest('PUT', `/api/employee-tasks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-tasks'] });
    },
  });
}

export function useDeleteEmployeeTask() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/employee-tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
    },
  });
}

export function useCompleteEmployeeTask() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/employee-tasks/${id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
    },
  });
}

export function useSubmitEmployeeForReview() {
  return useMutation({
    mutationFn: async ({ id, reviewerId, notes, targetDate }: { id: number; reviewerId: number; notes?: string; targetDate?: string }) => {
      const res = await apiRequest('POST', `/api/employees/${id}/submit-review`, { reviewerId, notes, targetDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
    },
  });
}

export function useSubmitEmployeeForApproval() {
  return useMutation({
    mutationFn: async ({ id, approverId, notes, targetDate }: { id: number; approverId: number; notes?: string; targetDate?: string }) => {
      const res = await apiRequest('POST', `/api/employees/${id}/submit-approval`, { approverId, notes, targetDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
    },
  });
}

export function useApproveEmployee() {
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await apiRequest('POST', `/api/employees/${id}/approve`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
    },
  });
}

export function useRejectEmployee() {
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await apiRequest('POST', `/api/employees/${id}/reject`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
    },
  });
}
