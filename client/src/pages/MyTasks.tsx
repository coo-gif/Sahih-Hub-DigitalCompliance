import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Clock, AlertTriangle, CheckCircle2, Bell, FileText, User, Calendar, Target } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";

interface DocumentTask {
  id: number;
  documentId: number;
  taskNumber: string;
  taskType: string;
  assignedToId: number;
  assignedById: number;
  status: string;
  targetDate: string;
  targetHours: number;
  assignedAt: string;
  completedAt: string | null;
  earlyHours: number | null;
  delayHours: number | null;
  performancePoints: number | null;
  isVisible: boolean;
  documentCode: string;
  documentTitle: string;
  currentDelayHours: number;
}

function TaskStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    assigned: { variant: "default", label: "Assigned" },
    in_progress: { variant: "default", label: "In Progress" },
    completed: { variant: "outline", label: "Completed" },
  };
  const config = variants[status] || { variant: "secondary", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function TaskTypeBadge({ type }: { type: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    review: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Review" },
    approve: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Approve" },
    prepare: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Prepare" },
  };
  const config = variants[type] || { className: "", label: type };
  return <Badge className={config.className}>{config.label}</Badge>;
}

function DelayIndicator({ delayHours }: { delayHours: number }) {
  if (delayHours === 0) {
    return (
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
        <Clock className="h-4 w-4" />
        <span>On time</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-medium">
      <AlertTriangle className="h-4 w-4" />
      <span>{delayHours} hour{delayHours !== 1 ? 's' : ''} overdue</span>
    </div>
  );
}

function PokeDialog({ task, onPoke }: { task: DocumentTask; onPoke: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  const handlePoke = () => {
    onPoke(message);
    setMessage("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Bell className="h-4 w-4" />
          Poke
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Reminder</DialogTitle>
          <DialogDescription>
            Send a reminder to the assigned person about task {task.taskNumber}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Optional message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[100px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handlePoke}>Send Reminder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MyTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<DocumentTask[]>({
    queryKey: ['/api/document-tasks'],
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest('POST', `/api/document-tasks/${taskId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-tasks'] });
      toast({
        title: "Task completed",
        description: "Your task has been marked as complete.",
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

  const pokeMutation = useMutation({
    mutationFn: async ({ taskId, message }: { taskId: number; message: string }) => {
      return apiRequest('POST', `/api/document-tasks/${taskId}/poke`, { message });
    },
    onSuccess: () => {
      toast({
        title: "Reminder sent",
        description: "A notification has been sent to the assigned person.",
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

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const overdueTasks = pendingTasks.filter(t => t.currentDelayHours > 0);

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
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Tasks</h1>
        <p className="text-muted-foreground mt-1">
          Document workflow tasks assigned to you
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{pendingTasks.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Pending Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{overdueTasks.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{completedTasks.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">
                {completedTasks.reduce((sum, t) => sum + (t.performancePoints || 0), 0)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Points Earned</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Pending Tasks</h2>
        {pendingTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground">You have no pending tasks.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingTasks.map((task) => (
              <Card key={task.id} className={task.currentDelayHours > 0 ? "border-red-200 dark:border-red-800" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{task.taskNumber}</span>
                      <TaskTypeBadge type={task.taskType} />
                      <TaskStatusBadge status={task.status} />
                    </div>
                    <DelayIndicator delayHours={task.currentDelayHours} />
                  </div>
                  <CardTitle className="text-lg mt-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      {task.documentTitle}
                    </div>
                  </CardTitle>
                  <CardDescription className="font-mono text-sm">
                    {task.documentCode}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Target:</span>
                      <div className="font-medium flex items-center gap-1 mt-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(task.targetDate), "PPp")}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Assigned:</span>
                      <div className="font-medium mt-1">
                        {formatDistanceToNow(new Date(task.assignedAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target Hours:</span>
                      <div className="font-medium mt-1">{task.targetHours}h</div>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={() => completeMutation.mutate(task.id)}
                      disabled={completeMutation.isPending}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete Task
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`/documents/${task.documentId}/edit`} data-testid={`link-view-document-${task.id}`}>
                        View Document
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Completed Tasks</h2>
          <div className="grid gap-4">
            {completedTasks.slice(0, 5).map((task) => (
              <Card key={task.id} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{task.taskNumber}</span>
                      <TaskTypeBadge type={task.taskType} />
                      <span className="text-muted-foreground">{task.documentTitle}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {task.earlyHours && task.earlyHours > 0 && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          {task.earlyHours}h early
                        </Badge>
                      )}
                      {task.delayHours && task.delayHours > 0 && (
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          {task.delayHours}h late
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {task.performancePoints || 0} pts
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
