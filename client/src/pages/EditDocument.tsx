import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useDocuments, useUpdateDocument } from "@/hooks/use-documents";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import TiptapEditor from "@/components/TiptapEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, Save, Eye, Maximize2, Minimize2 } from "lucide-react";
import DOMPurify from "dompurify";
import sahihLogoPath from "@assets/sahih_logo-1.png";

export default function EditDocument() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/documents/:id/edit");
  const documentId = params?.id ? parseInt(params.id) : null;
  
  const { toast } = useToast();
  const { data: documents, isLoading } = useDocuments();
  const updateMutation = useUpdateDocument();
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const document = documents?.find(d => d.id === documentId);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    nextReviewDate: "",
  });

  useEffect(() => {
    if (document && !initialized) {
      setFormData({
        title: document.title || "",
        description: document.description || "",
        content: document.content || "",
        nextReviewDate: document.nextReviewDate ? String(document.nextReviewDate).split('T')[0] : "",
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
                <Label htmlFor="nextReviewDate">Required date of review</Label>
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
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Document Content</CardTitle>
                <CardDescription>Edit the document content using the rich text editor</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPreviewDialog(true)} data-testid="button-preview">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsFullscreen(true)} 
                  data-testid="button-fullscreen"
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Expand Editor
                </Button>
              </div>
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

      {/* Full-Width Document Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh] flex flex-col" data-testid="dialog-preview">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Document Preview - Full View
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
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
            >
              {/* Document Header */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-black">
                <img 
                  src={sahihLogoPath} 
                  alt="Sahih Certifications" 
                  className="h-16 object-contain"
                />
                <div className="text-right">
                  <div className="font-bold text-lg">{formData.title || "Untitled Document"}</div>
                  <div className="text-sm text-gray-600 font-mono">{document.documentCode}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Edition: {document.editionNumber || 1} | Revision: {document.revisionNumber || 0}
                  </div>
                </div>
              </div>
              
              {formData.description && (
                <div className="mb-4 text-sm text-gray-600 italic border-l-4 border-gray-300 pl-3">
                  {formData.description}
                </div>
              )}
              
              {/* Document Content */}
              <div 
                className="prose prose-base max-w-none document-content"
                style={{
                  color: '#000',
                }}
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(formData.content || '<p class="text-gray-400 italic">No content yet</p>') 
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
          </div>
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)} data-testid="button-close-preview">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Document Content - {formData.title || "Untitled"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden" data-testid="fullscreen-editor">
            <TiptapEditor
              content={formData.content}
              onChange={(content) => setFormData({ ...formData, content })}
            />
          </div>
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="w-4 h-4 mr-2" />
              Close Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
