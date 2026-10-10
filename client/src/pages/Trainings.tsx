import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserPlus, Award, CheckCircle2, Clock, BookOpen, Users, GraduationCap, Eye, Printer, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import type { Training, TrainingAssignment, TrainingCompletion, Employee } from "@shared/schema";
import { insertTrainingSchema, insertTrainingAssignmentSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import sahihLogo from "@assets/sahih_logo-1.png";

// Server errors arrive as `400: {"message": "..."}`; show just the message
function apiErrorMessage(error: Error): string {
  const raw = error.message.replace(/^\d+: /, "");
  try {
    return JSON.parse(raw).message || raw;
  } catch {
    return raw;
  }
}

// Print one element on its own page, styled with the page's CSS (the print dialog also offers "Save as PDF")
function printElement(node: HTMLElement, title: string) {
  const css = Array.from(document.styleSheets).map(sheet => {
    try {
      return Array.from(sheet.cssRules).map(rule => rule.cssText).join("\n");
    } catch {
      return "";
    }
  }).join("\n");
  // absolute image URLs so the logo loads in the print frame
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("img").forEach(img => img.setAttribute("src", img.src));
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><title>${title}</title><style>${css}</style>
    <style>@page { size: A4 landscape; margin: 12mm; } html, body { margin: 0; background: #fff; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
    </head><body>${clone.outerHTML}</body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 1000);
  }, 300);
}

const createTrainingFormSchema = insertTrainingSchema.pick({
  title: true,
  description: true,
  type: true,
  category: true,
  duration: true,
  passingScore: true,
  validityPeriod: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.string().default("training"),
  category: z.string().optional(),
  duration: z.number().nullable().optional(),
  passingScore: z.number().default(70),
  validityPeriod: z.number().nullable().optional(),
});

