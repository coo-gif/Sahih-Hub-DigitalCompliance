import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Clock, AlertTriangle, CheckCircle2, FileText, Target, Eye, Send, ThumbsUp, UserCheck, Download, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useMyTasks, useCompleteTask, MyTask } from "@/hooks/use-tasks";
import { useUsers } from "@/hooks/use-users";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

function TaskTypeBadge({ type }: { type: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    review: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Review" },
    approve: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Approve" },
    prepare: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Prepare" },
    download_approval: { className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", label: "Download Request" },
  };
  const config = variants[type] || { className: "", label: type };
  return <Badge className={config.className}>{config.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { className: string; label: string }> = {
    in_review: { className: "bg-blue-100 text-blue-700", label: "In Review" },
    pending_approval: { className: "bg-amber-100 text-amber-700", label: "Pending Approval" },
    draft: { className: "bg-slate-100 text-slate-700", label: "Draft" },
    approved: { className: "bg-green-100 text-green-700", label: "Approved" },
  };
  const config = statusConfig[status] || { className: "bg-muted", label: status };
  return <Badge className={config.className}>{config.label}</Badge>;
}

interface UserOption {
  id: number;
  name: string;
  role: string;
}

function CompleteTaskDialog({ 
  task, 
  open, 
  onOpenChange, 
  onComplete,
  isPending,
  users = []
}: { 
  task: MyTask; 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (comments: string, approverId?: number) => void;
  isPending: boolean;
  users?: UserOption[];
}) {
  const [comments, setComments] = useState("");
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");

  const handleComplete = () => {
    const approverId = selectedApproverId ? parseInt(selectedApproverId) : undefined;
    onComplete(comments, approverId);
    setComments("");
    setSelectedApproverId("");
  };

  const actionLabel = task.taskType === 'review' ? 'Complete Review & Send for Approval' : 
                      task.taskType === 'approve' ? 'Approve Document' : 'Complete Task';

  const approverCandidates = users.filter(u => 
    u.role === 'admin' || u.role === 'quality_manager'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task.taskType === 'review' ? 'Complete Review' : actionLabel}</DialogTitle>
          <DialogDescription>
            {task.taskType === 'review' 
              ? `Review completed for ${task.documentCode} - ${task.title}. Select who should approve this document.` 
              : task.taskType === 'approve'
              ? `Final approval for ${task.documentCode} - ${task.title}`
              : `Complete task for ${task.documentCode}`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {task.taskType === 'review' && (
            <div className="space-y-2">
              <Label htmlFor="approver" className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                Select Approver <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                <SelectTrigger id="approver" data-testid="select-approver">
                  <SelectValue placeholder="Choose who will approve this document" />
                </SelectTrigger>
                <SelectContent>
                  {approverCandidates.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.role.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The selected person will receive a notification to approve this document.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="comments">Comments (optional)</Label>
            <Textarea
              id="comments"
              placeholder="Add any notes or comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleComplete} 
            disabled={isPending || (task.taskType === 'review' && !selectedApproverId)}
          >
            {isPending ? "Processing..." : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MyTasks() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const { data: tasks = [], isLoading } = useMyTasks();
  const { data: users = [] } = useUsers();
  const completeMutation = useCompleteTask();

  const approveDownloadMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/download-requests/${requestId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/download-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const rejectDownloadMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/download-requests/${requestId}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/download-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const pendingTasks = tasks.filter(t => t.taskType === 'review' || t.taskType === 'approve' || t.taskType === 'download_approval');
  const completedCount = 0;

  const handleCompleteTask = (comments: string, approverId?: number) => {
    if (!selectedTask) return;
    
    completeMutation.mutate(
      { 
        documentId: selectedTask.documentId, 
        taskType: selectedTask.taskType,
        comments,
        approverId 
      },
      {
        onSuccess: () => {
          const message = selectedTask.taskType === 'review' 
            ? `Review completed and sent for approval` 
            : `Approval completed for ${selectedTask.documentCode}`;
          toast({
            title: "Task completed",
            description: message,
          });
          setShowCompleteDialog(false);
          setSelectedTask(null);
        },
        onError: (error: Error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const openCompleteDialog = (task: MyTask) => {
    setSelectedTask(task);
    setShowCompleteDialog(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-page-title">My Tasks</h1>
        <p className="text-muted-foreground mt-1" data-testid="text-page-description">
          Document workflow tasks assigned to you
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-pending-count">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold" data-testid="text-pending-count">{pendingTasks.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Pending Tasks</p>
          </CardContent>
        </Card>
        <Card data-testid="card-overdue-count">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold" data-testid="text-overdue-count">0</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Overdue</p>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-count">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold" data-testid="text-completed-count">{completedCount}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card data-testid="card-points">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold" data-testid="text-points">0</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Points Earned</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Pending Tasks</h2>
        {pendingTasks.length === 0 ? (
          <Card data-testid="card-empty-state">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground">You have no pending tasks.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4" data-testid="tasks-list">
            {pendingTasks.map((task) => (
              <Card key={task.id} data-testid={`task-card-${task.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded" data-testid={`task-code-${task.id}`}>
                        {task.documentCode}
                      </span>
                      <TaskTypeBadge type={task.taskType} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span data-testid={`task-title-${task.id}`}>{task.title}</span>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {task.taskType === 'review' 
                      ? 'This document requires your review before it can proceed to approval.'
                      : task.taskType === 'approve'
                      ? 'This document is awaiting your final approval.'
                      : task.taskType === 'download_approval'
                      ? `A user has requested permission to download this document.${task.reason ? ` Reason: "${task.reason}"` : ''}`
                      : 'This task requires your attention.'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => navigate(`/documents/${task.documentId}/view`)}
                      className="gap-1"
                      data-testid={`button-view-${task.id}`}
                    >
                      <Eye className="h-4 w-4" />
                      View Document
                    </Button>
                    {task.taskType === 'download_approval' ? (
                      <>
                        <Button 
                          onClick={() => {
                            if (task.downloadRequestId) {
                              approveDownloadMutation.mutate(task.downloadRequestId, {
                                onSuccess: () => {
                                  toast({
                                    title: "Download Approved",
                                    description: `Download request for ${task.documentCode} has been approved.`,
                                  });
                                },
                                onError: (error: Error) => {
                                  toast({
                                    title: "Error",
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                },
                              });
                            }
                          }}
                          disabled={approveDownloadMutation.isPending}
                          className="gap-1"
                          data-testid={`button-approve-download-${task.id}`}
                        >
                          <Download className="h-4 w-4" />
                          {approveDownloadMutation.isPending ? "Approving..." : "Approve Download"}
                        </Button>
                        <Button 
                          variant="destructive"
                          onClick={() => {
                            if (task.downloadRequestId) {
                              rejectDownloadMutation.mutate(task.downloadRequestId, {
                                onSuccess: () => {
                                  toast({
                                    title: "Download Rejected",
                                    description: `Download request for ${task.documentCode} has been rejected.`,
                                  });
                                },
                                onError: (error: Error) => {
                                  toast({
                                    title: "Error",
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                },
                              });
                            }
                          }}
                          disabled={rejectDownloadMutation.isPending}
                          className="gap-1"
                          data-testid={`button-reject-download-${task.id}`}
                        >
                          <X className="h-4 w-4" />
                          {rejectDownloadMutation.isPending ? "Rejecting..." : "Reject"}
                        </Button>
                      </>
                    ) : (
                      <Button 
                        onClick={() => openCompleteDialog(task)}
                        className="gap-1"
                        data-testid={`button-complete-${task.id}`}
                      >
                        {task.taskType === 'review' ? (
                          <>
                            <Send className="h-4 w-4" />
                            Complete Review
                          </>
                        ) : task.taskType === 'approve' ? (
                          <>
                            <ThumbsUp className="h-4 w-4" />
                            Approve
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Complete Task
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <CompleteTaskDialog
          task={selectedTask}
          open={showCompleteDialog}
          onOpenChange={setShowCompleteDialog}
          onComplete={handleCompleteTask}
          isPending={completeMutation.isPending}
          users={users}
        />
      )}
    </div>
  );
}
