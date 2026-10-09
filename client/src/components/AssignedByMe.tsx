import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, ExternalLink, Loader2, UserCog } from "lucide-react";
import { TargetDateField, targetToIso } from "@/components/TargetDateField";

export interface InitiatedTask {
  taskKey: string;
  taskType: string;
  typeLabel: string;
  title: string;
  reference: string;
  link: string;
  assigneeId: number;
  assigneeName: string | null;
  initiatorId: number | null;
  initiatorName: string | null;
  assignedAt: string;
  dueDate: string | null;
  isOverdue: boolean;
  canReassign: boolean;
}

// Tasks the current user assigned to others; the initiator can move them or change their target date
export function AssignedByMe({ canSeeAll }: { canSeeAll: boolean }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: users = [] } = useUsers();
  const [showAll, setShowAll] = useState(false);
  const queryKey = [`/api/tasks/initiated${showAll ? "?all=1" : ""}`];
  const { data: tasks = [], isLoading } = useQuery<InitiatedTask[]>({ queryKey });

  const [editing, setEditing] = useState<InitiatedTask | null>(null);
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");

  const openEditor = (task: InitiatedTask) => {
    setEditing(task);
    setNewAssigneeId(String(task.assigneeId));
    setTarget(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
    setReason("");
  };

  const changeMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const moving = Number(newAssigneeId) !== editing.assigneeId;
      const res = await apiRequest("POST", "/api/tasks/change", {
        taskKey: editing.taskKey,
        assigneeId: editing.assigneeId,
        newAssigneeId: moving ? Number(newAssigneeId) : undefined,
        targetDate: targetToIso(target),
        reason: reason || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/tasks/initiated") });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Task updated", description: "The assignee has been notified." });
      setEditing(null);
    },
    onError: (error: Error) => {
      toast({ title: "Could not update task", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Tasks you assigned to others. You can move a task to another person or change its target date.
        </p>
        {canSeeAll && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showAll} onCheckedChange={setShowAll} data-testid="switch-all-tasks" />
            Show everyone's open tasks
          </label>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">Nothing outstanding</p>
            <p className="text-muted-foreground">No open tasks that you assigned to others.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3" data-testid="assigned-by-me-list">
          {tasks.map(task => (
            <Card key={`${task.taskKey}-${task.assigneeId}`} data-testid={`initiated-task-${task.taskKey}`}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{task.reference}</span>
                    <Badge variant="secondary">{task.typeLabel}</Badge>
                    {task.dueDate && (
                      <Badge variant="outline" className={task.isOverdue ? "border-red-300 text-red-700 dark:text-red-300" : "text-muted-foreground"}>
                        {task.isOverdue ? "Overdue · was due " : "Due "}
                        {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium truncate">{task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    With <span className="font-medium text-foreground">{task.assigneeName}</span>
                    {" "}since {format(new Date(task.assignedAt), "MMM d, h:mm a")}
                    {showAll && task.initiatorName && <> · assigned by {task.initiatorName}</>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => navigate(task.link)}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button size="sm" onClick={() => openEditor(task)} data-testid={`button-change-task-${task.taskKey}`}>
                    <UserCog className="h-4 w-4 mr-1" />
                    Reassign / Change date
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Task</DialogTitle>
            <DialogDescription>
              {editing?.typeLabel}: {editing?.reference} - {editing?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="change-assignee">Assigned to</Label>
              <Select value={newAssigneeId} onValueChange={setNewAssigneeId} disabled={!editing?.canReassign}>
                <SelectTrigger id="change-assignee" data-testid="select-change-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editing?.canReassign && (
                <p className="text-xs text-muted-foreground">This kind of task is reassigned on its own page. You can change its target date here.</p>
              )}
            </div>
            <TargetDateField id="change-target" value={target} onChange={setTarget} />
            <div className="space-y-1.5">
              <Label htmlFor="change-reason">Reason (optional)</Label>
              <Textarea id="change-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. On leave this week" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => changeMutation.mutate()}
              disabled={!target || changeMutation.isPending}
              data-testid="button-confirm-change-task"
            >
              {changeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
