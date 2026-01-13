import { useAuditLogs } from "@/hooks/use-audit-logs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { History, AlertCircle } from "lucide-react";

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  submit_for_review: "bg-amber-100 text-amber-700",
  approve: "bg-emerald-100 text-emerald-700",
  reject: "bg-rose-100 text-rose-700",
  publish: "bg-purple-100 text-purple-700",
  archive: "bg-muted text-slate-700",
};

export default function AuditLog() {
  const { data: logs, isLoading, isError } = useAuditLogs();

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-semibold" data-testid="text-error-title">Failed to load audit logs</h2>
        <p className="text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Audit Log</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">ISO 17021 Compliance Trail - All Actions Recorded</p>
        </div>
      </div>

      <Card data-testid="card-audit-log">
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Activity History</CardTitle>
          </div>
          <CardDescription>
            Complete audit trail of all system actions for UKAS surveillance compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : logs && logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-timestamp-${log.id}`}>
                      {log.createdAt 
                        ? format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={actionColors[log.action] || "bg-muted text-slate-700"} 
                        variant="secondary"
                        data-testid={`badge-action-${log.id}`}
                      >
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize" data-testid={`text-entity-type-${log.id}`}>{log.entityType}</TableCell>
                    <TableCell data-testid={`text-entity-id-${log.id}`}>{log.entityId || "-"}</TableCell>
                    <TableCell data-testid={`text-user-${log.id}`}>{log.userName || 'System'}</TableCell>
                    <TableCell className="max-w-xs truncate" data-testid={`text-details-${log.id}`}>
                      {log.newValue ? (
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.newValue.substring(0, 50)}...
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="text-no-logs">
                    No audit logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
