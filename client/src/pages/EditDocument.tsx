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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import TiptapEditor, { AISuggestion } from "@/components/TiptapEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, Save, Eye, Maximize2, Minimize2, Wand2, Loader2, Check, X, Lightbulb, ChevronRight } from "lucide-react";
import DOMPurify from "dompurify";
import sahihLogoPath from "@assets/sahih_logo-1.png";
import { apiRequest } from "@/lib/queryClient";

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
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>([]);
  const [isReviewingDocument, setIsReviewingDocument] = useState(false);

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

  const handleAIReview = async () => {
    if (!formData.content || formData.content.length < 50) {
      toast({
        title: "Not enough content",
        description: "Please add more content to the document before reviewing.",
        variant: "destructive",
      });
      return;
    }

    setIsReviewingDocument(true);
    setShowAISuggestions(true);
    setAISuggestions([]);

    try {
      const response = await apiRequest('/api/ai/review-document', {
        method: 'POST',
        body: JSON.stringify({
          content: formData.content,
          documentType: document?.category || 'General',
        }),
      });

      setAISuggestions(response.suggestions || []);
      
      if (response.suggestions?.length === 0) {
        toast({
          title: "No suggestions",
          description: "Your document looks great! No improvements needed.",
        });
      } else {
        toast({
          title: "Review complete",
          description: `Found ${response.suggestions?.length || 0} suggestions to improve your document.`,
        });
      }
    } catch (error) {
      toast({
        title: "Review failed",
        description: "Could not analyze the document. Please try again.",
        variant: "destructive",
      });
      setShowAISuggestions(false);
    } finally {
      setIsReviewingDocument(false);
    }
  };

  const applySuggestion = (suggestion: AISuggestion) => {
    const originalText = suggestion.original;
    const newText = suggestion.suggestion;
    
    if (!formData.content.includes(originalText)) {
      toast({
        title: "Cannot apply suggestion",
        description: "The original text was not found. The document may have changed since the review.",
        variant: "destructive",
      });
      return;
    }
    
    const escapedOriginal = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedOriginal, 'g');
    const newContent = formData.content.replace(regex, newText);
    
    setFormData({ ...formData, content: newContent });
    setAISuggestions(prev => prev.map(s => 
      s.id === suggestion.id ? { ...s, applied: true } : s
    ));
    toast({
      title: "Suggestion applied",
      description: "The text has been updated.",
    });
  };

  const dismissSuggestion = (suggestionId: string) => {
    setAISuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const canApplySuggestion = (suggestion: AISuggestion): boolean => {
    return !suggestion.applied && formData.content.includes(suggestion.original);
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
          <Button 
            variant="outline" 
            onClick={handleAIReview}
            disabled={isReviewingDocument}
            data-testid="button-ai-review"
          >
            {isReviewingDocument ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                AI Review
              </>
            )}
          </Button>
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

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-y-auto transition-all ${showAISuggestions ? 'pr-0' : ''}`}>
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

        {/* AI Suggestions Panel */}
        {showAISuggestions && (
          <div className="w-80 border-l bg-muted/30 flex flex-col flex-shrink-0" data-testid="panel-ai-suggestions">
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold">AI Suggestions</h3>
                {aiSuggestions.length > 0 && (
                  <Badge variant="secondary" data-testid="badge-suggestions-count">
                    {aiSuggestions.filter(s => !s.applied).length}
                  </Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowAISuggestions(false)}
                data-testid="button-close-suggestions"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {isReviewingDocument ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3" data-testid="status-reviewing">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Analyzing document...</p>
                  </div>
                ) : aiSuggestions.length === 0 ? (
                  <div className="text-center py-8" data-testid="status-no-suggestions">
                    <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Your document looks great!</p>
                    <p className="text-xs text-muted-foreground mt-1">No improvements needed.</p>
                  </div>
                ) : (
                  aiSuggestions.map((suggestion) => (
                    <Card 
                      key={suggestion.id} 
                      className={`${suggestion.applied ? 'opacity-50' : ''}`}
                      data-testid={`card-suggestion-${suggestion.id}`}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Original text:</p>
                          <p 
                            className="text-sm line-through text-red-600 dark:text-red-400"
                            data-testid={`text-original-${suggestion.id}`}
                          >
                            "{suggestion.original}"
                          </p>
                        </div>
                        <div className="flex items-center">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Suggested replacement:</p>
                          <p 
                            className="text-sm text-green-600 dark:text-green-400"
                            data-testid={`text-suggestion-${suggestion.id}`}
                          >
                            "{suggestion.suggestion}"
                          </p>
                        </div>
                        <div 
                          className="bg-muted/50 p-2 rounded text-xs text-muted-foreground"
                          data-testid={`text-reason-${suggestion.id}`}
                        >
                          <span className="font-medium">Reason: </span>{suggestion.reason}
                        </div>
                        {!suggestion.applied && canApplySuggestion(suggestion) && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => applySuggestion(suggestion)}
                              data-testid={`button-apply-suggestion-${suggestion.id}`}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Apply
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => dismissSuggestion(suggestion.id)}
                              data-testid={`button-dismiss-suggestion-${suggestion.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        {!suggestion.applied && !canApplySuggestion(suggestion) && (
                          <Badge variant="outline" className="w-full justify-center text-muted-foreground">
                            Text no longer in document
                          </Badge>
                        )}
                        {suggestion.applied && (
                          <Badge variant="secondary" className="w-full justify-center" data-testid={`badge-applied-${suggestion.id}`}>
                            <Check className="w-3 h-3 mr-1" />
                            Applied
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
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
