import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useCreateDocument, useSubmitDocumentForReview } from "@/hooks/use-documents";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TargetDateField, TARGET_DAYS, defaultTargetInput, targetToIso } from "@/components/TargetDateField";
import { useUsers } from "@/hooks/use-users";
import { useEmployees } from "@/hooks/use-employees";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import TiptapEditor from "@/components/TiptapEditor";
import { WordUploadPanel, AssociatedProceduresPicker, isGoogleFileUrl, googleFileKind, errorMessage, type UploadedFile } from "@/components/DocumentSources";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, Save, Eye, Send, Users, Building, Maximize2, Minimize2, Keyboard, HardDrive, Link2, Upload, ExternalLink } from "lucide-react";
import DOMPurify from "dompurify";
import sahihLogoPath from "@assets/sahih_logo-1.png";

export default function NewDocument() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateDocument();
  const submitForReviewMutation = useSubmitDocumentForReview();
  const { data: currentUser } = useAuth();
  // Who prepares the document, and by when (default 2 days)
  const [preparerId, setPreparerId] = useState<string>("");
  const [prepareTarget, setPrepareTarget] = useState(defaultTargetInput(TARGET_DAYS.prepare));
  const [reviewTarget, setReviewTarget] = useState(defaultTargetInput(TARGET_DAYS.review));
  const effectivePreparerId = preparerId ? parseInt(preparerId) : currentUser?.id;
  const preparedByMe = effectivePreparerId === currentUser?.id;
  const { data: users = [] } = useUsers();
  const { data: employees = [] } = useEmployees();
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showReviewerDialog, setShowReviewerDialog] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // How the document is added: a linked Google file (register details only), an uploaded Word file, or typed / pasted
  const [source, setSource] = useState<"google_link" | "upload" | "manual">("manual");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<number[]>([]);
  const [registering, setRegistering] = useState(false);
  // Audit details for a document kept in Google
  const [linkForm, setLinkForm] = useState({
    url: "",
    editionNumber: "1",
    revisionNumber: "0",
    issueDate: new Date().toISOString().slice(0, 10),
    preparedById: "",
    reviewedById: "",
    approvedById: "",
  });

  const [formData, setFormData] = useState({
    documentCode: "",
    title: "",
    description: "",
    category: "sop" as string,
    content: "",
    nextReviewDate: "",
  });

  const isLink = source === "google_link";
  const linkReady = isGoogleFileUrl(linkForm.url) && !!formData.documentCode && !!formData.title &&
    linkForm.editionNumber !== "" && linkForm.revisionNumber !== "" && !!linkForm.issueDate && !!linkForm.preparedById && !!linkForm.approvedById;

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department));
    return Array.from(depts).sort();
  }, [employees]);

  const toggleStaff = (staffId: number) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev => 
      prev.includes(dept) 
        ? prev.filter(d => d !== dept)
        : [...prev, dept]
    );
  };

  const handleUploaded = (file: UploadedFile) => {
    setUploadedFile(file);
    setFormData(prev => ({ ...prev, content: file.html, title: prev.title || file.title }));
  };

  // Where the document came from and the procedures it refers to, sent with either create action
  const sourceFields = () => ({
    linkedDocumentIds: linkedDocumentIds.length > 0 ? linkedDocumentIds : undefined,
    sourceType: source === "upload" && uploadedFile ? "upload" : "manual",
    sourceFileName: source === "upload" && uploadedFile ? uploadedFile.fileName : undefined,
  });

  // A Google file: register its details; it goes straight to the COO for final approval
  const handleRegisterLink = async () => {
    setRegistering(true);
    try {
      await apiRequest("POST", "/api/documents/register-link", {
        documentCode: formData.documentCode,
        title: formData.title,
        category: formData.category,
        description: formData.description || undefined,
        nextReviewDate: formData.nextReviewDate || undefined,
        url: linkForm.url.trim(),
        editionNumber: parseInt(linkForm.editionNumber),
        revisionNumber: parseInt(linkForm.revisionNumber),
        issueDate: linkForm.issueDate,
        preparedById: parseInt(linkForm.preparedById),
        reviewedById: linkForm.reviewedById ? parseInt(linkForm.reviewedById) : null,
        approvedById: parseInt(linkForm.approvedById),
        linkedDocumentIds: linkedDocumentIds.length > 0 ? linkedDocumentIds : undefined,
        assignedStaffIds: selectedStaffIds.length > 0 ? selectedStaffIds : undefined,
        assignedDepartments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
      });
      queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/documents") });
      toast({ title: "Document registered", description: "It is now with the COO for final approval in the Document Hub." });
      navigate("/documents");
    } catch (error) {
      toast({ title: "Could not register the document", description: errorMessage(error), variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const handleCreateAsDraft = async () => {
    try {
      await createMutation.mutateAsync({
        documentCode: formData.documentCode,
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category as "policy" | "manual" | "sop" | "format",
        content: formData.content || undefined,
        nextReviewDate: formData.nextReviewDate || undefined,
        status: "draft",
        assignedStaffIds: selectedStaffIds.length > 0 ? selectedStaffIds : undefined,
        assignedDepartments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
        preparedById: effectivePreparerId,
        prepareTargetDate: targetToIso(prepareTarget),
        ...sourceFields(),
      } as any);
      toast({
        title: preparedByMe ? "Document saved as draft" : "Document assigned to the preparer",
        description: `Preparation due by ${prepareTarget}.`,
      });
      navigate("/documents");
    } catch (error: any) {
      toast({ title: "Error creating document", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmitForReviewClick = () => {
    setSelectedReviewerId("");
    setShowReviewerDialog(true);
  };

  const handleCompleteReviewerSelection = async () => {
    if (!selectedReviewerId) {
      toast({ title: "Please select a reviewer", variant: "destructive" });
      return;
    }
    setShowReviewerDialog(false);
    try {
      // Created as a draft prepared by me, then sent through the normal review step so the reviewer gets a target date
      const doc: any = await createMutation.mutateAsync({
        documentCode: formData.documentCode,
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category as "policy" | "manual" | "sop" | "format",
        content: formData.content || undefined,
        nextReviewDate: formData.nextReviewDate || undefined,
        status: "draft",
        assignedStaffIds: selectedStaffIds.length > 0 ? selectedStaffIds : undefined,
        assignedDepartments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
        preparedById: currentUser?.id,
        prepareTargetDate: targetToIso(prepareTarget),
        ...sourceFields(),
      } as any);
      await apiRequest('POST', `/api/documents/${doc.id}/confirm-preparation`, {});
      await submitForReviewMutation.mutateAsync({
        id: doc.id,
        reviewerId: parseInt(selectedReviewerId),
        reviewTargetDate: targetToIso(reviewTarget),
      });
      toast({ title: "Document submitted for review" });
      navigate("/documents");
    } catch (error: any) {
      toast({ title: "Error submitting for review", description: error.message, variant: "destructive" });
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
        <Button variant="outline" onClick={() => navigate("/documents")} data-testid="button-cancel">
          Cancel
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>How do you want to add this document?</CardTitle>
              <CardDescription>Link a file kept in Google, open a Word file in the editor, or type / paste the content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup">
                {([
                  { value: "google_link", icon: HardDrive, title: "Link a Google file", text: "Docs, Sheets or any Drive file stays in Google. Enter its register details only." },
                  { value: "upload", icon: Upload, title: "Upload a Word file", text: "The .docx opens in the editor here, then goes through review and approval." },
                  { value: "manual", icon: Keyboard, title: "Type or paste", text: "Write or paste the content into the editor." },
                ] as const).map(option => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={source === option.value}
                    onClick={() => setSource(option.value)}
                    className={`text-left rounded-lg border p-4 transition-colors ${source === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}
                    data-testid={`source-${option.value}`}
                  >
                    <div className="font-medium flex items-center gap-2"><option.icon className="h-4 w-4" /> {option.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">{option.text}</p>
                  </button>
                ))}
              </div>
              {source === "upload" && <WordUploadPanel uploaded={uploadedFile} onUploaded={handleUploaded} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
              <CardDescription>Basic information about the document</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="documentCode">Doc Ref No. *</Label>
                  <Input
                    id="documentCode"
                    placeholder="e.g., SOP-001"
                    value={formData.documentCode}
                    onChange={(e) => setFormData({ ...formData, documentCode: e.target.value })}
                    data-testid="input-document-code"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Document Type</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="policy">Policy</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="sop">SOP</SelectItem>
                      <SelectItem value="format">Format</SelectItem>
                      <SelectItem value="job_description">Job Description</SelectItem>
                      <SelectItem value="training_assessment">Trainings and Assessment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="title">Document Name *</Label>
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

          {isLink && (
          <Card data-testid="card-google-register">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="w-5 h-5" /> Google File &amp; Register Details</CardTitle>
              <CardDescription>
                The document stays in Google. These details go into the Document Master List for audit, and the COO gives final approval in the Document Hub.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="google-url">Google file link *</Label>
                <div className="flex gap-2">
                  <Input
                    id="google-url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={linkForm.url}
                    onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                    data-testid="input-google-url"
                  />
                  <Button variant="outline" asChild disabled={!isGoogleFileUrl(linkForm.url)}>
                    <a href={isGoogleFileUrl(linkForm.url) ? linkForm.url.trim() : undefined} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" /> Open</a>
                  </Button>
                </div>
                <p className="text-xs mt-1 text-muted-foreground">
                  {linkForm.url && !isGoogleFileUrl(linkForm.url)
                    ? <span className="text-destructive">Paste a link starting with https://docs.google.com/ or https://drive.google.com/</span>
                    : linkForm.url ? `${googleFileKind(linkForm.url)}. Make sure the people who need it have access in Google.` : "Docs, Sheets, Slides or any file in Drive."}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edition">Edition *</Label>
                  <Input id="edition" type="number" min={0} value={linkForm.editionNumber} onChange={(e) => setLinkForm({ ...linkForm, editionNumber: e.target.value })} data-testid="input-edition" />
                </div>
                <div>
                  <Label htmlFor="revision">Revision *</Label>
                  <Input id="revision" type="number" min={0} value={linkForm.revisionNumber} onChange={(e) => setLinkForm({ ...linkForm, revisionNumber: e.target.value })} data-testid="input-revision" />
                </div>
                <div>
                  <Label htmlFor="issue-date">Issue date *</Label>
                  <Input id="issue-date" type="date" value={linkForm.issueDate} onChange={(e) => setLinkForm({ ...linkForm, issueDate: e.target.value })} data-testid="input-issue-date" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  ["preparedById", "Prepared by *"],
                  ["reviewedById", "Reviewed by"],
                  ["approvedById", "Approved by *"],
                ] as const).map(([field, label]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <Select value={linkForm[field]} onValueChange={(v) => setLinkForm({ ...linkForm, [field]: v === "none" ? "" : v })}>
                      <SelectTrigger data-testid={`select-${field}`}><SelectValue placeholder="Choose..." /></SelectTrigger>
                      <SelectContent>
                        {field === "reviewedById" && <SelectItem value="none">Not reviewed</SelectItem>}
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Associated Procedures
              </CardTitle>
              <CardDescription>
                Link the procedures this document refers to. When one of them is revised, this document is flagged
                and its owner gets a task to check it still fits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssociatedProceduresPicker value={linkedDocumentIds} onChange={setLinkedDocumentIds} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Assigned Staff
              </CardTitle>
              <CardDescription>Select employees who should have access to this document</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employees found. Add employees in the HR module first.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {employees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`staff-${employee.id}`}
                        checked={selectedStaffIds.includes(employee.id)}
                        onCheckedChange={() => toggleStaff(employee.id)}
                        data-testid={`checkbox-staff-${employee.id}`}
                      />
                      <label
                        htmlFor={`staff-${employee.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {employee.name}
                        <span className="text-muted-foreground ml-1">({employee.department})</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {selectedStaffIds.length > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  {selectedStaffIds.length} staff member(s) selected
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Assigned Departments
              </CardTitle>
              <CardDescription>Select departments that should have access to this document</CardDescription>
            </CardHeader>
            <CardContent>
              {uniqueDepartments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No departments found. Add employees with departments first.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {uniqueDepartments.map((dept) => (
                    <div key={dept} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dept-${dept}`}
                        checked={selectedDepartments.includes(dept)}
                        onCheckedChange={() => toggleDepartment(dept)}
                        data-testid={`checkbox-dept-${dept}`}
                      />
                      <label
                        htmlFor={`dept-${dept}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {dept}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {selectedDepartments.length > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  {selectedDepartments.length} department(s) selected
                </p>
              )}
            </CardContent>
          </Card>

          {!isLink && (<>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Document Content</CardTitle>
                <CardDescription>
                  {uploadedFile && source === "upload"
                    ? `Opened from ${uploadedFile.fileName}. Check and tidy the content before saving.`
                    : "Write the document content using the rich text editor"}
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
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preparation</CardTitle>
              <CardDescription>Who prepares this document and by when. The preparer gets it as a task.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="preparer">Prepared by *</Label>
                <Select value={preparerId || (currentUser ? String(currentUser.id) : "")} onValueChange={setPreparerId}>
                  <SelectTrigger id="preparer" data-testid="select-preparer">
                    <SelectValue placeholder="Choose the preparer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}{user.id === currentUser?.id ? " (me)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TargetDateField
                id="prepare-target"
                label="Preparation due by"
                value={prepareTarget}
                onChange={setPrepareTarget}
                defaultDays={TARGET_DAYS.prepare}
              />
            </CardContent>
          </Card>

          </>)}

          {isLink ? (
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button onClick={handleRegisterLink} disabled={!linkReady || registering} data-testid="button-register-link">
              <Send className="w-4 h-4 mr-2" />
              {registering ? "Registering..." : "Register & send to COO"}
            </Button>
          </div>
          ) : (
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline"
              onClick={handleCreateAsDraft} 
              disabled={createMutation.isPending || !formData.documentCode || !formData.title || !prepareTarget}
              data-testid="button-save"
            >
              <Save className="w-4 h-4 mr-2" />
              {createMutation.isPending ? "Saving..." : preparedByMe ? "Save as Draft" : "Assign to Preparer"}
            </Button>
            {preparedByMe && (
            <Button 
              onClick={handleSubmitForReviewClick} 
              disabled={createMutation.isPending || !formData.documentCode || !formData.title}
              data-testid="button-submit-review"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for Review
            </Button>
            )}
          </div>
          )}

          </div>
        </div>
      </div>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh] flex flex-col" data-testid="dialog-preview">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Document Preview - Full View</DialogTitle>
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
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-black">
                <img 
                  src={sahihLogoPath} 
                  alt="Sahih Certifications" 
                  className="h-16 object-contain"
                />
                <div className="text-right">
                  <div className="font-bold text-lg">{formData.title || "Untitled Document"}</div>
                  <div className="text-sm text-gray-600 font-mono">{formData.documentCode || "No Code"}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Edition: 1 | Revision: 0
                  </div>
                </div>
              </div>
              
              {formData.description && (
                <div className="mb-4 text-sm text-gray-600 italic border-l-4 border-gray-300 pl-3">
                  {formData.description}
                </div>
              )}
              
              <div 
                className="prose prose-base max-w-none document-content"
                style={{ color: '#000' }}
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
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReviewerDialog} onOpenChange={setShowReviewerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reviewer">Select Reviewer *</Label>
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
              <p className="text-sm text-muted-foreground">
                The reviewer will check and validate this document
              </p>
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
            <Button variant="outline" onClick={() => setShowReviewerDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteReviewerSelection}
              disabled={!selectedReviewerId || !reviewTarget || createMutation.isPending || submitForReviewMutation.isPending}
              data-testid="button-complete"
            >
              {createMutation.isPending ? "Submitting..." : "Submit for Review"}
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
