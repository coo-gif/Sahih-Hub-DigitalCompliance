import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Bug, Search, Filter, CheckCircle, Clock, AlertCircle, 
  XCircle, Eye, MessageSquare, Sparkles, User, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BugReport {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  screenshotUrl: string | null;
  priority: string;
  status: string;
  reportedById: number;
  assignedToId: number | null;
  resolutionNotes: string | null;
  resolvedById: number | null;
  resolvedAt: string | null;
  closedAt: string | null;
  userNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function BugReports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const { toast } = useToast();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    select: (data: any) => data.user,
  });

  const { data: bugReports = [], isLoading } = useQuery<BugReport[]>({
    queryKey: ["/api/bug-reports", statusFilter !== 'all' ? statusFilter : undefined],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const isCOO = currentUser?.email === 'coo@sahihcertify.com';
  const isAdmin = currentUser?.role === 'admin';
  const canManage = isCOO || isAdmin;

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolutionNotes }: { id: number; resolutionNotes: string }) => {
      return apiRequest("POST", `/api/bug-reports/${id}/resolve`, { resolutionNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports"] });
      toast({ title: "Bug Resolved", description: "The bug report has been marked as resolved." });
      setShowDetailDialog(false);
      setResolutionNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/bug-reports/${id}/close`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports"] });
      toast({ 
        title: "Bug Closed & User Congratulated!", 
        description: "The reporter has been notified and congratulated for their contribution." 
      });
      setShowDetailDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/bug-reports/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports"] });
      toast({ title: "Status Updated", description: "Bug report status has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredReports = bugReports.filter(report => {
    const matchesSearch = 
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getReporterName = (reportedById: number) => {
    const user = allUsers.find(u => u.id === reportedById);
    return user?.name || 'Unknown User';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30"><AlertCircle className="w-3 h-3 mr-1" />Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      case 'closed':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/30"><XCircle className="w-3 h-3 mr-1" />Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const openCount = bugReports.filter(r => r.status === 'open').length;
  const inProgressCount = bugReports.filter(r => r.status === 'in_progress').length;
  const resolvedCount = bugReports.filter(r => r.status === 'resolved').length;
  const closedCount = bugReports.filter(r => r.status === 'closed').length;

  if (!canManage) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              This page is only accessible to COO and Admin users. 
              Use the Hub-eebi chat to submit and view your own bug reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="w-6 h-6 text-primary" />
            Bug Reports Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and manage bug reports submitted by users
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter('open')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{openCount}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter('in_progress')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-600">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter('resolved')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter('closed')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-600">{closedCount}</p>
                <p className="text-xs text-muted-foreground">Closed</p>
              </div>
              <XCircle className="w-8 h-8 text-gray-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search bug reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-bugs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <Bug className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No bug reports found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-lg border bg-card hover-elevate cursor-pointer"
                  onClick={() => {
                    setSelectedReport(report);
                    setResolutionNotes(report.resolutionNotes || "");
                    setShowDetailDialog(true);
                  }}
                  data-testid={`bug-report-${report.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{report.ticketNumber}</span>
                        {getStatusBadge(report.status)}
                        {getPriorityBadge(report.priority)}
                      </div>
                      <h3 className="font-medium truncate">{report.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{report.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {getReporterName(report.reportedById)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(report.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              {selectedReport?.ticketNumber}
            </DialogTitle>
            <DialogDescription>
              Reported by {selectedReport ? getReporterName(selectedReport.reportedById) : ''} on{' '}
              {selectedReport && format(new Date(selectedReport.createdAt), 'MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedReport && getStatusBadge(selectedReport.status)}
                {selectedReport && getPriorityBadge(selectedReport.priority)}
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Title</Label>
                <p className="font-medium">{selectedReport?.title}</p>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Description</Label>
                <p className="text-sm whitespace-pre-wrap">{selectedReport?.description}</p>
              </div>

              {selectedReport?.screenshotUrl && (
                <div>
                  <Label className="text-muted-foreground text-xs">Screenshot</Label>
                  <img
                    src={selectedReport.screenshotUrl}
                    alt="Bug screenshot"
                    className="mt-2 rounded-lg border max-h-64 object-contain"
                  />
                </div>
              )}

              {selectedReport?.status === 'resolved' && selectedReport?.resolutionNotes && (
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <Label className="text-green-700 dark:text-green-400 text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Resolution Notes
                  </Label>
                  <p className="text-sm mt-1">{selectedReport.resolutionNotes}</p>
                </div>
              )}

              {selectedReport?.status === 'closed' && (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <Label className="text-primary text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Status
                  </Label>
                  <p className="text-sm mt-1">This bug has been closed and the reporter has been congratulated for their contribution!</p>
                </div>
              )}

              {canManage && selectedReport?.status !== 'closed' && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>Update Status / Resolution</Label>
                  
                  {selectedReport?.status === 'open' && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => updateStatusMutation.mutate({ id: selectedReport.id, status: 'in_progress' })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-mark-in-progress"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Mark as In Progress
                    </Button>
                  )}

                  {(selectedReport?.status === 'open' || selectedReport?.status === 'in_progress') && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Enter resolution notes..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        rows={3}
                        data-testid="input-resolution-notes"
                      />
                      <Button
                        className="w-full"
                        onClick={() => selectedReport && resolveMutation.mutate({ id: selectedReport.id, resolutionNotes })}
                        disabled={resolveMutation.isPending || !resolutionNotes.trim()}
                        data-testid="button-resolve-bug"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
                      </Button>
                    </div>
                  )}

                  {selectedReport?.status === 'resolved' && isCOO && (
                    <Button
                      className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                      onClick={() => selectedReport && closeMutation.mutate(selectedReport.id)}
                      disabled={closeMutation.isPending}
                      data-testid="button-close-bug"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {closeMutation.isPending ? "Closing..." : "Close & Congratulate Reporter"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
