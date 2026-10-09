import { useState, useMemo } from "react";
import { TargetDateField, TARGET_DAYS, defaultTargetInput, targetToIso } from "@/components/TargetDateField";
import { Link } from "wouter";
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useEmployeeTasks, useCreateEmployeeTask, useCompleteEmployeeTask, useDeleteEmployeeTask, useSubmitEmployeeForReview, useSubmitEmployeeForApproval, useApproveEmployee, useRejectEmployee } from "@/hooks/use-employees";
import { useDocuments } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, MoreHorizontal, Pencil, Trash2, UserPlus, FileText, CheckCircle, Clock, AlertCircle, Users, ClipboardList, Network, Send, ThumbsUp, ThumbsDown, Eye } from "lucide-react";
import { format } from "date-fns";
import type { Employee, EmployeeTask } from "@shared/schema";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  on_leave: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  terminated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const employmentTypeLabels: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  probation: "Probation",
};

const taskStatusColors: Record<string, string> = {
  pending: "bg-muted text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const workflowStatusColors: Record<string, string> = {
  draft: "bg-muted text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  in_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pending_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const workflowStatusLabels: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground dark:bg-slate-700 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  critical: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function Employees() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<'submit_review' | 'submit_approval' | 'approve' | 'reject' | null>(null);
  const [workflowTarget, setWorkflowTarget] = useState(defaultTargetInput(TARGET_DAYS.employee_review));
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const filters = {
    status: statusFilter !== "all" ? statusFilter : undefined,
    department: departmentFilter !== "all" ? departmentFilter : undefined,
  };

  const { data: employees, isLoading, isError } = useEmployees(filters);
  const { data: tasks } = useEmployeeTasks();
  const { data: documents } = useDocuments();
  const { data: users } = useUsers();
  const { data: currentUser } = useAuth();
  const { toast } = useToast();

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const createTaskMutation = useCreateEmployeeTask();
  const completeTaskMutation = useCompleteEmployeeTask();
  const deleteTaskMutation = useDeleteEmployeeTask();
  const submitForReviewMutation = useSubmitEmployeeForReview();
  const submitForApprovalMutation = useSubmitEmployeeForApproval();
  const approveMutation = useApproveEmployee();
  const rejectMutation = useRejectEmployee();

  const nextEmployeeNumber = useMemo(() => {
    if (!employees || employees.length === 0) return "EMP-001";
    const numbers = employees
      .map(e => {
        const match = e.employeeNumber.match(/EMP-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `EMP-${String(maxNum + 1).padStart(3, '0')}`;
  }, [employees]);

  const [formData, setFormData] = useState({
    employeeNumber: "",
    name: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    employmentType: "full_time" as string,
    supervisorId: "" as string,
    hireDate: "",
    status: "active" as string,
  });

  const [taskFormData, setTaskFormData] = useState({
    employeeId: 0,
    documentId: "" as string,
    title: "",
    description: "",
    dueDate: "",
    priority: "medium" as string,
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      employeeNumber: "",
      name: "",
      email: "",
      phone: "",
      jobTitle: "",
      department: "",
      employmentType: "full_time",
      supervisorId: "",
      hireDate: "",
      status: "active",
    });
  };

  const resetTaskForm = () => {
    setTaskFormData({
      employeeId: 0,
      documentId: "",
      title: "",
      description: "",
      dueDate: "",
      priority: "medium",
      notes: "",
    });
  };

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        employeeNumber: formData.employeeNumber,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        jobTitle: formData.jobTitle,
        department: formData.department,
        employmentType: formData.employmentType as any,
        supervisorId: formData.supervisorId ? Number(formData.supervisorId) : undefined,
        hireDate: formData.hireDate,
        status: formData.status as any,
      });
      toast({ title: "Employee created successfully" });
      setShowCreateDialog(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error creating employee", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = async () => {
    if (!selectedEmployee) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedEmployee.id,
        data: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          jobTitle: formData.jobTitle,
          department: formData.department,
          employmentType: formData.employmentType as any,
          supervisorId: formData.supervisorId ? Number(formData.supervisorId) : undefined,
          status: formData.status as any,
        },
      });
      toast({ title: "Employee updated successfully" });
      setShowEditDialog(false);
      setSelectedEmployee(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error updating employee", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    try {
      await deleteMutation.mutateAsync(selectedEmployee.id);
      toast({ title: "Employee deleted successfully" });
      setShowDeleteDialog(false);
      setSelectedEmployee(null);
    } catch (error: any) {
      toast({ title: "Error deleting employee", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateTask = async () => {
    try {
      await createTaskMutation.mutateAsync({
        employeeId: taskFormData.employeeId,
        documentId: taskFormData.documentId ? Number(taskFormData.documentId) : undefined,
        title: taskFormData.title,
        description: taskFormData.description || undefined,
        dueDate: taskFormData.dueDate || undefined,
        priority: taskFormData.priority as any,
        notes: taskFormData.notes || undefined,
      });
      toast({ title: "Task assigned successfully" });
      setShowTaskDialog(false);
      resetTaskForm();
    } catch (error: any) {
      toast({ title: "Error assigning task", description: error.message, variant: "destructive" });
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeTaskMutation.mutateAsync(taskId);
      toast({ title: "Task completed" });
    } catch (error: any) {
      toast({ title: "Error completing task", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await deleteTaskMutation.mutateAsync(taskId);
      toast({ title: "Task deleted" });
    } catch (error: any) {
      toast({ title: "Error deleting task", description: error.message, variant: "destructive" });
    }
  };

  const openWorkflowDialog = (employee: Employee, action: 'submit_review' | 'submit_approval' | 'approve' | 'reject') => {
    setSelectedEmployee(employee);
    setWorkflowAction(action);
    setWorkflowTarget(defaultTargetInput(action === 'submit_approval' ? TARGET_DAYS.employee_approve : TARGET_DAYS.employee_review));
    
    // Auto-select COO for review and CEO for approval
    if (action === 'submit_review') {
      const cooUser = users?.find(u => u.email === 'coo@sahihcertify.com');
      setSelectedUserId(cooUser ? String(cooUser.id) : "");
    } else if (action === 'submit_approval') {
      const ceoUser = users?.find(u => u.email === 'ceo@sahihcertify.com');
      setSelectedUserId(ceoUser ? String(ceoUser.id) : "");
    } else {
      setSelectedUserId("");
    }
    
    setWorkflowNotes("");
    setShowWorkflowDialog(true);
  };

  const handleWorkflowAction = async () => {
    if (!selectedEmployee || !workflowAction) return;
    
    try {
      switch (workflowAction) {
        case 'submit_review':
          if (!selectedUserId) {
            toast({ title: "Please select a reviewer", variant: "destructive" });
            return;
          }
          await submitForReviewMutation.mutateAsync({
            id: selectedEmployee.id,
            reviewerId: Number(selectedUserId),
            notes: workflowNotes || undefined,
            targetDate: targetToIso(workflowTarget),
          });
          toast({ title: "Employee submitted for review" });
          break;
        case 'submit_approval':
          if (!selectedUserId) {
            toast({ title: "Please select an approver", variant: "destructive" });
            return;
          }
          await submitForApprovalMutation.mutateAsync({
            id: selectedEmployee.id,
            approverId: Number(selectedUserId),
            notes: workflowNotes || undefined,
            targetDate: targetToIso(workflowTarget),
          });
          toast({ title: "Employee submitted for approval" });
          break;
        case 'approve':
          await approveMutation.mutateAsync({
            id: selectedEmployee.id,
            notes: workflowNotes || undefined,
          });
          toast({ title: "Employee approved" });
          break;
        case 'reject':
          await rejectMutation.mutateAsync({
            id: selectedEmployee.id,
            notes: workflowNotes || undefined,
          });
          toast({ title: "Employee rejected" });
          break;
      }
      setShowWorkflowDialog(false);
      setSelectedEmployee(null);
      setWorkflowAction(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getWorkflowDialogTitle = () => {
    switch (workflowAction) {
      case 'submit_review': return 'Submit for Review';
      case 'submit_approval': return 'Submit for Approval';
      case 'approve': return 'Approve Employee Record';
      case 'reject': return 'Reject Employee Record';
      default: return '';
    }
  };

  const canPerformWorkflowAction = (employee: Employee, action: 'submit_review' | 'submit_approval' | 'approve' | 'reject'): boolean => {
    if (!currentUser) return false;
    const emp = employee as any;
    const isAdmin = currentUser.role === 'admin';
    const isQualityManager = currentUser.role === 'quality_manager';
    const isCreator = emp.createdByUserId === currentUser.id;
    const isAssignedReviewer = emp.reviewerId === currentUser.id;
    const isAssignedApprover = emp.approverId === currentUser.id;

    switch (action) {
      case 'submit_review':
        return (emp.workflowStatus === 'draft' || emp.workflowStatus === 'rejected') && (isCreator || isAdmin || isQualityManager);
      case 'submit_approval':
        return emp.workflowStatus === 'in_review' && (isAssignedReviewer || isAdmin || isQualityManager);
      case 'approve':
        return emp.workflowStatus === 'pending_approval' && (isAssignedApprover || isAdmin || isQualityManager);
      case 'reject':
        return (emp.workflowStatus === 'in_review' && (isAssignedReviewer || isAdmin || isQualityManager)) ||
               (emp.workflowStatus === 'pending_approval' && (isAssignedApprover || isAdmin || isQualityManager));
      default:
        return false;
    }
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      email: employee.email,
      phone: employee.phone || "",
      jobTitle: employee.jobTitle,
      department: employee.department,
      employmentType: employee.employmentType,
      supervisorId: employee.supervisorId ? String(employee.supervisorId) : "",
      hireDate: employee.hireDate ? format(new Date(employee.hireDate), "yyyy-MM-dd") : "",
      status: employee.status,
    });
    setShowEditDialog(true);
  };

  const openTaskDialog = (employee: Employee) => {
    setTaskFormData({
      ...taskFormData,
      employeeId: employee.id,
    });
    setShowTaskDialog(true);
  };

  const departments = Array.from(new Set((employees || []).map(e => e.department).filter(Boolean)));
  const approvedDocs = (documents || []).filter(d => d.status === 'approved');

  const getEmployeeTasks = (employeeId: number) => {
    return (tasks || []).filter(t => t.employeeId === employeeId);
  };

  if (isError) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load employees. Please try again later.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">HR - Employees</h1>
          <p className="text-muted-foreground">Manage employees and assign training/compliance tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hr">
            <Button variant="outline" data-testid="button-view-organogram">
              <Network className="h-4 w-4 mr-2" />
              Org Chart
            </Button>
          </Link>
          <Button onClick={() => { setFormData(prev => ({ ...prev, employeeNumber: nextEmployeeNumber })); setShowCreateDialog(true); }} data-testid="button-add-employee">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList>
          <TabsTrigger value="employees" data-testid="tab-employees">
            <Users className="h-4 w-4 mr-2" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <ClipboardList className="h-4 w-4 mr-2" />
            All Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="status-filter" className="text-sm text-muted-foreground whitespace-nowrap">Status:</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]" id="status-filter" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="dept-filter" className="text-sm text-muted-foreground whitespace-nowrap">Department:</Label>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[160px]" id="dept-filter" data-testid="select-department-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : employees && employees.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map(employee => {
                      const empTasks = getEmployeeTasks(employee.id);
                      const pendingTasks = empTasks.filter(t => t.status !== 'completed').length;
                      return (
                        <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{employee.name}</div>
                              <div className="text-sm text-muted-foreground">{employee.employeeNumber}</div>
                              <div className="text-xs text-muted-foreground">{employee.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{employee.jobTitle}</TableCell>
                          <TableCell>{employee.department}</TableCell>
                          <TableCell>
                            <span className="text-sm">{employmentTypeLabels[employee.employmentType] || employee.employmentType}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusColors[employee.status]}>
                              {employee.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={workflowStatusColors[(employee as any).workflowStatus || 'draft']}>
                              {workflowStatusLabels[(employee as any).workflowStatus || 'draft']}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pendingTasks > 0 ? (
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {pendingTasks} pending
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">No tasks</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-menu-employee-${employee.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canPerformWorkflowAction(employee, 'submit_review') && (
                                  <DropdownMenuItem onClick={() => openWorkflowDialog(employee, 'submit_review')} data-testid={`button-submit-review-${employee.id}`}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Submit for Review
                                  </DropdownMenuItem>
                                )}
                                {canPerformWorkflowAction(employee, 'submit_approval') && (
                                  <DropdownMenuItem onClick={() => openWorkflowDialog(employee, 'submit_approval')} data-testid={`button-submit-approval-${employee.id}`}>
                                    <ThumbsUp className="h-4 w-4 mr-2" />
                                    Send to Approver
                                  </DropdownMenuItem>
                                )}
                                {canPerformWorkflowAction(employee, 'approve') && (
                                  <DropdownMenuItem onClick={() => openWorkflowDialog(employee, 'approve')} data-testid={`button-approve-${employee.id}`}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve
                                  </DropdownMenuItem>
                                )}
                                {canPerformWorkflowAction(employee, 'reject') && (
                                  <DropdownMenuItem onClick={() => openWorkflowDialog(employee, 'reject')} className="text-destructive" data-testid={`button-reject-${employee.id}`}>
                                    <ThumbsDown className="h-4 w-4 mr-2" />
                                    Reject
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openTaskDialog(employee)} data-testid={`button-assign-task-${employee.id}`}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Assign Task
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(employee)} data-testid={`button-edit-employee-${employee.id}`}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedEmployee(employee);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="text-destructive"
                                  data-testid={`button-delete-employee-${employee.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No employees found</p>
                  <Button variant="outline" className="mt-4" onClick={() => { setFormData(prev => ({ ...prev, employeeNumber: nextEmployeeNumber })); setShowCreateDialog(true); }}>
                    Add your first employee
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Employee Tasks</CardTitle>
              <CardDescription>Track training, compliance and document acknowledgment tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks && tasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map(task => {
                      const employee = employees?.find(e => e.id === task.employeeId);
                      const doc = documents?.find(d => d.id === task.documentId);
                      return (
                        <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                          <TableCell>
                            <div className="font-medium">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">{task.description}</div>
                            )}
                          </TableCell>
                          <TableCell>{employee?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            {doc ? (
                              <Badge variant="outline" className="gap-1">
                                <FileText className="h-3 w-3" />
                                {doc.documentCode}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={priorityColors[task.priority]}>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={taskStatusColors[task.status]}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {task.status !== 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCompleteTask(task.id)}
                                  data-testid={`button-complete-task-${task.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTask(task.id)}
                                data-testid={`button-delete-task-${task.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No tasks assigned yet</p>
                  <p className="text-sm mt-1">Assign tasks to employees from the Employees tab</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>Create a new employee record in the HR system</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeNumber">Employee Number *</Label>
              <Input
                id="employeeNumber"
                value={formData.employeeNumber}
                onChange={e => setFormData({ ...formData, employeeNumber: e.target.value })}
                placeholder="EMP-001"
                data-testid="input-employee-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                data-testid="input-employee-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@company.com"
                data-testid="input-employee-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+974 xxxx xxxx"
                data-testid="input-employee-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title *</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={e => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Quality Auditor"
                data-testid="input-job-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={formData.department} onValueChange={v => setFormData({ ...formData, department: v })}>
                <SelectTrigger id="department" data-testid="select-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Board of directors">Board of directors</SelectItem>
                  <SelectItem value="HR and Admin">HR and Admin</SelectItem>
                  <SelectItem value="Sales and marketing">Sales and marketing</SelectItem>
                  <SelectItem value="Quality assurance & Compliance">Quality assurance & Compliance</SelectItem>
                  <SelectItem value="IT and Systems">IT and Systems</SelectItem>
                  <SelectItem value="Audit and certifications">Audit and certifications</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employmentType">Employment Type</Label>
              <Select value={formData.employmentType} onValueChange={v => setFormData({ ...formData, employmentType: v })}>
                <SelectTrigger id="employmentType" data-testid="select-employment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire Date *</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={e => setFormData({ ...formData, hireDate: e.target.value })}
                data-testid="input-hire-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Select value={formData.supervisorId} onValueChange={v => setFormData({ ...formData, supervisorId: v })}>
                <SelectTrigger id="supervisor" data-testid="select-supervisor">
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(employees || []).map(emp => (
                    <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger id="status" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.employeeNumber || !formData.name || !formData.email || !formData.jobTitle || !formData.department || !formData.hireDate || createMutation.isPending}
              data-testid="button-create-employee"
            >
              {createMutation.isPending ? "Creating..." : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee information</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-employeeNumber">Employee Number</Label>
              <Input
                id="edit-employeeNumber"
                value={formData.employeeNumber}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-jobTitle">Job Title *</Label>
              <Input
                id="edit-jobTitle"
                value={formData.jobTitle}
                onChange={e => setFormData({ ...formData, jobTitle: e.target.value })}
                data-testid="input-edit-job-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department *</Label>
              <Select value={formData.department} onValueChange={v => setFormData({ ...formData, department: v })}>
                <SelectTrigger id="edit-department" data-testid="select-edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Board of directors">Board of directors</SelectItem>
                  <SelectItem value="HR and Admin">HR and Admin</SelectItem>
                  <SelectItem value="Sales and marketing">Sales and marketing</SelectItem>
                  <SelectItem value="Quality assurance & Compliance">Quality assurance & Compliance</SelectItem>
                  <SelectItem value="IT and Systems">IT and Systems</SelectItem>
                  <SelectItem value="Audit and certifications">Audit and certifications</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-employmentType">Employment Type</Label>
              <Select value={formData.employmentType} onValueChange={v => setFormData({ ...formData, employmentType: v })}>
                <SelectTrigger id="edit-employmentType" data-testid="select-edit-employment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-supervisor">Supervisor</Label>
              <Select value={formData.supervisorId} onValueChange={v => setFormData({ ...formData, supervisorId: v })}>
                <SelectTrigger id="edit-supervisor" data-testid="select-edit-supervisor">
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(employees || []).filter(e => e.id !== selectedEmployee?.id).map(emp => (
                    <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger id="edit-status" data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedEmployee(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!formData.name || !formData.email || !formData.jobTitle || !formData.department || updateMutation.isPending}
              data-testid="button-save-employee"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>Assign a training or compliance task to this employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                value={taskFormData.title}
                onChange={e => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder="e.g., Review Quality Policy"
                data-testid="input-task-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-document">Related Document</Label>
              <Select value={taskFormData.documentId} onValueChange={v => setTaskFormData({ ...taskFormData, documentId: v })}>
                <SelectTrigger id="task-document" data-testid="select-task-document">
                  <SelectValue placeholder="Select a document (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {approvedDocs.map(doc => (
                    <SelectItem key={doc.id} value={String(doc.id)}>
                      {doc.documentCode} - {doc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskFormData.description}
                onChange={e => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="Task details..."
                data-testid="input-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-dueDate">Due Date</Label>
                <Input
                  id="task-dueDate"
                  type="date"
                  value={taskFormData.dueDate}
                  onChange={e => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                  data-testid="input-task-due-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={taskFormData.priority} onValueChange={v => setTaskFormData({ ...taskFormData, priority: v })}>
                  <SelectTrigger id="task-priority" data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                value={taskFormData.notes}
                onChange={e => setTaskFormData({ ...taskFormData, notes: e.target.value })}
                placeholder="Additional notes..."
                data-testid="input-task-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTaskDialog(false); resetTaskForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!taskFormData.title || createTaskMutation.isPending}
              data-testid="button-assign-task"
            >
              {createTaskMutation.isPending ? "Assigning..." : "Assign Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWorkflowDialog} onOpenChange={(open) => {
        setShowWorkflowDialog(open);
        if (!open) {
          setSelectedUserId("");
          setWorkflowNotes("");
          setWorkflowAction(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getWorkflowDialogTitle()}</DialogTitle>
            <DialogDescription>
              {workflowAction === 'submit_review' && `Submit ${selectedEmployee?.name}'s record to COO for review`}
              {workflowAction === 'submit_approval' && `Send ${selectedEmployee?.name}'s record to CEO for final approval`}
              {workflowAction === 'approve' && `Approve ${selectedEmployee?.name}'s employee record`}
              {workflowAction === 'reject' && `Reject ${selectedEmployee?.name}'s employee record`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(workflowAction === 'submit_review' || workflowAction === 'submit_approval') && (
              <div className="space-y-2">
                <Label htmlFor="workflow-user">
                  {workflowAction === 'submit_review' ? 'Select Reviewer' : 'Select Approver'} *
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="workflow-user" data-testid="select-workflow-user">
                    <SelectValue placeholder={workflowAction === 'submit_review' ? 'Choose a reviewer...' : 'Choose an approver...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(users || []).map(user => (
                      <SelectItem key={user.id} value={String(user.id)}>{user.name} ({user.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(workflowAction === 'submit_review' || workflowAction === 'submit_approval') && (
              <TargetDateField
                id="workflow-target"
                label={workflowAction === 'submit_review' ? 'Review due by' : 'Approval due by'}
                value={workflowTarget}
                onChange={setWorkflowTarget}
                defaultDays={TARGET_DAYS.employee_review}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="workflow-notes">Notes</Label>
              <Textarea
                id="workflow-notes"
                value={workflowNotes}
                onChange={e => setWorkflowNotes(e.target.value)}
                placeholder="Add optional notes..."
                data-testid="input-workflow-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkflowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleWorkflowAction}
              disabled={
                submitForReviewMutation.isPending || 
                submitForApprovalMutation.isPending || 
                approveMutation.isPending || 
                rejectMutation.isPending
              }
              variant={workflowAction === 'reject' ? 'destructive' : 'default'}
              data-testid="button-confirm-workflow"
            >
              {(submitForReviewMutation.isPending || submitForApprovalMutation.isPending || approveMutation.isPending || rejectMutation.isPending) 
                ? "Processing..." 
                : getWorkflowDialogTitle()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedEmployee?.name}? This action cannot be undone and will also remove all associated tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEmployee(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
