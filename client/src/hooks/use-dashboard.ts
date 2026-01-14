import { useQuery } from "@tanstack/react-query";
import type { DashboardStats, ComplianceAlert } from "@shared/routes";
import type { AuditLog } from "@shared/schema";

export type ActivityLog = AuditLog & { 
  userName?: string; 
  documentTitle?: string; 
  documentCode?: string;
};

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });
}

export function useComplianceAlerts() {
  return useQuery<ComplianceAlert[]>({
    queryKey: ['/api/dashboard/alerts'],
  });
}

export function useRecentActivity() {
  return useQuery<ActivityLog[]>({
    queryKey: ['/api/dashboard/activity'],
  });
}
