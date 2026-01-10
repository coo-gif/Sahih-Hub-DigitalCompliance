import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useDocuments, useUpdateDocument } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import TiptapEditor from "@/components/TiptapEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, Save, Eye } from "lucide-react";
import DOMPurify from "dompurify";
import sahihLogoPath from "@assets/sahih_logo-1.png";

export default function EditDocument() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/documents/:id/edit");
  const documentId = params?.id ? parseInt(params.id) : null;
  
  const { toast } = useToast();
  const { data: users } = useUsers();
  const { data: documents, isLoading } = useDocuments();
  const updateMutation = useUpdateDocument();
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const document = documents?.find(d => d.id === documentId);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    nextReviewDate: "",
    requiresPreparedBy: true,
    requiresReviewedBy: true,
    requiresApprovedBy: true,
    preparedById: "",
    reviewedById: "",
    approvedById: "",
  });

  const activeUsers = users?.filter(u => u.isActive) || [];

  useEffect(() => {
    if (document && !initialized) {
      setFormData({
        title: document.title || "",
        description: document.description || "",
        content: document.content || "",
        nextReviewDate: document.nextReviewDate ? String(document.nextReviewDate).split('T')[0] : "",
        requiresPreparedBy: document.requiresPreparedBy ?? true,
        requiresReviewedBy: document.requiresReviewedBy ?? true,
        requiresApprovedBy: document.requiresApprovedBy ?? true,
        preparedById: document.preparedById ? String(document.preparedById) : "",
        reviewedById: document.reviewedById ? String(document.reviewedById) : "",
        approvedById: document.approvedById ? String(document.approvedById) : "",
      });
      setInitialized(true);
    }
  }, [document, initialized]);

  const handleUpdate = async () => {
    if (!documentId) return;
    try {
      await updateMutation.mutateAsync({
        id: documentId,
        data: {
          title: formData.title,
          description: formData.description,
          content: formData.content,
          nextReviewDate: formData.nextReviewDate || undefined,
          requiresPreparedBy: formData.requiresPreparedBy,
          requiresReviewedBy: formData.requiresReviewedBy,
          requiresApprovedBy: formData.requiresApprovedBy,
          preparedById: formData.preparedById ? parseInt(formData.preparedById) : undefined,
          reviewedById: formData.reviewedById ? parseInt(formData.reviewedById) : undefined,
          approvedById: formData.approvedById ? parseInt(formData.approvedById) : undefined,
        },
      });
      toast({ title: "Document updated successfully" });
      navigate("/documents");
    } catch (error: any) {
      toast({ title: "Error updating document", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Document not found</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/documents")}>
              Back to Documents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-background border-b px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Edit Document
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{document.documentCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/documents")} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={updateMutation.isPending || !formData.title}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Details</CardTitle>
                <CardDescription>Update document information</CardDescription>
              </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
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
                  placeholder="Brief description of the document"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="input-description"
                />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Document Content</CardTitle>
                <CardDescription>Edit the document content using the rich text editor</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPreviewDialog(true)} data-testid="button-preview">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </CardHeader>
            <CardContent>
              <div className="min-h-[400px]" data-testid="input-content">
                <TiptapEditor
                  content={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signature Requirements</CardTitle>
              <CardDescription>Select which signatures are required for this document</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              
              <Separator />
              
              <div>
                <Label className="text-base font-medium">Signatory Selection</Label>
                <p className="text-sm text-muted-foreground mb-3">Assign users for each signature role</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {formData.requiresPreparedBy && (
                    <div>
                      <Label htmlFor="preparedById">Prepared By</Label>
                      <Select value={formData.preparedById} onValueChange={(v) => setFormData({ ...formData, preparedById: v })}>
                        <SelectTrigger id="preparedById" data-testid="select-prepared-by">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={String(user.id)}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {formData.requiresReviewedBy && (
                    <div>
                      <Label htmlFor="reviewedById">Reviewed By</Label>
                      <Select value={formData.reviewedById} onValueChange={(v) => setFormData({ ...formData, reviewedById: v })}>
                        <SelectTrigger id="reviewedById" data-testid="select-reviewed-by">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeUsers.map((user) => (
                            <SelectItem key={user.id} value={String(user.id)}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {formData.requiresApprovedBy && (
                    <div>
                      <Label htmlFor="approvedById">Approved By</Label>
                      <Select value={formData.approvedById} onValueChange={(v) => setFormData({ ...formData, approvedById: v })}>
                        <SelectTrigger id="approvedById" data-testid="select-approved-by">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeUsers.map((user) => (
                            <SelectItem key={user.id} value={String(user.id)}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          <div className="border-b pb-4 mb-4">
            <div className="flex items-start gap-4">
              <img 
                src={sahihLogoPath} 
                alt="Sahih Certifications" 
                className="h-16 object-contain"
              />
              <div>
                <h2 className="text-xl font-bold">{formData.title || "Untitled Document"}</h2>
                <p className="text-sm text-muted-foreground font-mono">{document.documentCode}</p>
                {formData.description && (
                  <p className="text-muted-foreground mt-2">{formData.description}</p>
                )}
              </div>
            </div>
          </div>
          <div 
            className="prose prose-slate max-w-none"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(formData.content || '<p class="text-muted-foreground italic">No content yet</p>') 
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
