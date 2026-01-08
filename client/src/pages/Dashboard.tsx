import { useDashboardStats, useComplianceAlerts, useRecentActivity } from "@/hooks/use-dashboard";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Clock,
  Plus,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useComplianceAlerts();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-semibold" data-testid="text-error-title">Failed to load dashboard</h2>
        <p className="text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Dashboard</h1>
          <p className="text-slate-500" data-testid="text-page-description">Compliance Health Overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/documents">
            <Button data-testid="button-new-document">
              <Plus className="w-4 h-4 mr-2" />
              New Document
            </Button>
          </Link>
          <Link href="/users">
            <Button variant="outline" data-testid="button-manage-users">
              <Users className="w-4 h-4 mr-2" />
              Manage Users
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-documents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-documents">{stats?.totalDocuments || 0}</div>
                <p className="text-xs text-muted-foreground" data-testid="text-approved-count">
                  {stats?.approvedDocuments || 0} approved
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-pending-approvals">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600" data-testid="text-pending-approvals">{stats?.pendingApprovals || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting review
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-expiring-soon">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-600" data-testid="text-expiring-documents">{stats?.expiringDocuments || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Within 30 days
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-non-compliant">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Non-Compliant</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600" data-testid="text-non-compliant">{stats?.nonCompliantDocuments || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Overdue for review
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card data-testid="card-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground" data-testid="text-pending-inductions">
                  {stats?.pendingInductions || 0} pending induction
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600" data-testid="text-compliance-rate">
                  {stats?.totalDocuments 
                    ? Math.round(((stats.approvedDocuments || 0) / stats.totalDocuments) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Documents approved
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Alerts */}
        <Card data-testid="card-compliance-alerts">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Compliance Alerts</CardTitle>
                <CardDescription>Documents requiring attention</CardDescription>
              </div>
              <Link href="/documents">
                <Button variant="ghost" size="sm" data-testid="link-view-all-documents">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Skeleton className="h-4 w-4" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                ))
              ) : alerts && alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-lg border ${
                      alert.alertLevel === 'red' 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {alert.alertLevel === 'red' ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        )}
                        <div>
                          <p className="font-medium text-sm" data-testid={`text-alert-code-${alert.id}`}>{alert.documentCode}</p>
                          <p className="text-xs text-slate-600" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={alert.alertLevel === 'red' ? 'destructive' : 'secondary'}
                        data-testid={`badge-alert-${alert.id}`}
                      >
                        {alert.daysUntilExpiry < 0 
                          ? `${Math.abs(alert.daysUntilExpiry)} days overdue`
                          : `${alert.daysUntilExpiry} days left`
                        }
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500" data-testid="text-no-alerts">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>All documents are compliant</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-testid="card-recent-activity">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Audit trail of recent actions</CardDescription>
              </div>
              <Link href="/audit-log">
                <Button variant="ghost" size="sm" data-testid="link-view-all-activity">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : activity && activity.length > 0 ? (
                activity.slice(0, 5).map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center gap-3 p-2 rounded hover:bg-slate-50"
                    data-testid={`activity-${log.id}`}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-activity-action-${log.id}`}>
                        {log.action.replace('_', ' ')} on {log.entityType}
                      </p>
                      <p className="text-xs text-slate-500" data-testid={`text-activity-time-${log.id}`}>
                        {log.createdAt ? format(new Date(log.createdAt), 'MMM d, h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500" data-testid="text-no-activity">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
