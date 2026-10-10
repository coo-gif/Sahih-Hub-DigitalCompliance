import { useEffect } from "react";
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
  // Other users' signatures are not sent; this says whether one is on file
  hasSignature?: boolean;
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

const ACTIVITY_HEARTBEAT_MS = 2 * 60 * 1000;

function postActivity(path: string) {
  return fetch(path, { method: 'POST', credentials: 'include', keepalive: true }).catch(() => undefined);
}

// Closes the online-time session; used on logout and when the page is closed
export function endActivitySession() {
  return postActivity('/api/activity/end-session');
}

// Online-time tracking: a session starts when the app loads, heartbeats while the tab is visible,
// and ends on logout or when the page is closed. Long hidden periods are not counted.
export function useActivitySession() {
  useEffect(() => {
    let hiddenAt: number | null = null;
    // Set once the page is being closed, so no heartbeat reopens the session afterwards
    let closing = false;
    postActivity('/api/activity/start-session');

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') postActivity('/api/activity/session-heartbeat');
    }, ACTIVITY_HEARTBEAT_MS);

    const onVisibility = () => {
      if (closing) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        // Count the time up to now before the tab goes to the background
        postActivity('/api/activity/session-heartbeat');
      } else if (hiddenAt !== null) {
        // After a long absence start a fresh session so the hidden time is not counted
        if (Date.now() - hiddenAt >= ACTIVITY_HEARTBEAT_MS) postActivity('/api/activity/start-session');
        hiddenAt = null;
      }
    };
    const onPageHide = () => {
      closing = true;
      if (navigator.sendBeacon) navigator.sendBeacon('/api/activity/end-session');
      else endActivitySession();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        closing = false;
        postActivity('/api/activity/start-session');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
}