const assignTrainingFormSchema = z.object({
  employeeId: z.number().min(1, "Employee is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

const completeTrainingFormSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean().default(true),
  remarks: z.string().optional(),
});

type CreateTrainingForm = z.infer<typeof createTrainingFormSchema>;
type AssignTrainingForm = z.infer<typeof assignTrainingFormSchema>;
type CompleteTrainingForm = z.infer<typeof completeTrainingFormSchema>;

export default function Trainings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<TrainingAssignment | null>(null);
  const [viewedCompletion, setViewedCompletion] = useState<TrainingCompletion | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);
  const { data: currentUser } = useAuth();
  // Managers and HR create, assign and complete trainings; employees start their own
  const isTrainingManager = !!currentUser && (currentUser.role === "admin" || currentUser.role === "quality_manager" ||
    currentUser.email === "coo@sahihcertify.com" || currentUser.email === "hr@sahihcertify.com");

  const createForm = useForm<CreateTrainingForm>({
    resolver: zodResolver(createTrainingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "training",
      category: "",
      duration: null,
      passingScore: 70,
      validityPeriod: null,
    },
  });

  const assignForm = useForm<AssignTrainingForm>({
    resolver: zodResolver(assignTrainingFormSchema),
    defaultValues: {
      employeeId: undefined as unknown as number,
      dueDate: "",
      notes: "",
    },
  });

  const completeForm = useForm<CompleteTrainingForm>({
    resolver: zodResolver(completeTrainingFormSchema),
    defaultValues: {
      score: undefined,
      passed: true,
      remarks: "",
    },
  });

  const { data: trainings = [], isLoading: trainingsLoading } = useQuery<Training[]>({
    queryKey: ['/api/trainings'],
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<TrainingAssignment[]>({
    queryKey: ['/api/training-assignments'],
  });

  const { data: completions = [], isLoading: completionsLoading } = useQuery<TrainingCompletion[]>({
    queryKey: ['/api/training-completions'],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
  });

  const createTraining = useMutation({
    mutationFn: async (data: CreateTrainingForm) => {
      return apiRequest('POST', '/api/trainings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainings'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Training created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating training", description: apiErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteTraining = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/trainings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainings'] });
      toast({ title: "Training deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting training", description: apiErrorMessage(error), variant: "destructive" });
    },
  });

  const assignTraining = useMutation({
    mutationFn: async (data: AssignTrainingForm & { trainingId: number }) => {
      return apiRequest('POST', '/api/training-assignments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-assignments'] });
      setIsAssignDialogOpen(false);
      setSelectedTraining(null);
      assignForm.reset();
      toast({ title: "Training assigned successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error assigning training", description: apiErrorMessage(error), variant: "destructive" });
    },
  });

  const completeAssignment = useMutation({
    mutationFn: async (data: CompleteTrainingForm & { id: number }) => {
      const res = await apiRequest('POST', `/api/training-assignments/${data.id}/complete`, data);
      return res.json() as Promise<{ assignment: TrainingAssignment; completion: TrainingCompletion }>;
    },
    onSuccess: ({ completion }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-completions'] });
      setIsCompleteDialogOpen(false);
      setSelectedAssignment(null);
      completeForm.reset();
      if (completion.passed) {
        toast({ title: "Training completed", description: `Certificate ${completion.certificateNumber} has been issued` });
      } else {
        toast({ title: "Not passed", description: "The attempt was recorded; the training stays open for a retake", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error completing training", description: apiErrorMessage(error), variant: "destructive" });
    },
  });

  const startAssignment = useMutation({
    mutationFn: async (id: number) => apiRequest('PUT', `/api/training-assignments/${id}`, { status: 'in_progress' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-assignments'] });
      toast({ title: "Training started" });
    },
    onError: (error: Error) => {
      toast({ title: "Error starting training", description: apiErrorMessage(error), variant: "destructive" });
    },
  });

  // The assignment belongs to the signed-in user (employee linked by userId, or the same email)
  const isMyAssignment = (assignment: TrainingAssignment) => {
    const employee = employees.find(e => e.id === assignment.employeeId);
    return !!employee && !!currentUser && (employee.userId === currentUser.id || employee.email.toLowerCase() === currentUser.email.toLowerCase());
  };

  const handleCreateSubmit = (data: CreateTrainingForm) => {
    createTraining.mutate(data);
  };

  const handleAssignSubmit = (data: AssignTrainingForm) => {
    if (!selectedTraining) return;
    assignTraining.mutate({
      ...data,
      trainingId: selectedTraining.id,
    });
  };

  const handleCompleteSubmit = (data: CompleteTrainingForm) => {
    if (!selectedAssignment) return;
    completeAssignment.mutate({
      ...data,
      id: selectedAssignment.id,
    });
  };

  const openAssignDialog = (training: Training) => {
    setSelectedTraining(training);
    assignForm.reset({ employeeId: 0, dueDate: "", notes: "" });
    setIsAssignDialogOpen(true);
  };

  const openCompleteDialog = (assignment: TrainingAssignment) => {
    setSelectedAssignment(assignment);
    completeForm.reset({ score: undefined, passed: true, remarks: "" });
    setIsCompleteDialogOpen(true);
  };

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.name || `Employee #${employeeId}`;
  };

  const getTrainingTitle = (trainingId: number) => {
    const training = trainings.find(t => t.id === trainingId);
    return training?.title || `Training #${trainingId}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return <Badge variant="secondary" data-testid="badge-status-assigned"><Clock className="w-3 h-3 mr-1" />Assigned</Badge>;
      case 'in_progress':
        return <Badge variant="outline" data-testid="badge-status-progress"><BookOpen className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-600" data-testid="badge-status-completed"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-status-default">{status}</Badge>;
    }
  };

  const stats = {
    totalTrainings: trainings.length,
    activeAssignments: assignments.filter(a => a.status !== 'completed').length,
    completedTotal: completions.filter(c => c.passed).length,
    pendingCompletion: assignments.filter(a => a.status === 'assigned').length,
  };

  if (trainingsLoading || assignmentsLoading || completionsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="trainings-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <GraduationCap className="h-6 w-6" />
            Training & Assessment
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">Manage employee training programs and track completions</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-training" className={isTrainingManager ? undefined : "hidden"}>
              <Plus className="w-4 h-4 mr-2" />
              New Training
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="dialog-create-training">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">Create New Training</DialogTitle>
              <DialogDescription data-testid="text-dialog-description">Add a new training program or assessment</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 py-4">
                <FormField
                  control={createForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-training-title" placeholder="Enter training title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-training-description" placeholder="Enter training description" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-training-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="training" data-testid="select-item-training">Training</SelectItem>
                            <SelectItem value="assessment" data-testid="select-item-assessment">Assessment</SelectItem>
                            <SelectItem value="induction" data-testid="select-item-induction">Induction</SelectItem>
                            <SelectItem value="certification" data-testid="select-item-certification">Certification</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-training-category" placeholder="e.g., ISO, Safety" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={createForm.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (hours)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-training-duration"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="passingScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pass Score (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-training-passing-score"
                            placeholder="70"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 70)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="validityPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validity (months)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-training-validity"
                            placeholder="12"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">Cancel</Button>
                  <Button
                    type="submit"
                    data-testid="button-submit-training"
                    disabled={createTraining.isPending}
                  >
                    {createTraining.isPending ? "Creating..." : "Create Training"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-trainings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Trainings</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-trainings">{stats.totalTrainings}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-active-assignments">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-assignments">{stats.activeAssignments}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-trainings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed-trainings">{stats.completedTotal}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-trainings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-trainings">{stats.pendingCompletion}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trainings" data-testid="tabs-container">
        <TabsList>
          <TabsTrigger value="trainings" data-testid="tab-trainings">Trainings</TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          <TabsTrigger value="certificates" data-testid="tab-certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="trainings" className="mt-4" data-testid="tab-content-trainings">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-trainings-title">Training Programs</CardTitle>
              <CardDescription data-testid="text-trainings-description">All available training programs and assessments</CardDescription>
            </CardHeader>
            <CardContent>
              {trainings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-trainings">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trainings created yet</p>
                  <p className="text-sm">Click "New Training" to create your first training program</p>
                </div>
              ) : (
                <Table data-testid="table-trainings">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainings.map((training) => (
                      <TableRow key={training.id} data-testid={`row-training-${training.id}`}>
                        <TableCell className="font-medium" data-testid={`text-training-title-${training.id}`}>{training.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize" data-testid={`badge-training-type-${training.id}`}>{training.type}</Badge>
                        </TableCell>
                        <TableCell data-testid={`text-training-category-${training.id}`}>{training.category || "-"}</TableCell>
                        <TableCell data-testid={`text-training-duration-${training.id}`}>{training.duration ? `${training.duration}h` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={training.status === 'active' ? 'default' : 'secondary'} className="capitalize" data-testid={`badge-training-status-${training.id}`}>
                            {training.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {isTrainingManager && (<>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignDialog(training)}
                            data-testid={`button-assign-training-${training.id}`}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteTraining.mutate(training.id)}
                            data-testid={`button-delete-training-${training.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          </>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4" data-testid="tab-content-assignments">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-assignments-title">Training Assignments</CardTitle>
              <CardDescription data-testid="text-assignments-description">Track employee training progress</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-assignments">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No assignments yet</p>
                  <p className="text-sm">Assign trainings to employees to track their progress</p>
                </div>
              ) : (
                <Table data-testid="table-assignments">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                        <TableCell className="font-medium" data-testid={`text-assignment-employee-${assignment.id}`}>{getEmployeeName(assignment.employeeId)}</TableCell>
                        <TableCell data-testid={`text-assignment-training-${assignment.id}`}>{getTrainingTitle(assignment.trainingId)}</TableCell>
                        <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                        <TableCell data-testid={`text-assignment-duedate-${assignment.id}`}>
                          {assignment.dueDate ? format(new Date(assignment.dueDate), 'MMM d, yyyy') : "-"}
                        </TableCell>
                        <TableCell data-testid={`text-assignment-score-${assignment.id}`}>{assignment.score !== null ? `${assignment.score}%` : "-"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {(assignment.status === 'assigned' || assignment.status === 'overdue') && isMyAssignment(assignment) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startAssignment.mutate(assignment.id)}
                              disabled={startAssignment.isPending}
                              data-testid={`button-start-assignment-${assignment.id}`}
                            >
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          )}
                          {assignment.status !== 'completed' && assignment.status !== 'cancelled' && isTrainingManager && (
                            <Button
                              size="sm"
                              onClick={() => openCompleteDialog(assignment)}
                              data-testid={`button-complete-assignment-${assignment.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificates" className="mt-4" data-testid="tab-content-certificates">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-certificates-title">Completion Certificates</CardTitle>
              <CardDescription data-testid="text-certificates-description">Training completion records and certificates</CardDescription>
            </CardHeader>
            <CardContent>
              {completions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-certificates">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No certificates issued yet</p>
                  <p className="text-sm">Certificates are generated when trainings are completed</p>
                </div>
              ) : (
                <Table data-testid="table-certificates">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate #</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Certificate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completions.map((completion) => (
                      <TableRow key={completion.id} data-testid={`row-completion-${completion.id}`}>
                        <TableCell className="font-mono text-sm" data-testid={`text-cert-number-${completion.id}`}>{completion.certificateNumber}</TableCell>
                        <TableCell data-testid={`text-cert-employee-${completion.id}`}>{getEmployeeName(completion.employeeId)}</TableCell>
                        <TableCell data-testid={`text-cert-training-${completion.id}`}>{getTrainingTitle(completion.trainingId)}</TableCell>
                        <TableCell data-testid={`text-cert-score-${completion.id}`}>{completion.score !== null ? `${completion.score}%` : "-"}</TableCell>
                        <TableCell>
                          {completion.passed ? (
                            <Badge className="bg-green-600" data-testid={`badge-cert-passed-${completion.id}`}>Passed</Badge>
                          ) : (
                            <Badge variant="destructive" data-testid={`badge-cert-failed-${completion.id}`}>Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-cert-date-${completion.id}`}>{format(new Date(completion.completionDate), 'MMM d, yyyy')}</TableCell>
                        <TableCell data-testid={`text-cert-expiry-${completion.id}`}>
                          {completion.expiryDate ? format(new Date(completion.expiryDate), 'MMM d, yyyy') : "No expiry"}
                        </TableCell>
                        <TableCell className="text-right">
                          {completion.passed && completion.certificateNumber ? (
                            <Button size="sm" variant="outline" onClick={() => setViewedCompletion(completion)} data-testid={`button-view-cert-${completion.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewedCompletion} onOpenChange={(open) => !open && setViewedCompletion(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto" data-testid="dialog-training-certificate">
          <DialogHeader>
            <DialogTitle>Training Certificate</DialogTitle>
            <DialogDescription>{viewedCompletion?.certificateNumber}</DialogDescription>
          </DialogHeader>
          {viewedCompletion && (
            <div className="overflow-x-auto">
              <div
                ref={certificateRef}
                className="mx-auto bg-white text-gray-800 border-[6px] border-double border-cyan-700 p-10 text-center space-y-5"
                style={{ width: "100%", maxWidth: "1000px", minHeight: "620px" }}
                data-testid="training-certificate"
              >
                <img src={sahihLogo} alt="Sahih Certifications" className="h-16 mx-auto" />
                <div>
                  <h2 className="text-3xl font-bold tracking-wide text-cyan-700">Certificate of Completion</h2>
                  <div className="w-32 h-1 bg-cyan-600 mx-auto mt-3" />
                </div>
                <p className="text-gray-600">This is to certify that</p>
                <p className="text-3xl font-semibold" data-testid="text-cert-view-employee">{getEmployeeName(viewedCompletion.employeeId)}</p>
                <p className="text-gray-600">has successfully completed</p>
                <p className="text-2xl font-semibold text-cyan-800" data-testid="text-cert-view-training">{getTrainingTitle(viewedCompletion.trainingId)}</p>
                {viewedCompletion.score !== null && (
                  <p className="text-gray-700" data-testid="text-cert-view-score">with a score of <span className="font-semibold">{viewedCompletion.score}%</span></p>
                )}
                <div className="grid grid-cols-3 gap-4 pt-6 text-sm">
                  <div className="border rounded p-3">
                    <div className="text-gray-500">Certificate No.</div>
                    <div className="font-mono font-semibold" data-testid="text-cert-view-number">{viewedCompletion.certificateNumber}</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-gray-500">Issue Date</div>
                    <div className="font-semibold">{format(new Date(viewedCompletion.completionDate), 'dd MMM yyyy')}</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-gray-500">Valid Until</div>
                    <div className="font-semibold">{viewedCompletion.expiryDate ? format(new Date(viewedCompletion.expiryDate), 'dd MMM yyyy') : "No expiry"}</div>
                  </div>
                </div>
                <div className="flex justify-between items-end pt-10 px-8 text-sm">
                  <div className="text-center">
                    <div className="w-48 border-b-2 border-gray-300 mb-1 h-10" />
                    <div className="font-semibold">Human Resources</div>
                  </div>
                  <div className="text-center">
                    <div className="w-48 border-b-2 border-gray-300 mb-1 h-10" />
                    <div className="font-semibold">Chief Operating Officer</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 pt-4">Sahih Certifications | Doha, State of Qatar | www.sahihcertify.com</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewedCompletion(null)}>Close</Button>
            <Button
              onClick={() => certificateRef.current && printElement(certificateRef.current, `Certificate ${viewedCompletion?.certificateNumber}`)}
              data-testid="button-print-training-certificate"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent data-testid="dialog-assign-training">
          <DialogHeader>
            <DialogTitle data-testid="text-assign-dialog-title">Assign Training</DialogTitle>
            <DialogDescription data-testid="text-assign-dialog-description">
              Assign "{selectedTraining?.title}" to an employee
            </DialogDescription>
          </DialogHeader>
          <Form {...assignForm}>
            <form onSubmit={assignForm.handleSubmit(handleAssignSubmit)} className="space-y-4 py-4">
              <FormField
                control={assignForm.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee *</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-assign-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={String(emp.id)} data-testid={`select-item-employee-${emp.id}`}>
                            {emp.name} - {emp.jobTitle || emp.department || 'Staff'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={assignForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-assign-due-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={assignForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-assign-notes" placeholder="Optional notes for the employee" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)} data-testid="button-cancel-assign">Cancel</Button>
                <Button
                  type="submit"
                  data-testid="button-submit-assignment"
                  disabled={assignTraining.isPending}
                >
                  {assignTraining.isPending ? "Assigning..." : "Assign Training"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent data-testid="dialog-complete-training">
          <DialogHeader>
            <DialogTitle data-testid="text-complete-dialog-title">Complete Training</DialogTitle>
            <DialogDescription data-testid="text-complete-dialog-description">
              Mark training as completed and issue certificate
            </DialogDescription>
          </DialogHeader>
          <Form {...completeForm}>
            <form onSubmit={completeForm.handleSubmit(handleCompleteSubmit)} className="space-y-4 py-4">
              <FormField
                control={completeForm.control}
                name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Score (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        data-testid="input-complete-score"
                        placeholder="Enter score (0-100)"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={completeForm.control}
                name="passed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Result (used when no score is entered; a score is checked against the pass score)</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "passed")}
                      value={field.value ? "passed" : "failed"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-complete-result">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="passed" data-testid="select-item-passed">Passed</SelectItem>
                        <SelectItem value="failed" data-testid="select-item-failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={completeForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-complete-remarks" placeholder="Optional remarks or feedback" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCompleteDialogOpen(false)} data-testid="button-cancel-complete">Cancel</Button>
                <Button
                  type="submit"
                  data-testid="button-submit-completion"
                  disabled={completeAssignment.isPending}
                >
                  {completeAssignment.isPending ? "Completing..." : "Complete & Issue Certificate"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
