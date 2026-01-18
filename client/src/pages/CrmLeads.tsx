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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Phone, Building2, User, Calendar, MessageSquare, Search, Filter, Users, History, Eye, FileText, Upload, Bell, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import type { Lead, User as UserType, LeadStatusHistory, LeadUpdateRequest } from "@shared/schema";

const createLeadSchema = z.object({
  leadName: z.string().min(1, "Lead name is required"),
  companyName: z.string().optional(),
  phoneEmail: z.string().optional(),
  leadSource: z.enum(["website", "referral", "ads", "whatsapp"]),
  interestedCourse: z.string().optional(),
  leadStatus: z.enum(["new", "contacted", "qualified", "not_interested", "pending", "proposal_submitted", "approved", "lost", "not_relevant"]).optional(),
  assignedToId: z.number().optional().nullable(),
  nextFollowUpDate: z.string().optional(),
  notes: z.string().optional(),
});

type CreateLeadData = z.infer<typeof createLeadSchema>;

interface StatusHistoryEntry extends LeadStatusHistory {
  changedByName: string;
}

interface UpdateRequestEntry extends LeadUpdateRequest {
  requestedByName: string;
  requestedFromName: string;
}

const leadSourceLabels: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  ads: "Ads",
  whatsapp: "WhatsApp",
};

const leadStatusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  not_interested: "Not Interested",
  pending: "Pending",
  proposal_submitted: "Proposal Submitted",
  approved: "Approved",
  lost: "Lost",
  not_relevant: "Not Relevant",
};

const leadStatusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  qualified: "bg-green-500/10 text-green-500 border-green-500/20",
  not_interested: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  proposal_submitted: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  lost: "bg-red-500/10 text-red-500 border-red-500/20",
  not_relevant: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

