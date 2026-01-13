import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useCreateDocument } from "@/hooks/use-documents";
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
import { ArrowLeft, FileText, Save, Eye, Send, Users, Building, Maximize2, Minimize2 } from "lucide-react";
import DOMPurify from "dompurify";
import sahihLogoPath from "@assets/sahih_logo-1.png";

export default function NewDocument() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateDocument();
  const { data: users = [] } = useUsers();
  const { data: employees = [] } = useEmployees();
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showReviewerDialog, setShowReviewerDialog] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [formData, setFormData] = useState({
    documentCode: "",
    title: "",
    description: "",
    category: "sop" as string,
    content: "",
    nextReviewDate: "",
  });

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
      });
      toast({ title: "Document saved as draft" });
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
      await createMutation.mutateAsync({
        documentCode: formData.documentCode,
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category as "policy" | "manual" | "sop" | "format",
        content: formData.content || undefined,
        nextReviewDate: formData.nextReviewDate || undefined,
        reviewerId: parseInt(selectedReviewerId),
        status: "in_review",
        assignedStaffIds: selectedStaffIds.length > 0 ? selectedStaffIds : undefined,
        assignedDepartments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Document Content</CardTitle>
                <CardDescription>Write the document content using the rich text editor</CardDescription>
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline"
              onClick={handleCreateAsDraft} 
              disabled={createMutation.isPending || !formData.documentCode || !formData.title}
              data-testid="button-save"
            >
              <Save className="w-4 h-4 mr-2" />
              {createMutation.isPending ? "Saving..." : "Save as Draft"}
            </Button>
            <Button 
              onClick={handleSubmitForReviewClick} 
              disabled={createMutation.isPending || !formData.documentCode || !formData.title}
              data-testid="button-submit-review"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for Review
            </Button>
          </div>

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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewerDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteReviewerSelection}
              disabled={!selectedReviewerId || createMutation.isPending}
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
