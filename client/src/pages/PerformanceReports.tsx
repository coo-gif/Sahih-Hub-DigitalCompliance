import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Send,
  Eye,
  RefreshCw,
  Calendar,
  User
} from "lucide-react";
import { format } from "date-fns";
import { formatMinutes } from "@/hooks/use-tasks";

const percent = (value: number | null | undefined) => (value === null || value === undefined ? "-" : `${value}%`);
const scoreColor = (value: number | null | undefined) =>
  value === null || value === undefined ? "text-muted-foreground"
    : value >= 85 ? "text-green-600" : value >= 65 ? "text-amber-600" : "text-red-600";

function TaskPerformanceSection({ report }: { report: PerformanceReport }) {
  let breakdown: Record<string, { label: string; completed: number; onTime: number; late: number; open: number; avgMinutes: number | null }> = {};
  try {
    breakdown = report.taskBreakdown ? JSON.parse(report.taskBreakdown) : {};
  } catch {
    breakdown = {};
  }
  const metrics: Array<{ label: string; value: string; hint: string; className?: string }> = [
    { label: "Performance Score", value: report.performanceScore === null ? "-" : `${report.performanceScore}/100`, hint: "On-time 50%, completion 30%, efficiency 20%", className: scoreColor(report.performanceScore) },
    { label: "Tasks Assigned", value: String(report.tasksAssigned ?? 0), hint: "New this month" },
    { label: "Tasks Completed", value: String(report.tasksCompleted ?? 0), hint: `${report.tasksCompletedOnTime ?? 0} on time, ${report.tasksCompletedLate ?? 0} late`, className: "text-green-600" },
    { label: "On-time Rate", value: percent(report.onTimeRate), hint: "Completed by the due date", className: scoreColor(report.onTimeRate) },
    { label: "Completion Rate", value: percent(report.completionRate), hint: "Tasks due this month that were done", className: scoreColor(report.completionRate) },
    { label: "Efficiency", value: percent(report.efficiencyPercent), hint: "Time allowed ÷ time taken (100% = on schedule)", className: scoreColor(report.efficiencyPercent) },
    { label: "Total Time on Tasks", value: formatMinutes(report.totalTaskMinutes ?? 0), hint: "Assignment to completion, all tasks" },
    { label: "Average Turnaround", value: formatMinutes(report.avgTurnaroundMinutes), hint: "Per completed task" },
    { label: "Average Delay", value: formatMinutes(report.avgDelayMinutes), hint: "How late the late tasks were" },
    { label: "Open / Overdue", value: `${report.tasksPending ?? 0} / ${report.tasksOverdue ?? 0}`, hint: "At the end of the month (or now)", className: (report.tasksOverdue ?? 0) > 0 ? "text-red-600" : undefined },
    { label: "Returned for Rework", value: String(report.reworkCount ?? 0), hint: "Documents sent back to this person" },
    { label: "Reassigned / Handled by Others", value: String(report.tasksTransferred ?? 0), hint: "Not counted in the rates" },
  ];
  const rows = Object.values(breakdown).sort((a, b) => (b.completed + b.open) - (a.completed + a.open));
  return (
    <div className="space-y-3" data-testid="section-task-performance">
      <h4 className="font-semibold">Task Performance</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="rounded-md border p-3" data-testid={`metric-${m.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className={`text-xl font-bold ${m.className || ""}`}>{m.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</p>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2 font-medium">Task type</th>
                <th className="p-2 font-medium text-center">Completed</th>
                <th className="p-2 font-medium text-center">On time</th>
                <th className="p-2 font-medium text-center">Late</th>
                <th className="p-2 font-medium text-center">Open</th>
                <th className="p-2 font-medium text-center">Avg time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.label} className="border-t">
                  <td className="p-2">{r.label}</td>
                  <td className="p-2 text-center">{r.completed}</td>
                  <td className="p-2 text-center text-green-600">{r.onTime}</td>
                  <td className="p-2 text-center text-red-600">{r.late}</td>
                  <td className="p-2 text-center">{r.open}</td>
                  <td className="p-2 text-center">{formatMinutes(r.avgMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface PerformanceReport {
  id: number;
  userId: number;
  reportMonth: number;
  reportYear: number;
  totalActiveHours: number;
  totalOnlineHours: number;
  totalDaysActive: number;
  documentsCreated: number;
  documentsReviewed: number;
  documentsApproved: number;
  tasksCompleted: number;
  tasksOverdue: number;
  tasksPending: number;
  tasksAssigned: number | null;
  tasksCompletedOnTime: number | null;
  tasksCompletedLate: number | null;
  tasksTransferred: number | null;
  reworkCount: number | null;
  totalTaskMinutes: number | null;
  avgTurnaroundMinutes: number | null;
  avgDelayMinutes: number | null;
  onTimeRate: number | null;
  completionRate: number | null;
  efficiencyPercent: number | null;
  performanceScore: number | null;
  taskBreakdown: string | null;
  status: string;
  reviewerId: number | null;
  reviewedAt: string | null;
  reviewComments: string | null;
  approverId: number | null;
  approvedAt: string | null;
  approvalComments: string | null;
  generatedAt: string;
  userName: string;
  userEmail: string;
  reviewerName: string | null;
  approverName: string | null;
}

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function PerformanceReports() {
  const { data: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedReport, setSelectedReport] = useState<PerformanceReport | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewComments, setReviewComments] = useState("");

  const isAdmin = currentUser?.role === "admin";
  const isCOO = currentUser?.email === "coo@sahihcertify.com";
  const isCEO = currentUser?.email === "ceo@sahihcertify.com";

  const { data: reports, isLoading, dataUpdatedAt, refetch } = useQuery<PerformanceReport[]>({
    queryKey: [`/api/performance-reports?month=${selectedMonth}&year=${selectedYear}`],
    enabled: isAdmin || isCOO || isCEO,
    refetchInterval: 30000, // Auto-refresh every 30 seconds for live updates
    refetchOnWindowFocus: true,
  });

  // Track last update time for live indicator
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdated(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const generateMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      return await apiRequest("POST", "/api/performance-reports/generate", { month, year });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/performance-reports") });
      toast({ title: "Reports generated successfully" });
      setShowGenerateDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to generate reports", variant: "destructive" });
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/performance-reports/${id}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/performance-reports") });
      toast({ title: "Report submitted for review" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: number; comments?: string }) => {
      return await apiRequest("POST", `/api/performance-reports/${id}/review`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/performance-reports") });
      toast({ title: "Report reviewed and sent for approval" });
      setShowReviewDialog(false);
      setSelectedReport(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: number; comments?: string }) => {
      return await apiRequest("POST", `/api/performance-reports/${id}/approve`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/performance-reports") });
      toast({ title: "Report approved and added to user records" });
      setShowReviewDialog(false);
      setSelectedReport(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: number; comments: string }) => {
      return await apiRequest("POST", `/api/performance-reports/${id}/reject`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/performance-reports") });
      toast({ title: "Report rejected" });
      setShowReviewDialog(false);
      setSelectedReport(null);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "in_review":
        return <Badge className="bg-blue-100 text-blue-700">In Review</Badge>;
      case "pending_approval":
        return <Badge className="bg-yellow-100 text-yellow-700">Pending Approval</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!isAdmin && !isCOO && !isCEO) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              Only Admins, COO, and CEO can access performance reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monthly Performance Reports</h1>
          <p className="text-muted-foreground">
            Track user activity, document contributions, and task performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live Update Indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>Live</span>
            <span className="text-muted-foreground/60">
              Updated {format(lastUpdated, "h:mm:ss a")}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-reports"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-reports">
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Reports
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <CardTitle>Reports</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(Number(v))}
              >
                <SelectTrigger className="w-[140px]" data-testid="select-month">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[100px]" data-testid="select-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : reports && reports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-center">Active Hours</TableHead>
                  <TableHead className="text-center">Docs Created</TableHead>
                  <TableHead className="text-center">Docs Reviewed</TableHead>
                  <TableHead className="text-center">Tasks Done</TableHead>
                  <TableHead className="text-center">On Time</TableHead>
                  <TableHead className="text-center">Efficiency</TableHead>
                  <TableHead className="text-center">Overdue</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id} data-testid={`report-row-${report.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{report.userName}</p>
                          <p className="text-xs text-muted-foreground">{report.userEmail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {months.find((m) => m.value === report.reportMonth)?.label} {report.reportYear}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{report.totalActiveHours}h</TableCell>
                    <TableCell className="text-center">{report.documentsCreated}</TableCell>
                    <TableCell className="text-center">{report.documentsReviewed}</TableCell>
                    <TableCell className="text-center text-green-600">{report.tasksCompleted}</TableCell>
                    <TableCell className={`text-center ${scoreColor(report.onTimeRate)}`}>{percent(report.onTimeRate)}</TableCell>
                    <TableCell className={`text-center ${scoreColor(report.efficiencyPercent)}`}>{percent(report.efficiencyPercent)}</TableCell>
                    <TableCell className="text-center text-red-600">{report.tasksOverdue}</TableCell>
                    <TableCell className={`text-center font-semibold ${scoreColor(report.performanceScore)}`} data-testid={`report-score-${report.id}`}>
                      {report.performanceScore ?? "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedReport(report);
                            setShowReviewDialog(true);
                          }}
                          data-testid={`button-view-${report.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {isAdmin && report.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => submitForReviewMutation.mutate(report.id)}
                            data-testid={`button-submit-${report.id}`}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No reports found for this period</p>
              {isAdmin && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowGenerateDialog(true)}
                >
                  Generate Reports
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Monthly Reports</DialogTitle>
            <DialogDescription>
              Generate performance reports for all users for the selected month.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 py-4">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate({ month: selectedMonth, year: selectedYear })}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Performance Report Details</DialogTitle>
            <DialogDescription>
              {selectedReport && (
                <>
                  {selectedReport.userName} - {months.find((m) => m.value === selectedReport.reportMonth)?.label}{" "}
                  {selectedReport.reportYear}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-xs text-muted-foreground">Active Hours</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedReport.totalActiveHours}h</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-xs text-muted-foreground">Online Hours</p>
                  <p className="text-2xl font-bold text-green-600">{selectedReport.totalOnlineHours}h</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-xs text-muted-foreground">Days Active</p>
                  <p className="text-2xl font-bold text-purple-600">{selectedReport.totalDaysActive}</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Documents Created</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{selectedReport.documentsCreated}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Documents Reviewed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{selectedReport.documentsReviewed}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Documents Approved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{selectedReport.documentsApproved}</p>
                  </CardContent>
                </Card>
              </div>

              <TaskPerformanceSection report={selectedReport} />

              {(selectedReport.status === "in_review" && isCOO) ||
              (selectedReport.status === "pending_approval" && isCEO) ? (
                <div className="space-y-4 border-t pt-4">
                  <Textarea
                    placeholder="Add comments (optional)"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (reviewComments) {
                          rejectMutation.mutate({ id: selectedReport.id, comments: reviewComments });
                        } else {
                          toast({ title: "Please add rejection comments", variant: "destructive" });
                        }
                      }}
                      disabled={rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                    {isCOO && selectedReport.status === "in_review" && (
                      <Button
                        onClick={() => reviewMutation.mutate({ id: selectedReport.id, comments: reviewComments })}
                        disabled={reviewMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve & Send to CEO
                      </Button>
                    )}
                    {isCEO && selectedReport.status === "pending_approval" && (
                      <Button
                        onClick={() => approveMutation.mutate({ id: selectedReport.id, comments: reviewComments })}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Final Approve
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                selectedReport.reviewComments && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-1">Review Comments:</p>
                    <p className="text-sm text-muted-foreground">{selectedReport.reviewComments}</p>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