export default function CrmLeads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLeadDetailsOpen, setIsLeadDetailsOpen] = useState(false);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [isAskUpdateOpen, setIsAskUpdateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusReason, setStatusReason] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateTargetUserId, setUpdateTargetUserId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateLeadData>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      leadName: "",
      companyName: "",
      phoneEmail: "",
      leadSource: "website",
      interestedCourse: "",
      leadStatus: "new",
      assignedToId: null,
      nextFollowUpDate: "",
      notes: "",
    },
  });

  const editForm = useForm<CreateLeadData>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      leadName: "",
      companyName: "",
      phoneEmail: "",
      leadSource: "website",
      interestedCourse: "",
      leadStatus: "new",
      assignedToId: null,
      nextFollowUpDate: "",
      notes: "",
    },
  });

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  const { data: statusHistory = [] } = useQuery<StatusHistoryEntry[]>({
    queryKey: ["/api/leads", selectedLead?.id, "status-history"],
    enabled: !!selectedLead && isLeadDetailsOpen,
  });

  const { data: updateRequests = [] } = useQuery<UpdateRequestEntry[]>({
    queryKey: ["/api/leads", selectedLead?.id, "update-requests"],
    enabled: !!selectedLead && isLeadDetailsOpen,
  });

  const isCooOrAdmin = currentUser?.email === 'coo@sahihcertify.com' || currentUser?.role === 'admin';

  const createLead = useMutation({
    mutationFn: async (data: CreateLeadData) => {
      return apiRequest("POST", "/api/leads", {
        ...data,
        assignedToId: data.assignedToId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Lead created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating lead", description: error.message, variant: "destructive" });
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<CreateLeadData>) => {
      return apiRequest("PUT", `/api/leads/${id}`, {
        ...data,
        assignedToId: data.assignedToId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setIsEditDialogOpen(false);
      setSelectedLead(null);
      toast({ title: "Lead updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating lead", description: error.message, variant: "destructive" });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting lead", description: error.message, variant: "destructive" });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ leadId, newStatus, reason, evidenceUrl, evidenceFileName }: {
      leadId: number;
      newStatus: string;
      reason: string;
      evidenceUrl?: string;
      evidenceFileName?: string;
    }) => {
      return apiRequest("POST", `/api/leads/${leadId}/status`, {
        newStatus,
        reason,
        evidenceUrl,
        evidenceFileName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", selectedLead?.id, "status-history"] });
      setIsStatusChangeOpen(false);
      setNewStatus("");
      setStatusReason("");
      setEvidenceFile(null);
      toast({ title: "Status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  const requestUpdate = useMutation({
    mutationFn: async ({ leadId, requestedFromId, message }: {
      leadId: number;
      requestedFromId: number;
      message: string;
    }) => {
      return apiRequest("POST", `/api/leads/${leadId}/update-requests`, {
        requestedFromId,
        message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", selectedLead?.id, "update-requests"] });
      setIsAskUpdateOpen(false);
      setUpdateMessage("");
      setUpdateTargetUserId(null);
      toast({ title: "Update request sent successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error sending update request", description: error.message, variant: "destructive" });
    },
  });

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsLeadDetailsOpen(true);
  };

  const handleOpenStatusChange = (lead: Lead) => {
    setSelectedLead(lead);
    setNewStatus(lead.leadStatus || "new");
    setIsStatusChangeOpen(true);
  };

  const handleOpenAskUpdate = (lead: Lead) => {
    setSelectedLead(lead);
    setUpdateTargetUserId(lead.assignedToId || null);
    setIsAskUpdateOpen(true);
  };

  const handleStatusChangeSubmit = async () => {
    if (!selectedLead || !newStatus) return;
    
    let evidenceUrl = undefined;
    let evidenceFileName = undefined;
    
    if (evidenceFile) {
      const formData = new FormData();
      formData.append('file', evidenceFile);
      
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        const result = await response.json();
        if (result.url) {
          evidenceUrl = result.url;
          evidenceFileName = evidenceFile.name;
        }
      } catch (error) {
        console.error("Error uploading evidence:", error);
      }
    }
    
    changeStatus.mutate({
      leadId: selectedLead.id,
      newStatus,
      reason: statusReason,
      evidenceUrl,
      evidenceFileName,
    });
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    editForm.reset({
      leadName: lead.leadName,
      companyName: lead.companyName || "",
      phoneEmail: lead.phoneEmail || "",
      leadSource: lead.leadSource as any,
      interestedCourse: lead.interestedCourse || "",
      leadStatus: lead.leadStatus as any,
      assignedToId: lead.assignedToId || null,
      nextFollowUpDate: lead.nextFollowUpDate ? format(new Date(lead.nextFollowUpDate), "yyyy-MM-dd") : "",
      notes: lead.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (lead.phoneEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || lead.leadStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getAssignedUserName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    const user = users.find((u) => u.id === userId);
    return user?.name || "Unknown";
  };

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.leadStatus === "new").length,
    contacted: leads.filter((l) => l.leadStatus === "contacted").length,
    qualified: leads.filter((l) => l.leadStatus === "qualified").length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM - Leads</h1>
          <p className="text-muted-foreground">Manage and track your sales leads</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-lead">
              <Plus className="mr-2 h-4 w-4" />
              Add New Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>Enter the details for the new lead</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createLead.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leadName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Full name" {...field} data-testid="input-lead-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name" {...field} data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phoneEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone / Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number or email address" {...field} data-testid="input-phone-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leadSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Source *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead-source">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="website">Website</SelectItem>
                            <SelectItem value="referral">Referral</SelectItem>
                            <SelectItem value="ads">Ads</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leadStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="not_interested">Not Interested</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="proposal_submitted">Proposal Submitted</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                            <SelectItem value="not_relevant">Not Relevant</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="interestedCourse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interested Course / ISO Certification</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ISO 9001, ISO 14001, Lead Auditor Course" {...field} data-testid="input-interested-course" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assignedToId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "unassigned" ? null : parseInt(value))}
                          value={field.value?.toString() || "unassigned"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-assigned-to">
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nextFollowUpDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next Follow-up Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-follow-up-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes about the lead..." className="min-h-[100px]" {...field} data-testid="textarea-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLead.isPending} data-testid="button-submit-lead">
                    {createLead.isPending ? "Creating..." : "Create Lead"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacted</CardTitle>
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contacted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.qualified}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Leads</CardTitle>
              <CardDescription>View and manage all your leads</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  className="pl-9 w-full sm:w-[250px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-leads"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || statusFilter !== "all" ? "No leads match your filters" : "No leads yet. Click 'Add New Lead' to get started."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {lead.leadName}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.companyName ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {lead.companyName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.phoneEmail ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {lead.phoneEmail}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{leadSourceLabels[lead.leadSource] || lead.leadSource}</Badge>
                      </TableCell>
                      <TableCell>
                        {lead.interestedCourse ? (
                          <span className="text-sm">{lead.interestedCourse}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={leadStatusColors[lead.leadStatus] || ""}>
                          {leadStatusLabels[lead.leadStatus] || lead.leadStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{getAssignedUserName(lead.assignedToId)}</TableCell>
                      <TableCell>
                        {lead.nextFollowUpDate ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(lead.nextFollowUpDate), "MMM dd, yyyy")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(lead)}
                            data-testid={`button-view-lead-${lead.id}`}
                            title="View Details & History"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenStatusChange(lead)}
                            data-testid={`button-change-status-${lead.id}`}
                            title="Change Status"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {isCooOrAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenAskUpdate(lead)}
                              data-testid={`button-ask-update-${lead.id}`}
                              title="Ask for Update"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lead)}
                            data-testid={`button-edit-lead-${lead.id}`}
                            title="Edit Lead"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this lead?")) {
                                deleteLead.mutate(lead.id);
                              }
                            }}
                            data-testid={`button-delete-lead-${lead.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update the lead information</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((data) => {
                if (selectedLead) {
                  updateLead.mutate({ id: selectedLead.id, ...data });
                }
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="leadName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} data-testid="edit-input-lead-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name" {...field} data-testid="edit-input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="phoneEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone / Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number or email address" {...field} data-testid="edit-input-phone-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="leadSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="edit-select-lead-source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="ads">Ads</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="leadStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="edit-select-lead-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="proposal_submitted">Proposal Submitted</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="not_relevant">Not Relevant</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="interestedCourse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interested Course / ISO Certification</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., ISO 9001, ISO 14001, Lead Auditor Course" {...field} data-testid="edit-input-interested-course" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "unassigned" ? null : parseInt(value))}
                        value={field.value?.toString() || "unassigned"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="edit-select-assigned-to">
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="nextFollowUpDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Follow-up Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="edit-input-follow-up-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes about the lead..." className="min-h-[100px]" {...field} data-testid="edit-textarea-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateLead.isPending} data-testid="button-update-lead">
                  {updateLead.isPending ? "Updating..." : "Update Lead"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Lead Details Dialog with Status History */}
      <Dialog open={isLeadDetailsOpen} onOpenChange={setIsLeadDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedLead?.leadName}
            </DialogTitle>
            <DialogDescription>
              Lead details and complete interaction history
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" data-testid="tab-lead-details">Details</TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-status-history">Status History</TabsTrigger>
                <TabsTrigger value="requests" data-testid="tab-update-requests">Update Requests</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Company</p>
                    <p className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {selectedLead.companyName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Contact</p>
                    <p className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {selectedLead.phoneEmail || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Source</p>
                    <p>{leadSourceLabels[selectedLead.leadSource] || selectedLead.leadSource}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                    <Badge className={leadStatusColors[selectedLead.leadStatus || "new"]}>
                      {leadStatusLabels[selectedLead.leadStatus || "new"]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Interested Course</p>
                    <p>{selectedLead.interestedCourse || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
                    <p>{getAssignedUserName(selectedLead.assignedToId)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Next Follow-up</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {selectedLead.nextFollowUpDate 
                        ? format(new Date(selectedLead.nextFollowUpDate), "MMM d, yyyy")
                        : "Not scheduled"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p>{selectedLead.createdAt 
                      ? format(new Date(selectedLead.createdAt), "MMM d, yyyy HH:mm")
                      : "N/A"
                    }</p>
                  </div>
                </div>
                {selectedLead.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Notes</p>
                    <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedLead.notes}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="history" className="mt-4">
                <ScrollArea className="h-[350px]">
                  {statusHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No status changes recorded yet</p>
                  ) : (
                    <div className="space-y-4">
                      {statusHistory.map((entry) => (
                        <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={leadStatusColors[entry.previousStatus || "new"]}>
                              {leadStatusLabels[entry.previousStatus || "new"]}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge className={leadStatusColors[entry.newStatus || "new"]}>
                              {leadStatusLabels[entry.newStatus || "new"]}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Changed by <span className="font-medium">{entry.changedByName}</span> on{" "}
                            {entry.changedAt ? format(new Date(entry.changedAt), "MMM d, yyyy 'at' HH:mm") : "N/A"}
                          </div>
                          {entry.reason && (
                            <div className="text-sm">
                              <span className="font-medium">Reason:</span> {entry.reason}
                            </div>
                          )}
                          {entry.evidenceUrl && (
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="h-4 w-4" />
                              <a 
                                href={entry.evidenceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {entry.evidenceFileName || "View Evidence"}
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="requests" className="mt-4">
                <ScrollArea className="h-[350px]">
                  {updateRequests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No update requests for this lead</p>
                  ) : (
                    <div className="space-y-4">
                      {updateRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4 text-orange-500" />
                              <span className="font-medium">{request.requestedByName}</span>
                              <span className="text-muted-foreground">requested update from</span>
                              <span className="font-medium">{request.requestedFromName}</span>
                            </div>
                            <Badge variant={request.isResolved ? "secondary" : "default"}>
                              {request.isResolved ? "Resolved" : "Pending"}
                            </Badge>
                          </div>
                          <p className="text-sm bg-muted p-2 rounded">{request.message}</p>
                          <div className="text-xs text-muted-foreground">
                            {request.createdAt ? format(new Date(request.createdAt), "MMM d, yyyy 'at' HH:mm") : "N/A"}
                            {request.resolvedAt && ` • Resolved: ${format(new Date(request.resolvedAt), "MMM d, yyyy 'at' HH:mm")}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeadDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={isStatusChangeOpen} onOpenChange={setIsStatusChangeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Lead Status</DialogTitle>
            <DialogDescription>
              Update the status of {selectedLead?.leadName}. Please provide a reason and optional evidence.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Status</label>
              <Badge className={leadStatusColors[selectedLead?.leadStatus || "new"]}>
                {leadStatusLabels[selectedLead?.leadStatus || "new"]}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status *</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-new-status">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(leadStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Change *</label>
              <Textarea
                placeholder="Explain why you are changing the status..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="min-h-[80px]"
                data-testid="textarea-status-reason"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Evidence (Optional)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  className="hidden"
                  data-testid="input-evidence-file"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Evidence
                </Button>
                {evidenceFile && (
                  <span className="text-sm text-muted-foreground">{evidenceFile.name}</span>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsStatusChangeOpen(false);
                setNewStatus("");
                setStatusReason("");
                setEvidenceFile(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStatusChangeSubmit}
              disabled={!newStatus || !statusReason || changeStatus.isPending}
              data-testid="button-submit-status-change"
            >
              {changeStatus.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ask for Update Dialog (COO/Admin only) */}
      <Dialog open={isAskUpdateOpen} onOpenChange={setIsAskUpdateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Lead Update</DialogTitle>
            <DialogDescription>
              Request an update on {selectedLead?.leadName} from the assigned user.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Request From *</label>
              <Select 
                value={updateTargetUserId?.toString() || ""} 
                onValueChange={(value) => setUpdateTargetUserId(parseInt(value))}
              >
                <SelectTrigger data-testid="select-update-target">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Message *</label>
              <Textarea
                placeholder="What update do you need on this lead?"
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-update-message"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAskUpdateOpen(false);
                setUpdateMessage("");
                setUpdateTargetUserId(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedLead && updateTargetUserId && updateMessage) {
                  requestUpdate.mutate({
                    leadId: selectedLead.id,
                    requestedFromId: updateTargetUserId,
                    message: updateMessage,
                  });
                }
              }}
              disabled={!updateTargetUserId || !updateMessage || requestUpdate.isPending}
              data-testid="button-submit-update-request"
            >
              {requestUpdate.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
