import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@shared/schema";

export type AuditLogWithUser = AuditLog & { userName?: string };

export function useAuditLogs() {
  return useQuery<AuditLogWithUser[]>({
    queryKey: ['/api/audit-logs'],
  });
}
