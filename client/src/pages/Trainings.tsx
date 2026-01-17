import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserPlus, Award, CheckCircle2, Clock, BookOpen, Users, GraduationCap } from "lucide-react";
import { format } from "date-fns";

interface Training {
  id: number;
  title: string;
  description: string | null;
  type: string;
  category: string | null;
  duration: number | null;
  passingScore: number | null;
  content: string | null;
  documentId: number | null;
  createdById: number;
  status: string;
  validityPeriod: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TrainingAssignment {
  id: number;
  trainingId: number;
  employeeId: number;
  assignedById: number;
  status: string;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  score: number | null;
  attempts: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TrainingCompletion {
  id: number;
  assignmentId: number;
  trainingId: number;
  employeeId: number;
  completionDate: string;
  score: number | null;
  passed: boolean;
  certificateNumber: string | null;
  expiryDate: string | null;
  issuedById: number | null;
  remarks: string | null;
  createdAt: string;
}

interface Employee {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  position: string | null;
}

export default function Trainings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<TrainingAssignment | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "training",
    category: "",
    duration: "",
    passingScore: "70",
    validityPeriod: "",
  });

  const [assignData, setAssignData] = useState({
    employeeId: "",
    dueDate: "",
    notes: "",
  });

  const [completeData, setCompleteData] = useState({
    score: "",
    passed: true,
    remarks: "",
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
    mutationFn: async (data: Partial<Training>) => {
      return apiRequest('POST', '/api/trainings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainings'] });
      setIsCreateDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        type: "training",
        category: "",
        duration: "",
        passingScore: "70",
        validityPeriod: "",
      });
      toast({ title: "Training created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating training", description: error.message, variant: "destructive" });
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
      toast({ title: "Error deleting training", description: error.message, variant: "destructive" });
    },
  });

  const assignTraining = useMutation({
    mutationFn: async (data: { trainingId: number; employeeId: number; dueDate?: string; notes?: string }) => {
      return apiRequest('POST', '/api/training-assignments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-assignments'] });
      setIsAssignDialogOpen(false);
      setSelectedTraining(null);
      setAssignData({ employeeId: "", dueDate: "", notes: "" });
      toast({ title: "Training assigned successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error assigning training", description: error.message, variant: "destructive" });
    },
  });

  const completeAssignment = useMutation({
    mutationFn: async (data: { id: number; score?: number; passed?: boolean; remarks?: string }) => {
      return apiRequest('POST', `/api/training-assignments/${data.id}/complete`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-completions'] });
      setIsCompleteDialogOpen(false);
      setSelectedAssignment(null);
      setCompleteData({ score: "", passed: true, remarks: "" });
      toast({ title: "Training marked as completed", description: "Certificate has been generated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error completing training", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = () => {
    createTraining.mutate({
      title: formData.title,
      description: formData.description || null,
      type: formData.type,
      category: formData.category || null,
      duration: formData.duration ? parseInt(formData.duration) : null,
      passingScore: formData.passingScore ? parseInt(formData.passingScore) : 70,
      validityPeriod: formData.validityPeriod ? parseInt(formData.validityPeriod) : null,
    });
  };

  const handleAssignSubmit = () => {
    if (!selectedTraining || !assignData.employeeId) return;
    assignTraining.mutate({
      trainingId: selectedTraining.id,
      employeeId: parseInt(assignData.employeeId),
      dueDate: assignData.dueDate || undefined,
      notes: assignData.notes || undefined,
    });
  };

  const handleCompleteSubmit = () => {
    if (!selectedAssignment) return;
    completeAssignment.mutate({
      id: selectedAssignment.id,
      score: completeData.score ? parseInt(completeData.score) : undefined,
      passed: completeData.passed,
      remarks: completeData.remarks || undefined,
    });
  };

  const openAssignDialog = (training: Training) => {
    setSelectedTraining(training);
    setIsAssignDialogOpen(true);
  };

  const openCompleteDialog = (assignment: TrainingAssignment) => {
    setSelectedAssignment(assignment);
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
    completedTotal: completions.length,
    pendingCompletion: assignments.filter(a => a.status === 'assigned').length,
  };

  if (trainingsLoading || assignmentsLoading || completionsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Training & Assessment
          </h1>
          <p className="text-muted-foreground">Manage employee training programs and track completions</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-training">
              <Plus className="w-4 h-4 mr-2" />
              New Training
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Training</DialogTitle>
              <DialogDescription>Add a new training program or assessment</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  data-testid="input-training-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter training title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-training-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter training description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger data-testid="select-training-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="assessment">Assessment</SelectItem>
                      <SelectItem value="induction">Induction</SelectItem>
                      <SelectItem value="certification">Certification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    data-testid="input-training-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., ISO, Safety"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    data-testid="input-training-duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passingScore">Pass Score (%)</Label>
                  <Input
                    id="passingScore"
                    data-testid="input-training-passing-score"
                    type="number"
                    value={formData.passingScore}
                    onChange={(e) => setFormData({ ...formData, passingScore: e.target.value })}
                    placeholder="70"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validity">Validity (months)</Label>
                  <Input
                    id="validity"
                    data-testid="input-training-validity"
                    type="number"
                    value={formData.validityPeriod}
                    onChange={(e) => setFormData({ ...formData, validityPeriod: e.target.value })}
                    placeholder="12"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-submit-training"
                onClick={handleCreateSubmit}
                disabled={!formData.title || createTraining.isPending}
              >
                {createTraining.isPending ? "Creating..." : "Create Training"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Trainings</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-trainings">{stats.totalTrainings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-assignments">{stats.activeAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed-trainings">{stats.completedTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-trainings">{stats.pendingCompletion}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trainings">
        <TabsList>
          <TabsTrigger value="trainings" data-testid="tab-trainings">Trainings</TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          <TabsTrigger value="certificates" data-testid="tab-certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="trainings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Programs</CardTitle>
              <CardDescription>All available training programs and assessments</CardDescription>
            </CardHeader>
            <CardContent>
              {trainings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trainings created yet</p>
                  <p className="text-sm">Click "New Training" to create your first training program</p>
                </div>
              ) : (
                <Table>
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
                        <TableCell className="font-medium">{training.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{training.type}</Badge>
                        </TableCell>
                        <TableCell>{training.category || "-"}</TableCell>
                        <TableCell>{training.duration ? `${training.duration}h` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={training.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                            {training.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Assignments</CardTitle>
              <CardDescription>Track employee training progress</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No assignments yet</p>
                  <p className="text-sm">Assign trainings to employees to track their progress</p>
                </div>
              ) : (
                <Table>
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
                        <TableCell className="font-medium">{getEmployeeName(assignment.employeeId)}</TableCell>
                        <TableCell>{getTrainingTitle(assignment.trainingId)}</TableCell>
                        <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                        <TableCell>
                          {assignment.dueDate ? format(new Date(assignment.dueDate), 'MMM d, yyyy') : "-"}
                        </TableCell>
                        <TableCell>{assignment.score !== null ? `${assignment.score}%` : "-"}</TableCell>
                        <TableCell className="text-right">
                          {assignment.status !== 'completed' && (
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

        <TabsContent value="certificates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Completion Certificates</CardTitle>
              <CardDescription>Training completion records and certificates</CardDescription>
            </CardHeader>
            <CardContent>
              {completions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No certificates issued yet</p>
                  <p className="text-sm">Certificates are generated when trainings are completed</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate #</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completions.map((completion) => (
                      <TableRow key={completion.id} data-testid={`row-completion-${completion.id}`}>
                        <TableCell className="font-mono text-sm">{completion.certificateNumber}</TableCell>
                        <TableCell>{getEmployeeName(completion.employeeId)}</TableCell>
                        <TableCell>{getTrainingTitle(completion.trainingId)}</TableCell>
                        <TableCell>{completion.score !== null ? `${completion.score}%` : "-"}</TableCell>
                        <TableCell>
                          {completion.passed ? (
                            <Badge className="bg-green-600">Passed</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(completion.completionDate), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          {completion.expiryDate ? format(new Date(completion.expiryDate), 'MMM d, yyyy') : "No expiry"}
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

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Training</DialogTitle>
            <DialogDescription>
              Assign "{selectedTraining?.title}" to an employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select value={assignData.employeeId} onValueChange={(v) => setAssignData({ ...assignData, employeeId: v })}>
                <SelectTrigger data-testid="select-assign-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name} - {emp.position || emp.department || 'Staff'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                data-testid="input-assign-due-date"
                type="date"
                value={assignData.dueDate}
                onChange={(e) => setAssignData({ ...assignData, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                data-testid="input-assign-notes"
                value={assignData.notes}
                onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })}
                placeholder="Optional notes for the employee"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-submit-assignment"
              onClick={handleAssignSubmit}
              disabled={!assignData.employeeId || assignTraining.isPending}
            >
              {assignTraining.isPending ? "Assigning..." : "Assign Training"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Training</DialogTitle>
            <DialogDescription>
              Mark training as completed and issue certificate
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="score">Score (%)</Label>
              <Input
                id="score"
                data-testid="input-complete-score"
                type="number"
                min="0"
                max="100"
                value={completeData.score}
                onChange={(e) => setCompleteData({ ...completeData, score: e.target.value })}
                placeholder="Enter score (0-100)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passed">Result</Label>
              <Select
                value={completeData.passed ? "passed" : "failed"}
                onValueChange={(v) => setCompleteData({ ...completeData, passed: v === "passed" })}
              >
                <SelectTrigger data-testid="select-complete-result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                data-testid="input-complete-remarks"
                value={completeData.remarks}
                onChange={(e) => setCompleteData({ ...completeData, remarks: e.target.value })}
                placeholder="Optional remarks or feedback"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteDialogOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-submit-completion"
              onClick={handleCompleteSubmit}
              disabled={completeAssignment.isPending}
            >
              {completeAssignment.isPending ? "Completing..." : "Complete & Issue Certificate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
