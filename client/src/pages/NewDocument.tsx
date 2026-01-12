import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateDocument } from "@/hooks/use-documents";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function NewDocument() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateDocument();
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const [formData, setFormData] = useState({
    documentCode: "",
    title: "",
    description: "",
    category: "sop" as string,
    content: "",
    nextReviewDate: "",
  });

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
      navigate("/documents");
    } catch (error: any) {
      toast({ title: "Error creating document", description: error.message, variant: "destructive" });
    }
  };

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
              Create New Document
            </h1>
            <p className="text-sm text-muted-foreground">Add a new document to the system</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/documents")} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={createMutation.isPending || !formData.documentCode || !formData.title}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {createMutation.isPending ? "Creating..." : "Create Document"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
              <CardDescription>Basic information about the document</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="documentCode">Document Code *</Label>
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
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="policy">Policy</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="sop">SOP</SelectItem>
                      <SelectItem value="format">Format</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                <CardDescription>Write the document content using the rich text editor</CardDescription>
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
                className="h-48 object-contain"
              />
              <div>
                <h2 className="text-xl font-bold">{formData.title || "Untitled Document"}</h2>
                <p className="text-sm text-muted-foreground font-mono">{formData.documentCode || "No code"}</p>
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
