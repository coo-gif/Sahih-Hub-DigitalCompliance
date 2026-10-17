import { useState } from "react";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useSubmitDocumentForReview, useDocumentAccessRequests, useCreateDocumentAccessRequest, useDocumentAccess } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { DocumentStatus, DocumentHubStatus, DocumentClassification } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TiptapEditor from "@/components/TiptapEditor";
import DOMPurify from "dompurify";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, MoreHorizontal, Pencil, Trash2, AlertCircle, Eye, FileText, Calendar, Clock, FileDown, Loader2, Send, Lock, Unlock, UserCog, Shield, Users, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import type { Document } from "@shared/schema";
import sahihLogoPath from "@assets/sahih_logo-1.png";
import { TargetDateField, TARGET_DAYS, defaultTargetInput, targetToIso } from "@/components/TargetDateField";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-slate-700",
};

const categoryColors: Record<string, string> = {
  policy: "bg-purple-100 text-purple-700",
  manual: "bg-indigo-100 text-indigo-700",
  sop: "bg-teal-100 text-teal-700",
  format: "bg-orange-100 text-orange-700",
  job_description: "bg-blue-100 text-blue-700",
};

export default function Documents() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showSubmitReviewDialog, setShowSubmitReviewDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");
  const [reassignComment, setReassignComment] = useState("");
  const [reviewTarget, setReviewTarget] = useState(defaultTargetInput(TARGET_DAYS.review));
  const [reassignTarget, setReassignTarget] = useState(defaultTargetInput(TARGET_DAYS.review));
  
  const filters = {
    status: statusFilter !== "all" ? statusFilter : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  };
  
  const { data: documents, isLoading, isError } = useDocuments(filters);
  const { toast } = useToast();
  
  const createMutation = useCreateDocument();
  const updateMutation = useUpdateDocument();
  const deleteMutation = useDeleteDocument();
  const submitForReviewMutation = useSubmitDocumentForReview();
  
  const { data: users = [] } = useUsers();
  const { data: currentUser } = useAuth();
  
  // Access control - only COO has automatic access to approved documents
  const COO_EMAIL = 'coo@sahihcertify.com';
  const isCOO = currentUser?.email === COO_EMAIL;
  const isAdminOrQM = currentUser?.role === 'admin' || currentUser?.role === 'quality_manager';
  const { data: myAccessRequests = [] } = useDocumentAccessRequests({ 
    requesterId: currentUser?.id 
  });
  const { data: myDocumentAccess = [] } = useDocumentAccess({ 
    userId: currentUser?.id 
  });
  const requestAccessMutation = useCreateDocumentAccessRequest();
  
  // Check if user has access to an approved/locked document
  // Only COO has automatic access; others need explicit grant
  const hasAccessToDocument = (doc: Document): boolean => {
    if (isCOO) return true;
    // The server says whether this reader can open the document (access grant, classification, workflow role)
    const fromServer = (doc as Document & { viewerHasAccess?: boolean }).viewerHasAccess;
    if (fromServer !== undefined) return fromServer;
    if (doc.lifecycleStatus === "obsolete" || doc.lifecycleStatus === "quarantine") return false;
    if (doc.hubStatus === DocumentHubStatus.STORED && doc.classification === DocumentClassification.PUBLIC_INFORMATION) return true;
    return myDocumentAccess.some((access: any) => access.documentId === doc.id && !access.isRevoked);
  };
  
  // Check if user has a pending access request for a document
  const hasPendingAccessRequest = (docId: number): boolean => {
    return myAccessRequests.some((req: any) => req.documentId === docId && req.status === 'pending');
  };
  
  // Download requests: reading an approved document does not include downloading its PDF
  type DownloadState = { viewerCanDownload?: boolean; pdfAvailable?: boolean };
  const { data: downloadRequests = [] } = useQuery<{ id: number; documentId: number; requesterId: number; status: string }[]>({
    queryKey: ["/api/download-requests"],
    enabled: !!currentUser,
  });
  const myDownloadRequest = (docId: number) =>
    downloadRequests.filter(r => r.documentId === docId && r.requesterId === currentUser?.id).sort((a, b) => b.id - a.id)[0];
  const [downloadRequestDoc, setDownloadRequestDoc] = useState<Document | null>(null);
  const [downloadReason, setDownloadReason] = useState("");
  const requestDownloadMutation = useMutation({
    mutationFn: async ({ documentId, reason }: { documentId: number; reason: string }) =>
      (await apiRequest("POST", "/api/download-requests", { documentId, reason })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/download-requests"] });
      toast({ title: "Download request submitted", description: "An admin or the Quality Manager will review it." });
      setDownloadRequestDoc(null);
      setDownloadReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error requesting download", description: error.message, variant: "destructive" });
    },
  });

  // Handle requesting access to a document
  const handleRequestAccess = async (doc: Document) => {
    try {
      await requestAccessMutation.mutateAsync({ 
        documentId: doc.id, 
        requestReason: `Request access to view document: ${doc.documentCode} - ${doc.title}` 
      });
      toast({ title: "Access request submitted", description: "The COO will review your request." });
    } catch (error: any) {
      toast({ title: "Error requesting access", description: error.message, variant: "destructive" });
    }
  };

  const [formData, setFormData] = useState({
    documentCode: "",
    title: "",
    description: "",
    category: "sop" as string,
    content: "",
    nextReviewDate: "",
  });
  
  const resetForm = () => {
    setFormData({
      documentCode: "",
      title: "",
      description: "",
      category: "sop",
      content: "",
      nextReviewDate: "",
    });
  };
  
  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        documentCode: formData.documentCode,
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category as "policy" | "manual" | "sop" | "format",
        content: formData.content || undefined,
        nextReviewDate: formData.nextReviewDate || undefined,
      });
      toast({ title: "Document created successfully" });
      setShowCreateDialog(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error creating document", description: error.message, variant: "destructive" });
    }
  };
  
  const handleEdit = async () => {
    if (!selectedDocument) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedDocument.id,
        data: {
          title: formData.title,
          description: formData.description,
          content: formData.content,
          nextReviewDate: formData.nextReviewDate || undefined,
        },
      });
      toast({ title: "Document updated successfully" });
      setShowEditDialog(false);
      setSelectedDocument(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error updating document", description: error.message, variant: "destructive" });
    }
  };
  
  const handleDelete = async () => {
    if (!selectedDocument) return;
    try {
      await deleteMutation.mutateAsync(selectedDocument.id);
      toast({ title: "Document deleted successfully" });
      setShowDeleteDialog(false);
      setSelectedDocument(null);
    } catch (error: any) {
      toast({ title: "Error deleting document", description: error.message, variant: "destructive" });
    }
  };
  
  const handleGeneratePdf = async (doc: Document) => {
    setSelectedDocument(doc);
    setIsGeneratingPdf(true);
    setPdfUrl(null);
    setShowPdfDialog(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for full Puppeteer version
      
      // Use full Puppeteer PDF generation for proper table and formatting support
      const response = await fetch(`/api/documents/${doc.id}/generate-pdf`, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate PDF');
      }
      
      const data = await response.json();
      setPdfUrl(data.pdfUrl);
      toast({ title: "PDF generated successfully" });
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' 
        ? 'PDF generation timed out. Please try again.' 
        : error.message || 'Failed to generate PDF';
      toast({ title: "Error generating PDF", description: errorMessage, variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleViewPdf = async (doc: Document) => {
    setSelectedDocument(doc);
    setShowPdfDialog(true);
    
    if (doc.finalPdfUrl) {
      setPdfUrl(doc.finalPdfUrl);
    } else {
      handleGeneratePdf(doc);
    }
  };

  
  const openEditDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setFormData({
      documentCode: doc.documentCode,
      title: doc.title,
      description: doc.description || "",
      category: doc.category,
      content: doc.content || "",
      nextReviewDate: doc.nextReviewDate ? format(new Date(doc.nextReviewDate), "yyyy-MM-dd") : "",
    });
    setShowEditDialog(true);
  };
  
  const openDeleteDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setShowDeleteDialog(true);
  };
  
  const openViewDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setShowViewDialog(true);
  };

  const openSubmitReviewDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setSelectedReviewerId("");
    setSelectedApproverId("");
    setReviewComment("");
    setReviewTarget(defaultTargetInput(TARGET_DAYS.review));
    setShowSubmitReviewDialog(true);
  };

  const handleSubmitForReview = async () => {
    if (!selectedDocument || !selectedReviewerId) return;
    
    try {
      await submitForReviewMutation.mutateAsync({
        id: selectedDocument.id,
        reviewerId: parseInt(selectedReviewerId),
        approverId: selectedApproverId ? parseInt(selectedApproverId) : undefined,
        notes: reviewComment || undefined,
        reviewTargetDate: targetToIso(reviewTarget),
      });
      toast({ title: "Document submitted for review" });
      setShowSubmitReviewDialog(false);
      setSelectedDocument(null);
    } catch (error: any) {
      toast({ title: "Error submitting for review", description: error.message, variant: "destructive" });
    }
  };

  const openReassignDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setSelectedReviewerId(doc.reviewerId?.toString() || "");
    setSelectedApproverId(doc.approverId?.toString() || "");
    setReassignComment("");
    setReassignTarget(defaultTargetInput(doc.status === "pending_approval" ? TARGET_DAYS.approve : TARGET_DAYS.review));
    setShowReassignDialog(true);
  };

  const handleReassign = async () => {
    if (!selectedDocument) return;
    
    const isApprovalTask = selectedDocument.status === "pending_approval";
    
    // Get reviewer ID - use existing if not changed
    const reviewerId = selectedReviewerId && selectedReviewerId !== "none" && selectedReviewerId !== "" 
      ? parseInt(selectedReviewerId) 
      : selectedDocument.reviewerId;
    
    // Get approver ID - use existing if not changed  
    const approverId = selectedApproverId && selectedApproverId !== "none" && selectedApproverId !== ""
      ? parseInt(selectedApproverId)
      : selectedDocument.approverId;
    
    // Determine which task we're reassigning based on status
    const taskType = isApprovalTask ? "approve" : "review";
    const newAssigneeId = isApprovalTask ? approverId : reviewerId;
    
    if (!newAssigneeId || isNaN(newAssigneeId)) {
      toast({ 
        title: "Please select an assignee", 
        description: isApprovalTask ? "Please select an approver" : "Please select a reviewer",
        variant: "destructive" 
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/documents/${selectedDocument.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          taskType,
          newAssigneeId,
          newApproverId: !isApprovalTask && approverId && !isNaN(approverId) ? approverId : undefined,
          reason: reassignComment || 'Task reassigned',
          targetDate: targetToIso(reassignTarget),
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reassign task');
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      toast({ title: "Task re-assigned successfully" });
      setShowReassignDialog(false);
      setSelectedDocument(null);
    } catch (error: any) {
      toast({ title: "Error re-assigning task", description: error.message, variant: "destructive" });
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-semibold" data-testid="text-error-title">Failed to load documents</h2>
        <p className="text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Document Control</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">Master List Matrix - ISO 17021 Compliant</p>
        </div>
        <Button onClick={() => navigate("/documents/new")} data-testid="button-create-document">
          <Plus className="w-4 h-4 mr-2" />
          New Document
        </Button>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-status-all">All Statuses</SelectItem>
                  <SelectItem value="draft" data-testid="option-status-draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="category-filter">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter" data-testid="select-category-filter">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-category-all">All Categories</SelectItem>
                  <SelectItem value="policy" data-testid="option-category-policy">Policy</SelectItem>
                  <SelectItem value="manual" data-testid="option-category-manual">Manual</SelectItem>
                  <SelectItem value="sop" data-testid="option-category-sop">SOP</SelectItem>
                  <SelectItem value="format" data-testid="option-category-format">Format</SelectItem>
                  <SelectItem value="job_description" data-testid="option-category-job_description">Job Description</SelectItem>
                  <SelectItem value="training_assessment" data-testid="option-category-training">Trainings and Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Table */}
      <Card data-testid="documents-table-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 flex-1" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </div>
          ) : documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Edition/Rev</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Reviewer / Approver</TableHead>
                  <TableHead className="font-semibold">Review Date</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} data-testid={`table-row-${doc.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`cell-code-${doc.id}`}>
                      {doc.documentCode}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" data-testid={`cell-title-${doc.id}`}>
                      {doc.title}
                    </TableCell>
                    <TableCell data-testid={`cell-category-${doc.id}`}>
                      <Badge className={categoryColors[doc.category] || ""} variant="secondary">
                        {doc.category.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`cell-edition-${doc.id}`}>
                      Ed.{doc.editionNumber || 1} Rev.{doc.revisionNumber || 0}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${doc.id}`}>
                      <Badge 
                        className={
                          doc.status === "draft" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" :
                          doc.status === "in_review" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                          doc.status === "pending_approval" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                          doc.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" :
                          doc.status === "obsolete" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                          "bg-muted text-muted-foreground"
                        } 
                        variant="secondary"
                      >
                        {doc.status === "in_review" ? "In Review" :
                         doc.status === "pending_approval" ? "Pending Approval" :
                         doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </Badge>
                      {(doc.lifecycleStatus === "under_revision" || doc.lifecycleStatus === "obsolete" || doc.lifecycleStatus === "quarantine") && (
                        <Badge
                          variant="outline"
                          className={`mt-1 block w-fit ${doc.lifecycleStatus === "quarantine" ? "text-red-700 border-red-300" : doc.lifecycleStatus === "obsolete" ? "text-slate-600 border-slate-300" : "text-blue-700 border-blue-300"}`}
                          data-testid={`badge-lifecycle-${doc.id}`}
                        >
                          {doc.lifecycleStatus === "under_revision" ? "Current · Under Revision" : doc.lifecycleStatus === "obsolete" ? "Obsolete" : "Quarantine"}
                        </Badge>
                      )}
                      {doc.hubStatus === DocumentHubStatus.PENDING_COO_APPROVAL && (
                        <Badge variant="outline" className="mt-1 block w-fit text-amber-700 border-amber-300" data-testid={`badge-awaiting-coo-${doc.id}`}>
                          Awaiting COO final approval
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`cell-assignees-${doc.id}`}>
                      {(doc.status === "in_review" || doc.status === "pending_approval" || doc.status === "approved") ? (
                        <div className="flex flex-col gap-1 text-xs">
                          {doc.reviewerId && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Review:</span>
                              <span className={
                                doc.status === "pending_approval" || doc.status === "approved" 
                                  ? "text-emerald-600 dark:text-emerald-400 font-medium" 
                                  : "text-amber-600 dark:text-amber-400 font-medium"
                              }>
                                {users.find((u: any) => u.id === doc.reviewerId)?.name || "Unknown"}
                              </span>
                            </div>
                          )}
                          {doc.approverId && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Approve:</span>
                              <span className={
                                doc.status === "approved" 
                                  ? "text-emerald-600 dark:text-emerald-400 font-medium" 
                                  : "text-amber-600 dark:text-amber-400 font-medium"
                              }>
                                {users.find((u: any) => u.id === doc.approverId)?.name || "Unknown"}
                              </span>
                            </div>
                          )}
                          {!doc.reviewerId && !doc.approverId && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`cell-review-${doc.id}`}>
                      {doc.nextReviewDate 
                        ? format(new Date(doc.nextReviewDate), "MMM d, yyyy")
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-right" data-testid={`cell-actions-${doc.id}`}>
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openViewDialog(doc)}
                          data-testid={`button-view-${doc.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        
                        {doc.status === "draft" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/documents/${doc.id}/edit`)}
                              data-testid={`button-edit-${doc.id}`}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openSubmitReviewDialog(doc)}
                              data-testid={`button-submit-review-${doc.id}`}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Submit
                            </Button>
                          </>
                        )}
                        
                        {(doc.status === "in_review" || doc.status === "pending_approval") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPdf(doc)}
                            data-testid={`button-pdf-${doc.id}`}
                          >
                            <FileDown className="w-4 h-4 mr-1" />
                            PDF
                          </Button>
                        )}
                        
                        {(doc.isLocked || doc.status === "approved") && (
                          <>
                            {(hasAccessToDocument(doc) || doc.createdById === currentUser?.id || doc.reviewerId === currentUser?.id || doc.approverId === currentUser?.id) ? (
                              <>
                                {doc.finalPdfUrl ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewPdf(doc)}
                                    data-testid={`button-view-pdf-${doc.id}`}
                                  >
                                    <FileDown className="w-4 h-4 mr-1" />
                                    PDF
                                  </Button>
                                ) : (doc as Document & DownloadState).viewerCanDownload === false && (doc as Document & DownloadState).pdfAvailable && (
                                  myDownloadRequest(doc.id)?.status === 'pending' ? (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700" data-testid={`badge-download-pending-${doc.id}`}>
                                      <Clock className="w-3 h-3 mr-1" />
                                      Download Pending
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => { setDownloadReason(""); setDownloadRequestDoc(doc); }}
                                      title={myDownloadRequest(doc.id)?.status === 'rejected' ? 'Your last download request was rejected' : undefined}
                                      data-testid={`button-request-download-${doc.id}`}
                                    >
                                      <FileDown className="w-4 h-4 mr-1" />
                                      Request download
                                    </Button>
                                  )
                                )}
                                {doc.isLocked && doc.hubStatus === "stored" && !doc.activeChangeRequestId &&
                                  !["under_revision", "obsolete", "quarantine"].includes(doc.lifecycleStatus || "") && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-orange-300 text-orange-700 dark:text-orange-300"
                                    onClick={() => navigate(`/documents/${doc.id}/edit?mode=change-request`)}
                                    data-testid={`button-change-request-${doc.id}`}
                                  >
                                    Change Request
                                  </Button>
                                )}
                              </>
                            ) : hasPendingAccessRequest(doc.id) ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700" data-testid={`badge-pending-access-${doc.id}`}>
                                <Clock className="w-3 h-3 mr-1" />
                                Access Pending
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRequestAccess(doc)}
                                disabled={requestAccessMutation.isPending}
                                data-testid={`button-request-access-${doc.id}`}
                              >
                                <Lock className="w-4 h-4 mr-1" />
                                Request Access
                              </Button>
                            )}
                          </>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-more-${doc.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {doc.finalPdfUrl ? (
                              <DropdownMenuItem onClick={() => handleViewPdf(doc)}>
                                <FileDown className="w-4 h-4 mr-2" /> View Final Draft
                              </DropdownMenuItem>
                            ) : (doc as Document & DownloadState).viewerCanDownload === false ? null : (
                              <DropdownMenuItem onClick={() => handleGeneratePdf(doc)}>
                                <FileDown className="w-4 h-4 mr-2" /> Generate PDF
                              </DropdownMenuItem>
                            )}
                            {((doc.status === "in_review" && doc.reviewerId === currentUser?.id) ||
                              (doc.status === "pending_approval" && doc.approverId === currentUser?.id)) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => navigate(`/documents/${doc.id}/edit`)}
                                  data-testid={`button-comment-return-${doc.id}`}
                                >
                                  <MessageSquare className="w-4 h-4 mr-2" /> Comment / Return
                                </DropdownMenuItem>
                              </>
                            )}
                            {(doc.status === "in_review" || doc.status === "pending_approval") && isAdminOrQM && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openReassignDialog(doc)} data-testid={`button-reassign-${doc.id}`}>
                                  <UserCog className="w-4 h-4 mr-2" /> Re-assign Task
                                </DropdownMenuItem>
                              </>
                            )}
                            {/* COO gives final approval, classification and storage in the Document Hub */}
                            {isCOO && doc.status === DocumentStatus.APPROVED && doc.hubStatus === DocumentHubStatus.PENDING_COO_APPROVAL && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => navigate("/document-hub")} 
                                  className="text-amber-600"
                                  data-testid={`button-final-approve-${doc.id}`}
                                >
                                  <Shield className="w-4 h-4 mr-2" /> Final Approval in Hub
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDeleteDialog(doc)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No documents found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Document Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-create-document">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>Add a new document to the Document Control System</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="documentCode">Document Code</Label>
                <Input
                  id="documentCode"
                  placeholder="e.g., SOP-001"
                  value={formData.documentCode}
                  onChange={(e) => setFormData({ ...formData, documentCode: e.target.value })}
                  data-testid="input-document-code"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="policy" data-testid="option-create-policy">Policy</SelectItem>
                    <SelectItem value="manual" data-testid="option-create-manual">Manual</SelectItem>
                    <SelectItem value="sop" data-testid="option-create-sop">SOP</SelectItem>
                    <SelectItem value="format" data-testid="option-create-format">Format</SelectItem>
                    <SelectItem value="job_description" data-testid="option-create-job_description">Job Description</SelectItem>
                    <SelectItem value="training_assessment" data-testid="option-create-training">Trainings and Assessment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Document title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-description"
              />
            </div>
            <div>
              <Label htmlFor="content">Content</Label>
              <div data-testid="input-content">
                <TiptapEditor
                  content={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                  onPreview={() => setShowPreviewDialog(true)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="nextReviewDate">Next Review Date</Label>
              <Input
                id="nextReviewDate"
                type="date"
                value={formData.nextReviewDate}
                onChange={(e) => setFormData({ ...formData, nextReviewDate: e.target.value })}
                data-testid="input-next-review-date"
              />
            </div>
          </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">Cancel</Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending || !formData.documentCode || !formData.title}
              data-testid="button-submit-create"
            >
              {createMutation.isPending ? "Creating..." : "Create Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0" data-testid="dialog-edit-document">
          <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update document details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-4" style={{ maxHeight: 'calc(90vh - 160px)' }}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-edit-title"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-content">Content</Label>
              <div data-testid="input-edit-content">
                <TiptapEditor
                  content={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                  onPreview={() => setShowPreviewDialog(true)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-nextReviewDate">Next Review Date</Label>
              <Input
                id="edit-nextReviewDate"
                type="date"
                value={formData.nextReviewDate}
                onChange={(e) => setFormData({ ...formData, nextReviewDate: e.target.value })}
                data-testid="input-edit-next-review-date"
              />
            </div>
            
            {/* Re-assign Section - Only for documents in review or pending approval */}
            {selectedDocument && (selectedDocument.status === "in_review" || selectedDocument.status === "pending_approval") && isAdminOrQM && (
              <div className="pt-4 border-t space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  Re-assign Task
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-reviewer">Reviewer</Label>
                    <Select 
                      value={selectedDocument.reviewerId?.toString() || ""} 
                      onValueChange={(v) => setSelectedDocument(prev => prev ? {...prev, reviewerId: v === "none" ? null : parseInt(v)} : null)}
                    >
                      <SelectTrigger id="edit-reviewer" data-testid="select-edit-reviewer">
                        <SelectValue placeholder="Choose reviewer..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {users.filter((u: any) => ['quality_manager', 'department_head', 'admin'].includes(u.role)).map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-approver">Approver</Label>
                    <Select 
                      value={selectedDocument.approverId?.toString() || ""} 
                      onValueChange={(v) => setSelectedDocument(prev => prev ? {...prev, approverId: v === "none" ? null : parseInt(v)} : null)}
                    >
                      <SelectTrigger id="edit-approver" data-testid="select-edit-approver">
                        <SelectValue placeholder="Choose approver..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {users.filter((u: any) => ['quality_manager', 'admin'].includes(u.role) || u.email === 'ceo@sahihcertify.com').map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name} {user.email === 'ceo@sahihcertify.com' ? '(CEO)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">Cancel</Button>
            <Button 
              onClick={handleEdit} 
              disabled={updateMutation.isPending}
              data-testid="button-submit-edit"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDocument?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Viewer Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]" data-testid="dialog-view-document">
          {selectedDocument && (
            <>
              {/* Document Header with Company Logo */}
              <div className="border-b pb-4 mb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <img 
                      src={sahihLogoPath} 
                      alt="Sahih Certifications" 
                      className="h-16 object-contain"
                      data-testid="img-company-logo"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge className={categoryColors[selectedDocument.category] || ""} variant="secondary">
                          {selectedDocument.category.toUpperCase()}
                        </Badge>
                        <Badge className={statusColors[selectedDocument.status] || "bg-muted text-slate-700"} variant="secondary">
                          {selectedDocument.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant="outline">Ed.{selectedDocument.editionNumber || 1} Rev.{selectedDocument.revisionNumber || 0}</Badge>
                        {(selectedDocument.isLocked || selectedDocument.status === 'approved') && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-foreground dark:text-slate-100" data-testid="text-view-title">
                        {selectedDocument.title}
                      </h2>
                      <p className="text-sm text-muted-foreground font-mono" data-testid="text-view-code">
                        {selectedDocument.documentCode}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setShowViewDialog(false)} data-testid="button-close-viewer">
                    Close
                  </Button>
                </div>
                {selectedDocument.description && (
                  <p className="text-muted-foreground dark:text-muted-foreground/60 mt-3" data-testid="text-view-description">
                    {selectedDocument.description}
                  </p>
                )}
              </div>
              
              {/* Access Control for Locked/Approved Documents */}
              {(selectedDocument.isLocked || selectedDocument.status === 'approved') && !hasAccessToDocument(selectedDocument) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4" data-testid="access-restricted-message">
                  <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
                    <p className="text-muted-foreground max-w-md">
                      This document has been approved and locked. You need COO approval to view its contents.
                    </p>
                  </div>
                  {hasPendingAccessRequest(selectedDocument.id) ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-sm py-2 px-4">
                      <Clock className="w-4 h-4 mr-2" />
                      Access Request Pending
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => handleRequestAccess(selectedDocument)}
                      disabled={requestAccessMutation.isPending}
                      data-testid="button-request-access-dialog"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Request Access
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-4 p-3 bg-muted rounded-md dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground/60" />
                      <div>
                        <div className="text-muted-foreground text-xs">Created</div>
                        <div className="font-medium">
                          {selectedDocument.createdAt 
                            ? format(new Date(selectedDocument.createdAt), "MMM d, yyyy")
                            : "-"
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground/60" />
                      <div>
                        <div className="text-muted-foreground text-xs">Next Review</div>
                        <div className="font-medium">
                          {selectedDocument.nextReviewDate 
                            ? format(new Date(selectedDocument.nextReviewDate), "MMM d, yyyy")
                            : "-"
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground/60" />
                      <div>
                        <div className="text-muted-foreground text-xs">Edition/Revision</div>
                        <div className="font-medium">Ed.{selectedDocument.editionNumber || 1} Rev.{selectedDocument.revisionNumber || 0}</div>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />
                  
                  <ScrollArea className="h-[60vh] pr-4">
                    <div 
                      className="prose prose-slate max-w-none dark:prose-invert document-content pb-10"
                      style={{ fontFamily: 'Roboto, sans-serif' }}
                      data-testid="text-view-content"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(selectedDocument.content || '<p class="text-muted-foreground/60 italic">No content available</p>') 
                      }}
                    />
                  </ScrollArea>

                  {/* Action Buttons - hide edit for locked documents */}
                  {!selectedDocument.isLocked && selectedDocument.status !== 'approved' && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex flex-wrap items-center justify-end gap-3" data-testid="view-dialog-actions">
                        <Button 
                          variant="outline"
                          onClick={() => navigate(`/documents/${selectedDocument.id}/edit`)}
                          data-testid="button-view-edit"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog - Full Width for Better Viewing */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh]" data-testid="dialog-preview-document">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Document Preview
            </DialogTitle>
            <DialogDescription>Full preview of how your document will appear when printed or exported</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 h-[calc(95vh-140px)]">
            <div 
              className="bg-white mx-auto shadow-lg"
              style={{
                width: '100%',
                maxWidth: '210mm',
                minHeight: '297mm',
                border: '2px solid black',
                padding: '15mm',
                fontFamily: 'Roboto, sans-serif',
              }}
              data-testid="preview-document-content"
            >
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-black">
                <img 
                  src={sahihLogoPath} 
                  alt="Sahih Certifications" 
                  className="h-16 object-contain"
                />
                <div className="text-right">
                  <div className="font-bold text-lg">{formData.title || 'Untitled Document'}</div>
                  <div className="text-sm text-gray-600">{formData.documentCode || 'No Code'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Edition: 1 | Revision: 0
                  </div>
                </div>
              </div>
              
              <div 
                className="prose prose-base max-w-none document-content"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(formData.content || '<p class="text-gray-400 italic">No content to preview</p>') 
                }}
              />
              <style>{`
                .document-content {
                  box-sizing: border-box;
                  overflow-x: hidden;
                }
                .document-content table {
                  width: 100% !important;
                  max-width: 100% !important;
                  border-collapse: collapse;
                  margin: 1rem 0;
                  font-size: 11px;
                  table-layout: auto;
                  box-sizing: border-box;
                  overflow-wrap: break-word;
                  word-break: break-word;
                }
                .document-content th,
                .document-content td {
                  border: 1px solid #333;
                  padding: 6px 8px;
                  text-align: left;
                  vertical-align: top;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                  max-width: 150px;
                  hyphens: auto;
                }
                .document-content th {
                  background-color: #f0f0f0;
                  font-weight: 600;
                  font-size: 10px;
                  text-transform: uppercase;
                }
                .document-content tr:nth-child(even) {
                  background-color: #fafafa;
                }
                .document-content h1, .document-content h2, .document-content h3, .document-content h4 {
                  color: #000;
                  margin-top: 1.5rem;
                  margin-bottom: 0.5rem;
                }
                .document-content p {
                  color: #000;
                  margin: 0.5rem 0;
                  text-align: justify;
                }
                .document-content ul, .document-content ol {
                  margin: 0.5rem 0;
                  padding-left: 1.5rem;
                }
                .document-content li {
                  color: #000;
                }
              `}</style>
            </div>
          </ScrollArea>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)} data-testid="button-close-preview">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF View/Generate Dialog */}
      <Dialog open={showPdfDialog} onOpenChange={(open) => {
        setShowPdfDialog(open);
        if (!open) {
          setPdfUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]" data-testid="dialog-pdf-document">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5" />
              {selectedDocument?.title || 'Document'} - PDF
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.documentCode} | Ed.{selectedDocument?.editionNumber || 1} Rev.{selectedDocument?.revisionNumber || 0}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-[500px]">
            {isGeneratingPdf ? (
              <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="pdf-generating">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Generating PDF... This may take a moment.</p>
              </div>
            ) : pdfUrl ? (
              <iframe 
                src={pdfUrl} 
                className="w-full h-[500px] border rounded-md"
                title="Document PDF"
                data-testid="pdf-viewer"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="pdf-not-available">
                <FileDown className="w-12 h-12 text-slate-300" />
                <p className="text-muted-foreground">No PDF available. Click Generate to create one.</p>
                <Button onClick={() => selectedDocument && handleGeneratePdf(selectedDocument)} data-testid="button-generate-pdf">
                  Generate PDF
                </Button>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPdfDialog(false)} data-testid="button-close-pdf">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Download Dialog */}
      <Dialog open={!!downloadRequestDoc} onOpenChange={(open) => { if (!open) setDownloadRequestDoc(null); }}>
        <DialogContent data-testid="dialog-request-download">
          <DialogHeader>
            <DialogTitle>Request download</DialogTitle>
            <DialogDescription>
              {downloadRequestDoc?.documentCode} - {downloadRequestDoc?.title}. Downloading this controlled document's PDF needs approval from an admin or the Quality Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="download-reason">Reason</Label>
            <Textarea
              id="download-reason"
              value={downloadReason}
              onChange={(e) => setDownloadReason(e.target.value)}
              placeholder="Why do you need a copy of this document?"
              data-testid="input-download-reason"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDownloadRequestDoc(null)}>Cancel</Button>
            <Button
              onClick={() => downloadRequestDoc && requestDownloadMutation.mutate({ documentId: downloadRequestDoc.id, reason: downloadReason.trim() })}
              disabled={!downloadReason.trim() || requestDownloadMutation.isPending}
              data-testid="button-submit-download-request"
            >
              {requestDownloadMutation.isPending ? "Submitting..." : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for Review Dialog */}
      <Dialog open={showSubmitReviewDialog} onOpenChange={setShowSubmitReviewDialog}>
        <DialogContent data-testid="dialog-submit-review">
          <DialogHeader>
            <DialogTitle>Submit for Review</DialogTitle>
            <DialogDescription>
              Select a reviewer for this document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reviewer">Reviewer *</Label>
              <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                <SelectTrigger id="reviewer" data-testid="select-reviewer">
                  <SelectValue placeholder="Choose a reviewer..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approver">Approver (optional)</Label>
              <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                <SelectTrigger id="approver" data-testid="select-approver">
                  <SelectValue placeholder="Choose an approver..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                If selected, this user will see the approval task in their dashboard
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Comments (optional)</Label>
              <Textarea
                id="comment"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add any notes for the reviewer..."
                data-testid="input-review-comment"
              />
            </div>
            <TargetDateField
              id="review-target"
              label="Review due by"
              value={reviewTarget}
              onChange={setReviewTarget}
              defaultDays={TARGET_DAYS.review}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitReviewDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitForReview}
              disabled={!selectedReviewerId || !reviewTarget || submitForReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {submitForReviewMutation.isPending ? "Submitting..." : "Submit for Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-assign Task Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent data-testid="dialog-reassign-task">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Re-assign Task
            </DialogTitle>
            <DialogDescription>
              Change the reviewer or approver for: {selectedDocument?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reassign-reviewer">Reviewer</Label>
              <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                <SelectTrigger id="reassign-reviewer" data-testid="select-reassign-reviewer">
                  <SelectValue placeholder="Choose a reviewer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {users.filter((u: any) => ['quality_manager', 'department_head', 'admin'].includes(u.role)).map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.role.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reassign-approver">Approver</Label>
              <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                <SelectTrigger id="reassign-approver" data-testid="select-reassign-approver">
                  <SelectValue placeholder="Choose an approver..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {users.filter((u: any) => ['quality_manager', 'admin'].includes(u.role) || u.email === 'ceo@sahihcertify.com').map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.email === 'ceo@sahihcertify.com' ? 'CEO' : user.role.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TargetDateField
              id="reassign-target"
              label="New person must finish by"
              value={reassignTarget}
              onChange={setReassignTarget}
              defaultDays={selectedDocument?.status === "pending_approval" ? TARGET_DAYS.approve : TARGET_DAYS.review}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReassign}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {updateMutation.isPending ? "Saving..." : "Re-assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
