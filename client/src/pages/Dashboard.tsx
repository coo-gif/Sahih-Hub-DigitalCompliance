import { useDashboardStats, useComplianceAlerts, useRecentActivity } from "@/hooks/use-dashboard";
import { useMyTasks, useCompleteTask } from "@/hooks/use-tasks";
import { useDocument } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
  ClipboardList,
  FileCheck,
  FilePen,
  FileSignature,
  LayoutDashboard,
  Activity
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import type { MyTask } from "@/hooks/use-tasks";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useComplianceAlerts();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: myTasks, isLoading: tasksLoading } = useMyTasks();
  const { data: allUsers } = useUsers();
  const completeTaskMutation = useCompleteTask();
  const { toast } = useToast();

  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskComments, setTaskComments] = useState("");

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'prepare':
        return <FilePen className="w-4 h-4 text-blue-600" />;
      case 'review':
        return <FileCheck className="w-4 h-4 text-amber-600" />;
      case 'approve':
        return <FileSignature className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTaskBadgeColor = (taskType: string) => {
    switch (taskType) {
      case 'prepare':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-amber-100 text-amber-800';
      case 'approve':
        return 'bg-green-100 text-green-800';
      default:
        return '';
    }
  };

  const handleOpenTask = (task: MyTask) => {
    setSelectedTask(task);
    setTaskComments("");
    setShowTaskDialog(true);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    
    try {
      await completeTaskMutation.mutateAsync({
        documentId: selectedTask.documentId,
        taskType: selectedTask.taskType,
        comments: taskComments || undefined,
      });
      
      toast({
        title: "Task Completed",
        description: `Successfully completed ${selectedTask.taskType} task for ${selectedTask.documentCode}`,
      });
      
      setShowTaskDialog(false);
      setSelectedTask(null);
      setTaskComments("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-semibold" data-testid="text-error-title">Failed to load dashboard</h2>
        <p className="text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
      </div>
    );
  }

  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Dashboard</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex" data-testid="tabs-dashboard-nav">
            <TabsTrigger 
              value="dashboard" 
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2"
              data-testid="tab-dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="compliance" 
              onClick={() => {
                const complianceSection = document.getElementById('compliance-section');
                complianceSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-2"
              data-testid="tab-compliance"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Compliance Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              onClick={() => navigate("/documents")}
              className="flex items-center gap-2"
              data-testid="tab-new-document"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Document</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              onClick={() => navigate("/users")}
              className="flex items-center gap-2"
              data-testid="tab-manage-users"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Manage Users</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          data-testid="card-total-documents"
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => navigate("/documents")}
        >
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

        <Card 
          data-testid="card-pending-approvals"
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => navigate("/documents")}
        >
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

        <Card 
          data-testid="card-expiring-soon"
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => {
            const complianceSection = document.getElementById('compliance-section');
            complianceSection?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
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

        <Card 
          data-testid="card-non-compliant"
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => {
            const complianceSection = document.getElementById('compliance-section');
            complianceSection?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
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
        <Card 
          data-testid="card-users"
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => navigate("/users")}
        >
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

        <Card 
          data-testid="card-compliance-rate"
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => navigate("/documents")}
        >
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

      <div id="compliance-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                          <p className="text-xs text-muted-foreground" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</p>
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
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-alerts">
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
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted"
                    data-testid={`activity-${log.id}`}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-activity-action-${log.id}`}>
                        {log.action.replace('_', ' ')} on {log.entityType}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-activity-time-${log.id}`}>
                        {log.createdAt ? format(new Date(log.createdAt), 'MMM d, h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activity">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Tasks Section */}
      <Card data-testid="card-my-tasks">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>My Tasks</CardTitle>
                <CardDescription>Documents assigned to you for action</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm" data-testid="badge-task-count">
              {myTasks?.length || 0} pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasksLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              ))
            ) : myTasks && myTasks.length > 0 ? (
              myTasks.map((task) => (
                <div 
                  key={`${task.documentId}-${task.taskType}`} 
                  className="p-4 rounded-lg border hover:border-primary/50 hover-elevate cursor-pointer transition-all"
                  onClick={() => handleOpenTask(task)}
                  data-testid={`task-${task.documentId}-${task.taskType}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {getTaskIcon(task.taskType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium" data-testid={`text-task-code-${task.documentId}`}>{task.documentCode}</p>
                          <Badge className={getTaskBadgeColor(task.taskType)} data-testid={`badge-task-type-${task.documentId}`}>
                            {task.taskType.charAt(0).toUpperCase() + task.taskType.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-task-title-${task.documentId}`}>{task.title}</p>
                      </div>
                    </div>
                    <Button size="sm" data-testid={`button-open-task-${task.documentId}`}>
                      Open
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-tasks">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">No pending tasks</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task Completion Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask && getTaskIcon(selectedTask.taskType)}
              Complete Task: {selectedTask?.taskType.charAt(0).toUpperCase()}{selectedTask?.taskType.slice(1)}
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.documentCode} - {selectedTask?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Document Code:</span>
                  <p className="font-medium">{selectedTask?.documentCode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium capitalize">{selectedTask?.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Task Type:</span>
                  <Badge className={selectedTask ? getTaskBadgeColor(selectedTask.taskType) : ''}>
                    {selectedTask?.taskType.charAt(0).toUpperCase()}{selectedTask?.taskType.slice(1)}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Due Date:</span>
                  <p className="font-medium">
                    {selectedTask?.dueDate 
                      ? format(new Date(selectedTask.dueDate), 'MMM d, yyyy')
                      : 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-comments">Comments (Optional)</Label>
              <Textarea
                id="task-comments"
                placeholder={`Add any comments for this ${selectedTask?.taskType} action...`}
                value={taskComments}
                onChange={(e) => setTaskComments(e.target.value)}
                rows={3}
                data-testid="textarea-task-comments"
              />
            </div>

            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {selectedTask?.taskType === 'prepare' && 'By completing this task, you confirm that you have prepared this document.'}
                {selectedTask?.taskType === 'review' && 'By completing this task, you confirm that you have reviewed this document and it is ready for approval.'}
                {selectedTask?.taskType === 'approve' && 'By completing this task, you confirm that you approve this document for publication.'}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Your name and signature will be recorded.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)} data-testid="button-cancel-task">
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteTask}
              disabled={completeTaskMutation.isPending}
              data-testid="button-complete-task"
            >
              {completeTaskMutation.isPending ? 'Completing...' : `Complete ${selectedTask?.taskType.charAt(0).toUpperCase()}${selectedTask?.taskType.slice(1)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
