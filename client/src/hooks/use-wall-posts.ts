import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WallPost } from "@shared/schema";

interface WallPostWithAuthor extends WallPost {
  authorName: string;
  authorRole: string;
}

export function useWallPosts(limit: number = 50) {
  return useQuery<WallPostWithAuthor[]>({
    queryKey: ['/api/wall-posts', limit],
    queryFn: async () => {
      const res = await fetch(`/api/wall-posts?limit=${limit}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch wall posts');
      return res.json();
    },
  });
}

export function useCreateWallPost() {
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest('POST', '/api/wall-posts', { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wall-posts'] });
    },
  });
}

export function useDeleteWallPost() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/wall-posts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wall-posts'] });
    },
  });
}

export function usePinWallPost() {
  return useMutation({
    mutationFn: async ({ id, isPinned }: { id: number; isPinned: boolean }) => {
      const res = await apiRequest('POST', `/api/wall-posts/${id}/pin`, { isPinned });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wall-posts'] });
    },
  });
}
