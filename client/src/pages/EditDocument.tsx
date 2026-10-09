import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useDocuments, useUpdateDocument } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TiptapEditor, { AISuggestion, type CommentSelection } from "@/components/TiptapEditor";
import { CommentComposer, CommentsPanel, type DocComment } from "@/components/DocumentComments";
import { locateComment } from "@/lib/comment-highlights";
import { useAuth } from "@/hooks/use-auth";
import { TargetDateField, TARGET_DAYS, defaultTargetInput, targetToIso } from "@/components/TargetDateField";
import type { Editor } from "@tiptap/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, Save, Eye, Maximize2, Minimize2, Wand2, Loader2, Check, X, Lightbulb, ChevronRight, Plus, Minus, History, Trash2, MessageSquare, Undo2, Lock, FilePen, Send } from "lucide-react";
import DOMPurify from "dompurify";
import sahihLogoPath from "@assets/sahih_logo-1.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface RevisionHistoryEntry {
  id: number;
  documentId: number;
  revisionNumber: number;
  description: string;
  amendmentDate: string | null;
  reason: string | null;
  preparedById: number | null;
  reviewedById: number | null;
  approvedById: number | null;
  status: string;
  requestedById: number | null;
  createdAt: string;
}

export default function EditDocument() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/documents/:id/edit");
  const documentId = params?.id ? parseInt(params.id) : null;
  
  const { toast } = useToast();
  const { data: documents, isLoading } = useDocuments();
  const { data: users } = useUsers();
  const updateMutation = useUpdateDocument();
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>([]);
  const [isReviewingDocument, setIsReviewingDocument] = useState(false);
  const [showAddRevisionDialog, setShowAddRevisionDialog] = useState(false);
  const [newRevisionEntry, setNewRevisionEntry] = useState({
    description: "",
    reason: "",
    preparedById: "",
    reviewedById: "",
    approvedById: "",
    amendmentDate: format(new Date(), "yyyy-MM-dd"),
  });

  const document = documents?.find(d => d.id === documentId);
  const { data: currentUser } = useAuth();

  // ---- Inline comments ----
  const commentsKey = `/api/documents/${documentId}/comments`;
  const { data: comments = [] } = useQuery<DocComment[]>({
    queryKey: [commentsKey],
    enabled: !!documentId,
  });
  const openComments = comments.filter(c => c.status === "open");
  const [showComments, setShowComments] = useState(false);
  const [commentsAutoOpened, setCommentsAutoOpened] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [commentSelection, setCommentSelection] = useState<CommentSelection | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  useEffect(() => {
    if (!commentsAutoOpened && openComments.length > 0) {
      setShowComments(true);
      setCommentsAutoOpened(true);
    }
  }, [openComments.length, commentsAutoOpened]);

  // ---- Change request (on an approved, locked document) ----
  const [crMode, setCrMode] = useState(() => new URLSearchParams(window.location.search).get("mode") === "change-request");
  const [crSummary, setCrSummary] = useState("");
  const crDraftKey = `/api/documents/${documentId}/change-requests/mine`;
  const { data: crDraft } = useQuery<{ id: number; crNumber: string; points: Array<{ id: number }> } | null>({
    queryKey: [crDraftKey],
    enabled: !!documentId,
  });

  // Opening the document clears the reader's notifications about it (tags, assignments)
  useEffect(() => {
    if (!documentId) return;
    apiRequest("POST", `/api/documents/${documentId}/seen`, {})
      .then(() => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }))
      .catch(() => {});
  }, [documentId]);

  const invalidateComments = () => {
    queryClient.invalidateQueries({ queryKey: [commentsKey] });
    queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
  };

  const addCommentMutation = useMutation({
    mutationFn: async (data: { content: string; mentionedIds: number[]; assigneeIds: number[]; targetDate?: string; reasonCategory?: string; reasonOther?: string }) => {
      if (!commentSelection) throw new Error("No text selected");
      const anchor = { quotedText: commentSelection.text, anchorFrom: commentSelection.from, anchorTo: commentSelection.to };
      if (crMode) {
        const res = await apiRequest("POST", `/api/documents/${documentId}/change-requests/items`, {
          ...anchor, content: data.content, reasonCategory: data.reasonCategory, reasonOther: data.reasonOther,
        });
        const body = await res.json();
        return body.point as DocComment;
      }
      const res = await apiRequest("POST", commentsKey, {
        ...anchor,
        content: data.content,
        mentionedIds: data.mentionedIds,
        assigneeIds: data.assigneeIds,
        targetDate: data.targetDate,
      });
      return res.json() as Promise<DocComment>;
    },
    onSuccess: (comment) => {
      invalidateComments();
      queryClient.invalidateQueries({ queryKey: [crDraftKey] });
      setCommentSelection(null);
      setShowComments(true);
      setActiveCommentId(comment.id);
      const tagged = comment.mentionedIds?.length ?? 0;
      toast({
        title: comment.kind === "change_request" ? "Added to your change request" : "Comment added",
        description: comment.kind === "change_request"
          ? "Add more points, then submit it to the COO."
          : tagged > 0
            ? `${tagged} tagged ${tagged > 1 ? "people were" : "person was"} notified${comment.assigneeIds.length ? `; ${comment.assigneeIds.length} got a task` : ""}.`
            : undefined,
      });
    },
    onError: (error: any) => {
      toast({ title: "Could not add comment", description: error.message, variant: "destructive" });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/document-comments/${id}/resolve`, {}),
    onSuccess: () => invalidateComments(),
    onError: (error: any) => toast({ title: "Could not resolve comment", description: error.message, variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/document-comments/${id}`),
    onSuccess: () => invalidateComments(),
    onError: (error: any) => toast({ title: "Could not delete comment", description: error.message, variant: "destructive" }),
  });

  const selectComment = (comment: DocComment) => {
    setActiveCommentId(comment.id);
    if (!editorInstance || editorInstance.isDestroyed) return;
    const range = locateComment(editorInstance.state.doc, comment);
    if (!range) {
      toast({ title: "Text not found", description: "The commented text has been changed or removed since this comment was made." });
      return;
    }
    const { node } = editorInstance.view.domAtPos(range.from);
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // ---- Workflow: who may edit, comment or return ----
  const canEdit = !!document && !document.isLocked && document.status !== "approved";
  // Anyone who can open the document can comment; on a locked document comments are private notes and tags
  const canComment = !!document;
  const isWithdrawn = document?.lifecycleStatus === "obsolete" || document?.lifecycleStatus === "quarantine";
  const isUnderRevision = !!document && (document.lifecycleStatus === "under_revision" || !!document.activeChangeRequestId);
  const canRaiseChangeRequest = !!document && !!document.isLocked && document.hubStatus === "stored" && !isUnderRevision && !isWithdrawn;
  const submitCrMutation = useMutation({
    mutationFn: async () => {
      if (!crDraft) throw new Error("Add at least one point first");
      const res = await apiRequest("POST", `/api/change-requests/${crDraft.id}/submit`, { summary: crSummary || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [crDraftKey] });
      invalidateComments();
      setCrMode(false);
      setCrSummary("");
      toast({ title: `${crDraft?.crNumber} submitted to the COO`, description: "The approved version stays valid until the COO decides." });
    },
    onError: (error: any) => toast({ title: "Could not submit", description: error.message, variant: "destructive" }),
  });
  const discardCrMutation = useMutation({
    mutationFn: async () => { if (crDraft) await apiRequest("DELETE", `/api/change-requests/${crDraft.id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [crDraftKey] });
      invalidateComments();
      setCrMode(false);
      setCrSummary("");
    },
  });
  const userName = (id: number | null | undefined) => users?.find(u => u.id === id)?.name || "Unknown user";
  const returnTarget = (() => {
    if (!document || !currentUser) return null;
    if (document.status === "in_review" && document.reviewerId === currentUser.id) {
      return { role: "preparer", name: userName(document.preparedById ?? document.createdById) };
    }
    if (document.status === "pending_approval" && document.approverId === currentUser.id) {
      return { role: "reviewer", name: userName(document.reviewerId) };
    }
    if (document.status === "approved" && document.hubStatus === "pending_coo_approval" && currentUser.email === "coo@sahihcertify.com") {
      return { role: "approver", name: userName(document.approverId) };
    }
    return null;
  })();
  const myOpenComments = openComments.filter(c => c.authorId === currentUser?.id);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  // Revising after a return gets 2 days by default; a return to the reviewer or approver gets 1 day
  const returnDays = returnTarget?.role === "preparer" ? TARGET_DAYS.revise : TARGET_DAYS.review;
  const [returnTargetDate, setReturnTargetDate] = useState(defaultTargetInput(TARGET_DAYS.revise));
  useEffect(() => {
    setReturnTargetDate(defaultTargetInput(returnDays));
  }, [returnDays]);

  const returnMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/documents/${documentId}/return`, { note: returnNote || undefined, targetDate: targetToIso(returnTargetDate) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents?status=approved'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      setShowReturnDialog(false);
      setReturnNote("");
      toast({ title: "Document returned", description: `Sent back to the ${returnTarget?.role}, ${returnTarget?.name}.` });
      navigate("/documents");
    },
    onError: (error: any) => {
      toast({ title: "Could not return document", description: error.message, variant: "destructive" });
    },
  });

  const commentEditorProps = {
    editable: canEdit,
    comments: openComments,
    activeCommentId,
    onRequestComment: canComment ? (selection: CommentSelection) => setCommentSelection(selection) : undefined,
    onCommentClick: (id: number) => {
      setActiveCommentId(id);
      setShowComments(true);
    },
    onEditorReady: setEditorInstance,
    commentLabel: crMode ? "Add to Change Request" : "Comment",
  };

  // Fetch revision history for this document
  const { data: revisionHistory = [] } = useQuery<RevisionHistoryEntry[]>({
    queryKey: [`/api/documents/${documentId}/revision-history`],
    enabled: !!documentId,
  });

  // Add revision history entry mutation
  const addRevisionMutation = useMutation({
    mutationFn: async (entry: typeof newRevisionEntry) => {
      const response = await apiRequest('POST', `/api/documents/${documentId}/revision-history`, {
        description: entry.description,
        reason: entry.reason || null,
        preparedById: entry.preparedById ? parseInt(entry.preparedById) : null,
        reviewedById: entry.reviewedById ? parseInt(entry.reviewedById) : null,
        approvedById: entry.approvedById ? parseInt(entry.approvedById) : null,
        amendmentDate: entry.amendmentDate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}/revision-history`] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setShowAddRevisionDialog(false);
      setNewRevisionEntry({
        description: "",
        reason: "",
        preparedById: "",
        reviewedById: "",
        approvedById: "",
        amendmentDate: format(new Date(), "yyyy-MM-dd"),
      });
      toast({ title: "Amendment request added to revision history" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add revision entry", description: error.message, variant: "destructive" });
    }
  });

  // Delete revision history entry mutation
  const deleteRevisionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/revision-history/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}/revision-history`] });
      toast({ title: "Revision entry deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete entry", description: error.message, variant: "destructive" });
    }
  });

  // Approve revision history entry mutation
  const approveRevisionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PATCH', `/api/revision-history/${id}`, { status: 'approved' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}/revision-history`] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({ title: "Amendment approved", description: "Document revision number has been updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to approve", description: error.message, variant: "destructive" });
    }
  });

  // Reject revision history entry mutation
  const rejectRevisionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PATCH', `/api/revision-history/${id}`, { status: 'rejected' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}/revision-history`] });
      toast({ title: "Amendment rejected" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to reject", description: error.message, variant: "destructive" });
    }
  });

  const getUserName = (userId: number | null) => {
    if (!userId || !users) return "-";
    const user = users.find(u => u.id === userId);
    return user?.name || "-";
  };

  // Calculate current revision number from approved history entries only
  const approvedHistory = revisionHistory.filter(h => h.status === 'approved');
  const currentRevisionNumber = approvedHistory.length > 0 
    ? Math.max(...approvedHistory.map(h => h.revisionNumber))
    : (document?.revisionNumber || 0);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    nextReviewDate: "",
    editionNumber: 2,
    revisionNumber: 0,
  });

  useEffect(() => {
    if (document && !initialized) {
      setFormData({
        title: document.title || "",
        description: document.description || "",
        content: document.content || "",
        nextReviewDate: document.nextReviewDate ? String(document.nextReviewDate).split('T')[0] : "",
        editionNumber: document.editionNumber || 2,
        revisionNumber: document.revisionNumber || 0,
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
          editionNumber: formData.editionNumber,
          revisionNumber: formData.revisionNumber,
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
      const response = await apiRequest('POST', '/api/ai/review-document', {
        content: formData.content,
        documentType: document?.category || 'General',
      });
      const data = await response.json();

      setAISuggestions(data.suggestions || []);
      
      if (data.suggestions?.length === 0) {
        toast({
          title: "No suggestions",
          description: "Your document looks great! No improvements needed.",
        });
      } else {
        toast({
          title: "Review complete",
          description: `Found ${data.suggestions?.length || 0} suggestions to improve your document.`,
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
              {canEdit ? "Edit Document" : "View Document"}
              {!canEdit && (
                <Badge variant="secondary" className="gap-1" data-testid="badge-read-only">
                  <Lock className="w-3 h-3" />
                  Read-only
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{document.documentCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant={showComments ? "secondary" : "outline"}
            onClick={() => setShowComments(v => !v)}
            data-testid="button-toggle-comments"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Comments
            {openComments.length > 0 && <Badge className="ml-2" variant="destructive">{openComments.length}</Badge>}
          </Button>
          {canRaiseChangeRequest && !crMode && (
            <Button
              variant="outline"
              className="border-orange-400 text-orange-700 hover:bg-orange-50 dark:text-orange-300"
              onClick={() => { setCrMode(true); setShowComments(true); }}
              data-testid="button-raise-change-request"
            >
              <FilePen className="w-4 h-4 mr-2" />
              {crDraft ? `Continue ${crDraft.crNumber}` : "Change Request"}
            </Button>
          )}
          {returnTarget && (
            <Button
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300"
              onClick={() => setShowReturnDialog(true)}
              data-testid="button-return-document"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Return for Revision
            </Button>
          )}
          {canEdit && (
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
          )}
          <Button variant="outline" onClick={() => navigate("/documents")} data-testid="button-cancel">
            {canEdit ? "Cancel" : "Back"}
          </Button>
          {canEdit && (
          <Button 
            onClick={handleUpdate} 
            disabled={updateMutation.isPending || !formData.title}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-y-auto transition-all ${showAISuggestions ? 'pr-0' : ''}`}>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="grid gap-6">
            {crMode && canRaiseChangeRequest && (
              <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700 p-4 space-y-3" data-testid="banner-change-request">
                <div className="flex items-start gap-3">
                  <FilePen className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-orange-900 dark:text-orange-200">
                      Change request {crDraft ? crDraft.crNumber : "(new)"}: {crDraft?.points.length ?? 0} point{(crDraft?.points.length ?? 0) === 1 ? "" : "s"}
                    </p>
                    <p className="text-orange-800 dark:text-orange-300">
                      Highlight the text that should change, right-click and choose <strong>Add to Change Request</strong>, then give the reason.
                      The approved version stays valid until the COO accepts the change.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={crSummary}
                  onChange={(e) => setCrSummary(e.target.value)}
                  placeholder="Overall summary of the change (optional)"
                  rows={2}
                  data-testid="input-cr-summary"
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setCrMode(false)}>Close</Button>
                  {crDraft && (
                    <Button variant="outline" onClick={() => discardCrMutation.mutate()} disabled={discardCrMutation.isPending} data-testid="button-discard-cr">
                      Discard draft
                    </Button>
                  )}
                  <Button
                    onClick={() => submitCrMutation.mutate()}
                    disabled={!crDraft || crDraft.points.length === 0 || submitCrMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    data-testid="button-submit-cr"
                  >
                    {submitCrMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Submit to COO
                  </Button>
                </div>
              </div>
            )}
            {isUnderRevision && document.isLocked && (
              <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 p-4 text-sm text-blue-900 dark:text-blue-200" data-testid="banner-under-revision">
                <strong>Current, under revision.</strong> A change request was accepted. This approved version (Ed.{document.editionNumber} Rev.{document.revisionNumber}) stays in force until the new version is approved.
              </div>
            )}
            {document.returnedAt && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 flex gap-3" data-testid="banner-returned">
                <Undo2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    Returned for revision by {userName(document.returnedById)} on {format(new Date(document.returnedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  {document.returnNote && <p className="text-amber-800 dark:text-amber-200">"{document.returnNote}"</p>}
                  <p className="text-amber-700 dark:text-amber-300">
                    {openComments.length > 0
                      ? <>There {openComments.length === 1 ? "is 1 open comment" : `are ${openComments.length} open comments`} in the document. Highlighted text shows where changes are needed.</>
                      : <>All comments have been resolved.</>}
                  </p>
                </div>
              </div>
            )}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Edition Number</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFormData(prev => ({ ...prev, editionNumber: Math.max(1, prev.editionNumber - 1) }))}
                      disabled={formData.editionNumber <= 1}
                      data-testid="button-edition-minus"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Badge variant="outline" className="text-lg px-4 py-1 min-w-[70px] justify-center" data-testid="badge-edition-number">
                      Ed. {formData.editionNumber}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFormData(prev => ({ ...prev, editionNumber: prev.editionNumber + 1 }))}
                      data-testid="button-edition-plus"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Revision Number</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFormData(prev => ({ ...prev, revisionNumber: Math.max(0, prev.revisionNumber - 1) }))}
                      disabled={formData.revisionNumber <= 0}
                      data-testid="button-revision-minus"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Badge variant="outline" className="text-lg px-4 py-1 min-w-[70px] justify-center" data-testid="badge-revision-number">
                      Rev. {formData.revisionNumber}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFormData(prev => ({ ...prev, revisionNumber: prev.revisionNumber + 1 }))}
                      data-testid="button-revision-plus"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-increments on each amendment
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revision History Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Revision History
                </CardTitle>
                <CardDescription>Track all document amendments and change requests</CardDescription>
              </div>
              <Button 
                size="sm" 
                onClick={() => setShowAddRevisionDialog(true)}
                data-testid="button-add-revision"
              >
                <Plus className="w-4 h-4 mr-2" />
                Request Change
              </Button>
            </CardHeader>
            <CardContent>
              {revisionHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No revision history yet</p>
                  <p className="text-sm">Click "Request Change" to add an amendment request</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Rev.</TableHead>
                        <TableHead>Description of Amendment</TableHead>
                        <TableHead className="w-[110px]">Date</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="w-[120px]">Prepared By</TableHead>
                        <TableHead className="w-[120px]">Reviewed By</TableHead>
                        <TableHead className="w-[120px]">Approved By</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revisionHistory.map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-revision-${entry.id}`}>
                          <TableCell className="font-medium">
                            {entry.status === 'pending' ? '-' : entry.revisionNumber}
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell className="text-sm">
                            {entry.amendmentDate ? format(new Date(entry.amendmentDate), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell className="text-sm">{entry.reason || "-"}</TableCell>
                          <TableCell className="text-sm">{getUserName(entry.preparedById)}</TableCell>
                          <TableCell className="text-sm">{getUserName(entry.reviewedById)}</TableCell>
                          <TableCell className="text-sm">{getUserName(entry.approvedById)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={entry.status === 'approved' ? 'default' : entry.status === 'rejected' ? 'destructive' : 'secondary'}
                              data-testid={`badge-status-${entry.id}`}
                            >
                              {entry.status === 'approved' ? 'Approved' : entry.status === 'rejected' ? 'Rejected' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {entry.status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-600 hover:text-green-700"
                                    onClick={() => approveRevisionMutation.mutate(entry.id)}
                                    data-testid={`button-approve-revision-${entry.id}`}
                                    title="Approve"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-600 hover:text-red-700"
                                    onClick={() => rejectRevisionMutation.mutate(entry.id)}
                                    data-testid={`button-reject-revision-${entry.id}`}
                                    title="Reject"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteRevisionMutation.mutate(entry.id)}
                                data-testid={`button-delete-revision-${entry.id}`}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Document Content</CardTitle>
                <CardDescription>
                  {canEdit ? "Edit the document content using the rich text editor." : "This document is read-only."}
                  {canComment && " To comment, select text, right-click and choose Comment."}
                </CardDescription>
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
                  {...commentEditorProps}
                />
              </div>
            </CardContent>
          </Card>

          </div>
        </div>
        </div>

        {showComments && (
          <CommentsPanel
            comments={comments}
            users={users || []}
            currentUser={currentUser}
            activeCommentId={activeCommentId}
            onSelect={selectComment}
            onResolve={(c) => resolveCommentMutation.mutate(c.id)}
            onDelete={(c) => deleteCommentMutation.mutate(c.id)}
            onClose={() => setShowComments(false)}
            canComment={canComment}
          />
        )}

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
                    Edition: {formData.editionNumber || 1} | Revision: {currentRevisionNumber}
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
              {...commentEditorProps}
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

      <CommentComposer
        open={!!commentSelection}
        onOpenChange={(open) => { if (!open) setCommentSelection(null); }}
        quotedText={commentSelection?.text || ""}
        users={users || []}
        isPending={addCommentMutation.isPending}
        onSubmit={(data) => addCommentMutation.mutate(data)}
        mode={crMode ? "change_request" : "comment"}
        allowAssign={!document.isLocked}
      />

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-return-document">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-amber-600" />
              Return for Revision
            </DialogTitle>
            <DialogDescription>
              {document.documentCode} will go back to the {returnTarget?.role}, <strong>{returnTarget?.name}</strong>, with your comments.
            </DialogDescription>
          </DialogHeader>
          {myOpenComments.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200" data-testid="text-return-needs-comment">
              The reason for returning must be written in the document. Select the text that needs changing, right-click, choose <strong>Comment</strong>, and @mention who should fix it. Then return the document.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Your comments ({myOpenComments.length})</Label>
                <ScrollArea className="max-h-40 mt-2">
                  <ul className="space-y-2 pr-2">
                    {myOpenComments.map(c => (
                      <li key={c.id} className="text-sm border-l-2 border-amber-400 pl-2">
                        <span className="italic text-muted-foreground">"{c.quotedText.slice(0, 80)}{c.quotedText.length > 80 ? "…" : ""}"</span>
                        <br />
                        {c.content}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
              <div>
                <Label htmlFor="return-note" className="text-sm font-medium">Overall note (optional)</Label>
                <Textarea
                  id="return-note"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="e.g. Please address the comments and resubmit"
                  className="mt-2"
                  data-testid="input-return-note"
                />
              </div>
              <TargetDateField
                id="return-target"
                label={`${returnTarget?.name || "They"} must finish by`}
                value={returnTargetDate}
                onChange={setReturnTargetDate}
                defaultDays={returnDays}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => returnMutation.mutate()}
              disabled={myOpenComments.length === 0 || !returnTargetDate || returnMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-confirm-return"
            >
              {returnMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
              Return to {returnTarget?.role}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Revision History Entry Dialog */}
      <Dialog open={showAddRevisionDialog} onOpenChange={setShowAddRevisionDialog}>
        <DialogContent className="max-w-xl" data-testid="dialog-add-revision">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Request Document Amendment
            </DialogTitle>
            <DialogDescription>
              Add a new amendment request to the revision history. This will be tracked for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="revision-description">Description of Amendment *</Label>
              <Textarea
                id="revision-description"
                placeholder="Describe what changes were made..."
                value={newRevisionEntry.description}
                onChange={(e) => setNewRevisionEntry({ ...newRevisionEntry, description: e.target.value })}
                data-testid="input-revision-description"
              />
            </div>
            <div>
              <Label htmlFor="revision-date">Date of Amendment</Label>
              <Input
                id="revision-date"
                type="date"
                value={newRevisionEntry.amendmentDate}
                onChange={(e) => setNewRevisionEntry({ ...newRevisionEntry, amendmentDate: e.target.value })}
                data-testid="input-revision-date"
              />
            </div>
            <div>
              <Label htmlFor="revision-reason">Reason for Amendment</Label>
              <Textarea
                id="revision-reason"
                placeholder="Why was this change necessary?"
                value={newRevisionEntry.reason}
                onChange={(e) => setNewRevisionEntry({ ...newRevisionEntry, reason: e.target.value })}
                data-testid="input-revision-reason"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="prepared-by">Prepared By</Label>
                <Select
                  value={newRevisionEntry.preparedById}
                  onValueChange={(value) => setNewRevisionEntry({ ...newRevisionEntry, preparedById: value })}
                >
                  <SelectTrigger id="prepared-by" data-testid="select-prepared-by">
                    <SelectValue placeholder="Select..." />
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
              <div>
                <Label htmlFor="reviewed-by">Reviewed By</Label>
                <Select
                  value={newRevisionEntry.reviewedById}
                  onValueChange={(value) => setNewRevisionEntry({ ...newRevisionEntry, reviewedById: value })}
                >
                  <SelectTrigger id="reviewed-by" data-testid="select-reviewed-by">
                    <SelectValue placeholder="Select..." />
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
              <div>
                <Label htmlFor="approved-by">Approved By</Label>
                <Select
                  value={newRevisionEntry.approvedById}
                  onValueChange={(value) => setNewRevisionEntry({ ...newRevisionEntry, approvedById: value })}
                >
                  <SelectTrigger id="approved-by" data-testid="select-approved-by">
                    <SelectValue placeholder="Select..." />
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRevisionDialog(false)} data-testid="button-cancel-revision">
              Cancel
            </Button>
            <Button 
              onClick={() => addRevisionMutation.mutate(newRevisionEntry)}
              disabled={!newRevisionEntry.description || addRevisionMutation.isPending}
              data-testid="button-submit-revision"
            >
              {addRevisionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Amendment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
