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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, DollarSign, Calendar, Target, FileText, Search, Upload, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { Opportunity, Customer } from "@shared/schema";

const createOpportunitySchema = z.object({
  opportunityName: z.string().min(1, "Opportunity name is required"),
  customerId: z.number().optional().nullable(),
  courseIsoCertification: z.string().optional(),
  dealValue: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  stage: z.enum(["qualified", "proposal_sent", "negotiation", "won", "lost"]).optional(),
  discount: z.string().optional(),
  notes: z.string().optional(),
});

type CreateOpportunityData = z.infer<typeof createOpportunitySchema>;

const stageLabels: Record<string, string> = {
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const stageColors: Record<string, string> = {
  qualified: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  proposal_sent: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  negotiation: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  won: "bg-green-500/10 text-green-500 border-green-500/20",
  lost: "bg-red-500/10 text-red-500 border-red-500/20",
};

const courseOptions = [
  "ISO 9001:2015 - Quality Management",
  "ISO 14001:2015 - Environmental Management",
  "ISO 45001:2018 - Occupational Health & Safety",
  "ISO 27001:2022 - Information Security",
  "ISO 22000:2018 - Food Safety",
  "ISO 13485:2016 - Medical Devices",
  "IATF 16949:2016 - Automotive Quality",
  "AS9100D - Aerospace Quality",
  "Lead Auditor Training",
  "Internal Auditor Training",
  "Other",
];

export default function CrmOpportunities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateOpportunityData>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: {
      opportunityName: "",
      customerId: null,
      courseIsoCertification: "",
      dealValue: "",
      expectedCloseDate: "",
      stage: "qualified",
      discount: "",
      notes: "",
    },
  });

  const editForm = useForm<CreateOpportunityData>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: {
      opportunityName: "",
      customerId: null,
      courseIsoCertification: "",
      dealValue: "",
      expectedCloseDate: "",
      stage: "qualified",
      discount: "",
      notes: "",
    },
  });

  const { data: opportunities = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createOpportunity = useMutation({
    mutationFn: async (data: CreateOpportunityData) => {
      return apiRequest("POST", "/api/opportunities", {
        ...data,
        customerId: data.customerId || undefined,
        expectedCloseDate: data.expectedCloseDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Opportunity created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating opportunity", description: error.message, variant: "destructive" });
    },
  });

  const updateOpportunity = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<CreateOpportunityData>) => {
      return apiRequest("PUT", `/api/opportunities/${id}`, {
        ...data,
        customerId: data.customerId || undefined,
        expectedCloseDate: data.expectedCloseDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setIsEditDialogOpen(false);
      setSelectedOpportunity(null);
      editForm.reset();
      toast({ title: "Opportunity updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating opportunity", description: error.message, variant: "destructive" });
    },
  });

  const deleteOpportunity = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/opportunities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ title: "Opportunity deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting opportunity", description: error.message, variant: "destructive" });
    },
  });

  const uploadProposal = useMutation({
    mutationFn: async ({ opportunityId, file }: { opportunityId: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }
      
      const { url } = await uploadResponse.json();
      
      return apiRequest("POST", `/api/opportunities/${opportunityId}/proposal`, {
        fileUrl: url,
        fileName: file.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ title: "Proposal uploaded successfully" });
      setIsUploading(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error uploading proposal", description: error.message, variant: "destructive" });
      setIsUploading(false);
    },
  });

  const handleFileUpload = async (opportunityId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    uploadProposal.mutate({ opportunityId, file });
  };

  const handleEditClick = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    editForm.reset({
      opportunityName: opportunity.opportunityName,
      customerId: opportunity.customerId,
      courseIsoCertification: opportunity.courseIsoCertification || "",
      dealValue: opportunity.dealValue || "",
      expectedCloseDate: opportunity.expectedCloseDate ? format(new Date(opportunity.expectedCloseDate), "yyyy-MM-dd") : "",
      stage: (opportunity.stage as any) || "qualified",
      discount: opportunity.discount || "",
      notes: opportunity.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const onCreateSubmit = (data: CreateOpportunityData) => {
    createOpportunity.mutate(data);
  };

  const onEditSubmit = (data: CreateOpportunityData) => {
    if (selectedOpportunity) {
      updateOpportunity.mutate({ id: selectedOpportunity.id, ...data });
    }
  };

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const matchesSearch = 
      opportunity.opportunityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opportunity.courseIsoCertification?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStage = stageFilter === "all" || opportunity.stage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return "-";
    const customer = customers.find((c) => c.id === customerId);
    return customer?.customerName || "-";
  };

  const calculateTotalValue = (stage?: string) => {
    const filtered = stage ? opportunities.filter((o) => o.stage === stage) : opportunities;
    return filtered.reduce((sum, o) => {
      const value = parseFloat(o.dealValue || "0");
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="crm-opportunities-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Opportunities</h1>
          <p className="text-muted-foreground">Track and manage sales opportunities</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-opportunity">
              <Plus className="mr-2 h-4 w-4" />
              Add Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Opportunity</DialogTitle>
              <DialogDescription>Enter the opportunity details below</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="opportunityName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opportunity Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter opportunity name" {...field} data-testid="input-opportunity-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                          value={field.value?.toString() || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-customer">
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No customer selected</SelectItem>
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id.toString()}>
                                {customer.customerName}
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
                    name="courseIsoCertification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course / ISO Certification</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-course">
                              <SelectValue placeholder="Select certification" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {courseOptions.map((course) => (
                              <SelectItem key={course} value={course}>
                                {course}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dealValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deal Value (QAR)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 50000" {...field} data-testid="input-deal-value" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount (%)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 10" {...field} data-testid="input-discount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expectedCloseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Close Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-close-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "qualified"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-stage">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                            <SelectItem value="negotiation">Negotiation</SelectItem>
                            <SelectItem value="won">Won</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Textarea 
                          placeholder="Additional notes..." 
                          className="min-h-[80px]" 
                          {...field} 
                          data-testid="input-notes" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createOpportunity.isPending} data-testid="button-submit-create">
                    {createOpportunity.isPending ? "Creating..." : "Create Opportunity"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card data-testid="card-stat-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total">
              QAR {calculateTotalValue().toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{opportunities.length} opportunities</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-qualified">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {opportunities.filter((o) => o.stage === "qualified").length}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-proposal">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proposal Sent</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {opportunities.filter((o) => o.stage === "proposal_sent").length}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-won">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              QAR {calculateTotalValue("won").toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-lost">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lost</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {opportunities.filter((o) => o.stage === "lost").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Opportunity List</CardTitle>
              <CardDescription>View and manage all sales opportunities</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search opportunities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                  data-testid="input-search-opportunities"
                />
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-stage-filter">
                  <SelectValue placeholder="Filter by stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading opportunities...</div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-opportunities">
              {searchQuery || stageFilter !== "all" ? "No opportunities match your filters" : "No opportunities yet. Create your first opportunity!"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Course / Certification</TableHead>
                  <TableHead>Deal Value</TableHead>
                  <TableHead>Expected Close</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Proposal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOpportunities.map((opportunity) => (
                  <TableRow key={opportunity.id} data-testid={`row-opportunity-${opportunity.id}`}>
                    <TableCell>
                      <div className="font-medium" data-testid={`text-opportunity-name-${opportunity.id}`}>
                        {opportunity.opportunityName}
                      </div>
                      {opportunity.discount && (
                        <div className="text-sm text-muted-foreground">
                          Discount: {opportunity.discount}%
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getCustomerName(opportunity.customerId)}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {opportunity.courseIsoCertification || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {opportunity.dealValue ? (
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="h-3 w-3" />
                          QAR {parseFloat(opportunity.dealValue).toLocaleString()}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {opportunity.expectedCloseDate ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(opportunity.expectedCloseDate), "MMM dd, yyyy")}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={stageColors[opportunity.stage || "qualified"]} variant="outline">
                        {stageLabels[opportunity.stage || "qualified"]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {opportunity.proposalFileUrl ? (
                        <a
                          href={opportunity.proposalFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm"
                          data-testid={`link-proposal-${opportunity.id}`}
                        >
                          <FileText className="h-4 w-4" />
                          <span className="truncate max-w-[80px]">{opportunity.proposalFileName || "View"}</span>
                        </a>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => handleFileUpload(opportunity.id, e)}
                            className="hidden"
                            accept=".pdf,.doc,.docx"
                            data-testid={`input-upload-proposal-${opportunity.id}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOpportunity(opportunity);
                              fileInputRef.current?.click();
                            }}
                            disabled={isUploading}
                            data-testid={`button-upload-proposal-${opportunity.id}`}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            {isUploading && selectedOpportunity?.id === opportunity.id ? "..." : "Upload"}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(opportunity)}
                          data-testid={`button-edit-opportunity-${opportunity.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this opportunity?")) {
                              deleteOpportunity.mutate(opportunity.id);
                            }
                          }}
                          data-testid={`button-delete-opportunity-${opportunity.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
            <DialogDescription>Update the opportunity details below</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="opportunityName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opportunity Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter opportunity name" {...field} data-testid="input-edit-opportunity-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-customer">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No customer selected</SelectItem>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.customerName}
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
                  name="courseIsoCertification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course / ISO Certification</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-course">
                            <SelectValue placeholder="Select certification" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {courseOptions.map((course) => (
                            <SelectItem key={course} value={course}>
                              {course}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="dealValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal Value (QAR)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50000" {...field} data-testid="input-edit-deal-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10" {...field} data-testid="input-edit-discount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="expectedCloseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Close Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-close-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "qualified"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-stage">
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Textarea 
                        placeholder="Additional notes..." 
                        className="min-h-[80px]" 
                        {...field} 
                        data-testid="input-edit-notes" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateOpportunity.isPending} data-testid="button-submit-edit">
                  {updateOpportunity.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
