import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertPolicy } from "@shared/schema";

export function usePolicies() {
  return useQuery({
    queryKey: [api.policies.list.path],
    queryFn: async () => {
      const res = await fetch(api.policies.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch policies");
      return api.policies.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPolicy) => {
      const res = await fetch(api.policies.create.path, {
        method: api.policies.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create policy");
      return api.policies.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.policies.list.path] }),
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertPolicy>) => {
      const url = buildUrl(api.policies.update.path, { id });
      const res = await fetch(url, {
        method: api.policies.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update policy");
      return api.policies.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.policies.list.path] }),
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.policies.delete.path, { id });
      const res = await fetch(url, { 
        method: api.policies.delete.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete policy");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.policies.list.path] }),
  });
}
