import { useState } from "react";
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useSubmitForReview, useApproveDocument, useRejectDocument } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import Editor from "react-simple-wysiwyg";
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
import { Plus, MoreHorizontal, Pencil, Trash2, Send, CheckCircle, XCircle, AlertCircle, Eye, FileText, Calendar, User, Clock, PenTool } from "lucide-react";
import { format } from "date-fns";
import type { Document } from "@shared/schema";
import sahihLogoPath from "@assets/sahih_logo-1.png";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  obsolete: "bg-red-100 text-red-700",
};

const categoryColors: Record<string, string> = {
  policy: "bg-purple-100 text-purple-700",
  manual: "bg-indigo-100 text-indigo-700",
  sop: "bg-teal-100 text-teal-700",
  format: "bg-orange-100 text-orange-700",
};

export default function Documents() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  
  const filters = {
    status: statusFilter !== "all" ? statusFilter : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  };
  
  const { data: documents, isLoading, isError } = useDocuments(filters);
  const { data: users } = useUsers();
  const { toast } = useToast();
  
  const createMutation = useCreateDocument();
  const updateMutation = useUpdateDocument();
  const deleteMutation = useDeleteDocument();
  const submitForReviewMutation = useSubmitForReview();
  const approveMutation = useApproveDocument();
  const rejectMutation = useRejectDocument();
  
  const [formData, setFormData] = useState({
    documentCode: "",
    title: "",
    description: "",
    category: "sop" as string,
    content: "",
    nextReviewDate: "",
    requiresPreparedBy: true,
    requiresReviewedBy: true,
    requiresApprovedBy: true,
  });
  const [reviewerId, setReviewerId] = useState<string>("");
  const [reviewComments, setReviewComments] = useState("");
  const [rejectComments, setRejectComments] = useState("");
  
  const resetForm = () => {
    setFormData({
      documentCode: "",
      title: "",
      description: "",
      category: "sop",
      content: "",
      nextReviewDate: "",
      requiresPreparedBy: true,
      requiresReviewedBy: true,
      requiresApprovedBy: true,
    });
    setReviewerId("");
    setReviewComments("");
    setRejectComments("");
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
        requiresPreparedBy: formData.requiresPreparedBy,
        requiresReviewedBy: formData.requiresReviewedBy,
        requiresApprovedBy: formData.requiresApprovedBy,
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
          requiresPreparedBy: formData.requiresPreparedBy,
          requiresReviewedBy: formData.requiresReviewedBy,
          requiresApprovedBy: formData.requiresApprovedBy,
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
  
  const handleSubmitForReview = async () => {
    if (!selectedDocument || !reviewerId) return;
    try {
      await submitForReviewMutation.mutateAsync({
        id: selectedDocument.id,
        data: { reviewerId: parseInt(reviewerId), comments: reviewComments },
      });
      toast({ title: "Document submitted for review" });
      setShowReviewDialog(false);
      setSelectedDocument(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error submitting for review", description: error.message, variant: "destructive" });
    }
  };
  
  const handleApprove = async (doc: Document) => {
    try {
      await approveMutation.mutateAsync({ id: doc.id, data: {} });
      toast({ title: "Document approved" });
    } catch (error: any) {
      toast({ title: "Error approving document", description: error.message, variant: "destructive" });
    }
  };
  
  const handleReject = async () => {
    if (!selectedDocument || !rejectComments) return;
    try {
      await rejectMutation.mutateAsync({
        id: selectedDocument.id,
        data: { comments: rejectComments },
      });
      toast({ title: "Document rejected and returned to draft" });
      setShowRejectDialog(false);
      setSelectedDocument(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error rejecting document", description: error.message, variant: "destructive" });
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
      requiresPreparedBy: doc.requiresPreparedBy ?? true,
      requiresReviewedBy: doc.requiresReviewedBy ?? true,
      requiresApprovedBy: doc.requiresApprovedBy ?? true,
    });
    setShowEditDialog(true);
  };
  
  const openReviewDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setShowReviewDialog(true);
  };
  
  const openRejectDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setShowRejectDialog(true);
  };
  
  const openDeleteDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setShowDeleteDialog(true);
  };
  
  const openViewDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setShowViewDialog(true);
  };
  
  const reviewers = users?.filter(u => 
    u.role === "department_head" || u.role === "quality_manager" || u.role === "admin"
  ) || [];

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
          <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Document Control</h1>
          <p className="text-slate-500" data-testid="text-page-description">Master List Matrix - ISO 17021 Compliant</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-document">
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
                  <SelectItem value="in_review" data-testid="option-status-in-review">In Review</SelectItem>
                  <SelectItem value="pending_approval" data-testid="option-status-pending">Pending Approval</SelectItem>
                  <SelectItem value="approved" data-testid="option-status-approved">Approved</SelectItem>
                  <SelectItem value="obsolete" data-testid="option-status-obsolete">Obsolete</SelectItem>
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
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card data-testid="card-documents-table">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Next Review</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : documents && documents.length > 0 ? (
                documents.map((doc) => (
                  <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                    <TableCell className="font-mono font-medium" data-testid={`text-code-${doc.id}`}>{doc.documentCode}</TableCell>
                    <TableCell data-testid={`text-title-${doc.id}`}>{doc.title}</TableCell>
                    <TableCell>
                      <Badge className={categoryColors[doc.category] || ""} variant="secondary" data-testid={`badge-category-${doc.id}`}>
                        {doc.category.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[doc.status] || ""} variant="secondary" data-testid={`badge-status-${doc.id}`}>
                        {doc.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-version-${doc.id}`}>{doc.versionNumber}</TableCell>
                    <TableCell data-testid={`text-review-date-${doc.id}`}>
                      {doc.nextReviewDate 
                        ? format(new Date(doc.nextReviewDate), "MMM d, yyyy")
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${doc.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewDialog(doc)} data-testid={`menu-view-${doc.id}`}>
                            <Eye className="w-4 h-4 mr-2" /> View Document
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(doc)} data-testid={`menu-edit-${doc.id}`}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          
                          {doc.status === "draft" && (
                            <DropdownMenuItem onClick={() => openReviewDialog(doc)} data-testid={`menu-submit-${doc.id}`}>
                              <Send className="w-4 h-4 mr-2" /> Submit for Review
                            </DropdownMenuItem>
                          )}
                          
                          {(doc.status === "in_review" || doc.status === "pending_approval") && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprove(doc)} data-testid={`menu-approve-${doc.id}`}>
                                <CheckCircle className="w-4 h-4 mr-2" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRejectDialog(doc)} data-testid={`menu-reject-${doc.id}`}>
                                <XCircle className="w-4 h-4 mr-2" /> Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => openDeleteDialog(doc)}
                            className="text-red-600"
                            data-testid={`menu-delete-${doc.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500" data-testid="text-no-documents">
                    No documents found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Document Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl" data-testid="dialog-create-document">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>Add a new document to the Document Control System</DialogDescription>
          </DialogHeader>
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
              <div className="border rounded-md min-h-[200px]" data-testid="input-content">
                <Editor
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  containerProps={{ style: { minHeight: '200px' } }}
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
            <Separator />
            <div>
              <Label className="text-base font-medium">Signature Requirements</Label>
              <p className="text-sm text-muted-foreground mb-3">Select which signatures are required for this document</p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="requiresPreparedBy"
                    checked={formData.requiresPreparedBy}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresPreparedBy: !!checked })}
                    data-testid="checkbox-requires-prepared-by"
                  />
                  <Label htmlFor="requiresPreparedBy" className="font-normal cursor-pointer">
                    Prepared By - Document author signature
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="requiresReviewedBy"
                    checked={formData.requiresReviewedBy}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresReviewedBy: !!checked })}
                    data-testid="checkbox-requires-reviewed-by"
                  />
                  <Label htmlFor="requiresReviewedBy" className="font-normal cursor-pointer">
                    Reviewed By - Department head review signature
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="requiresApprovedBy"
                    checked={formData.requiresApprovedBy}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresApprovedBy: !!checked })}
                    data-testid="checkbox-requires-approved-by"
                  />
                  <Label htmlFor="requiresApprovedBy" className="font-normal cursor-pointer">
                    Approved By - Quality manager approval signature
                  </Label>
                </div>
              </div>
            </div>
          </div>
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
        <DialogContent className="max-w-3xl" data-testid="dialog-edit-document">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update document details</DialogDescription>
          </DialogHeader>
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
              <div className="border rounded-md min-h-[200px]" data-testid="input-edit-content">
                <Editor
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  containerProps={{ style: { minHeight: '200px' } }}
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
            <Separator />
            <div>
              <Label className="text-base font-medium">Signature Requirements</Label>
              <p className="text-sm text-muted-foreground mb-3">Select which signatures are required for this document</p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="edit-requiresPreparedBy"
                    checked={formData.requiresPreparedBy}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresPreparedBy: !!checked })}
                    data-testid="checkbox-edit-requires-prepared-by"
                  />
                  <Label htmlFor="edit-requiresPreparedBy" className="font-normal cursor-pointer">
                    Prepared By - Document author signature
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="edit-requiresReviewedBy"
                    checked={formData.requiresReviewedBy}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresReviewedBy: !!checked })}
                    data-testid="checkbox-edit-requires-reviewed-by"
                  />
                  <Label htmlFor="edit-requiresReviewedBy" className="font-normal cursor-pointer">
                    Reviewed By - Department head review signature
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="edit-requiresApprovedBy"
                    checked={formData.requiresApprovedBy}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresApprovedBy: !!checked })}
                    data-testid="checkbox-edit-requires-approved-by"
                  />
                  <Label htmlFor="edit-requiresApprovedBy" className="font-normal cursor-pointer">
                    Approved By - Quality manager approval signature
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
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

      {/* Submit for Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent data-testid="dialog-submit-review">
          <DialogHeader>
            <DialogTitle>Submit for Review</DialogTitle>
            <DialogDescription>Select a reviewer for this document</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reviewer">Reviewer</Label>
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger id="reviewer" data-testid="select-reviewer">
                  <SelectValue placeholder="Select reviewer" />
                </SelectTrigger>
                <SelectContent>
                  {reviewers.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)} data-testid={`option-reviewer-${user.id}`}>
                      {user.name} ({user.role.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="review-comments">Comments (optional)</Label>
              <Textarea
                id="review-comments"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Add any notes for the reviewer..."
                data-testid="input-review-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)} data-testid="button-cancel-review">Cancel</Button>
            <Button 
              onClick={handleSubmitForReview} 
              disabled={!reviewerId || submitForReviewMutation.isPending}
              data-testid="button-submit-for-review"
            >
              {submitForReviewMutation.isPending ? "Submitting..." : "Submit for Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>Provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-comments">Rejection Reason (required)</Label>
              <Textarea
                id="reject-comments"
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Explain why this document is being rejected..."
                data-testid="input-reject-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} data-testid="button-cancel-reject">Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleReject} 
              disabled={!rejectComments || rejectMutation.isPending}
              data-testid="button-submit-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Document"}
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
                        <Badge className={statusColors[selectedDocument.status] || ""} variant="secondary">
                          {selectedDocument.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant="outline">v{selectedDocument.versionNumber}</Badge>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100" data-testid="text-view-title">
                        {selectedDocument.title}
                      </h2>
                      <p className="text-sm text-slate-500 font-mono" data-testid="text-view-code">
                        {selectedDocument.documentCode}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setShowViewDialog(false)} data-testid="button-close-viewer">
                    Close
                  </Button>
                </div>
                {selectedDocument.description && (
                  <p className="text-slate-600 dark:text-slate-400 mt-3" data-testid="text-view-description">
                    {selectedDocument.description}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4 p-3 bg-slate-50 rounded-md dark:bg-slate-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-500 text-xs">Created</div>
                    <div className="font-medium">
                      {selectedDocument.createdAt 
                        ? format(new Date(selectedDocument.createdAt), "MMM d, yyyy")
                        : "-"
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-500 text-xs">Next Review</div>
                    <div className="font-medium">
                      {selectedDocument.nextReviewDate 
                        ? format(new Date(selectedDocument.nextReviewDate), "MMM d, yyyy")
                        : "-"
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-500 text-xs">Version</div>
                    <div className="font-medium">{selectedDocument.versionNumber}</div>
                  </div>
                </div>
                {selectedDocument.approvedBySignedAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="text-slate-500 text-xs">Approved</div>
                      <div className="font-medium">
                        {format(new Date(selectedDocument.approvedBySignedAt), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-4" />
              
              <ScrollArea className="h-[350px] pr-4">
                <div 
                  className="prose prose-slate max-w-none dark:prose-invert"
                  data-testid="text-view-content"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(selectedDocument.content || '<p class="text-slate-400 italic">No content available</p>') 
                  }}
                />
              </ScrollArea>

              {/* Signature Block */}
              <Separator className="my-4" />
              <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-4" data-testid="section-signatures">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Document Signatures
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {selectedDocument.requiresPreparedBy && (
                    <div className="border rounded-md p-3 bg-white dark:bg-slate-900" data-testid="signature-block-prepared">
                      <div className="text-xs text-slate-500 mb-1">Prepared By</div>
                      <div className="h-12 flex items-center justify-center border-b border-dashed mb-2">
                        {selectedDocument.preparedById && users?.find(u => u.id === selectedDocument.preparedById)?.signatureDataUrl ? (
                          <img 
                            src={users.find(u => u.id === selectedDocument.preparedById)?.signatureDataUrl || ''} 
                            alt="Signature" 
                            className="max-h-10 object-contain"
                            data-testid="img-signature-prepared"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic">Pending signature</span>
                        )}
                      </div>
                      <div className="text-sm font-medium">
                        {selectedDocument.preparedById 
                          ? users?.find(u => u.id === selectedDocument.preparedById)?.name || 'Unknown'
                          : '---'}
                      </div>
                      {selectedDocument.preparedBySignedAt && (
                        <div className="text-xs text-slate-500">
                          {format(new Date(selectedDocument.preparedBySignedAt), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {selectedDocument.requiresReviewedBy && (
                    <div className="border rounded-md p-3 bg-white dark:bg-slate-900" data-testid="signature-block-reviewed">
                      <div className="text-xs text-slate-500 mb-1">Reviewed By</div>
                      <div className="h-12 flex items-center justify-center border-b border-dashed mb-2">
                        {selectedDocument.reviewedById && users?.find(u => u.id === selectedDocument.reviewedById)?.signatureDataUrl ? (
                          <img 
                            src={users.find(u => u.id === selectedDocument.reviewedById)?.signatureDataUrl || ''} 
                            alt="Signature" 
                            className="max-h-10 object-contain"
                            data-testid="img-signature-reviewed"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic">Pending signature</span>
                        )}
                      </div>
                      <div className="text-sm font-medium">
                        {selectedDocument.reviewedById 
                          ? users?.find(u => u.id === selectedDocument.reviewedById)?.name || 'Unknown'
                          : '---'}
                      </div>
                      {selectedDocument.reviewedBySignedAt && (
                        <div className="text-xs text-slate-500">
                          {format(new Date(selectedDocument.reviewedBySignedAt), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {selectedDocument.requiresApprovedBy && (
                    <div className="border rounded-md p-3 bg-white dark:bg-slate-900" data-testid="signature-block-approved">
                      <div className="text-xs text-slate-500 mb-1">Approved By</div>
                      <div className="h-12 flex items-center justify-center border-b border-dashed mb-2">
                        {selectedDocument.approvedById && users?.find(u => u.id === selectedDocument.approvedById)?.signatureDataUrl ? (
                          <img 
                            src={users.find(u => u.id === selectedDocument.approvedById)?.signatureDataUrl || ''} 
                            alt="Signature" 
                            className="max-h-10 object-contain"
                            data-testid="img-signature-approved"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic">Pending signature</span>
                        )}
                      </div>
                      <div className="text-sm font-medium">
                        {selectedDocument.approvedById 
                          ? users?.find(u => u.id === selectedDocument.approvedById)?.name || 'Unknown'
                          : '---'}
                      </div>
                      {selectedDocument.approvedBySignedAt && (
                        <div className="text-xs text-slate-500">
                          {format(new Date(selectedDocument.approvedBySignedAt), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
