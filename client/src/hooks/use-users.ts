import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserInput, UserUpdateInput } from "@shared/routes";

interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  inductionStatus: string;
  isActive: boolean | null;
  dateJoined: string | null;
  lastLogin: string | null;
  signatureDataUrl: string | null;
}

export function useUsers() {
  return useQuery<UserResponse[]>({
    queryKey: ['/api/users'],
  });
}

export function useUser(id: number) {
  return useQuery<UserResponse>({
    queryKey: ['/api/users', id],
    enabled: !!id,
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (data: UserInput) => {
      const res = await apiRequest('POST', '/api/users', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UserUpdateInput }) => {
      const res = await apiRequest('PUT', `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
  });
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
  });
}

export function useUpdateSignature() {
  return useMutation({
    mutationFn: async ({ id, signatureDataUrl }: { id: number; signatureDataUrl: string | null }) => {
      const res = await apiRequest('PUT', `/api/users/${id}/signature`, { signatureDataUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });
}

interface ActiveUser {
  id: number;
  name: string;
  email: string;
  role: string;
  lastActivity: string | null;
  isOnline: boolean;
}

export function useActiveUsers() {
  return useQuery<ActiveUser[]>({
    queryKey: ['/api/users/active'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useActivityHeartbeat() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/activity/heartbeat');
      return res.json();
    },
  });
}
