import { useQuery } from "@tanstack/react-query";

interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  return useQuery<CurrentUser>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      const data = await response.json();
      return data.user;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
