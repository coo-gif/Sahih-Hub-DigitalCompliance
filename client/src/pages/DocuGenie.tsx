import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, FileText, Wand2, Eye, Copy, Send, Link2, ExternalLink, Sparkles, FileEdit, Inbox, Settings2 } from "lucide-react";
import { format } from "date-fns";
import type { DocuGenieForm, DocuGenieFormSubmission } from "@shared/schema";
import { insertDocuGenieFormSchema } from "@shared/schema";
import { sanitizeFormHtml } from "@/lib/sanitize-form-html";

const createFormSchema = insertDocuGenieFormSchema.pick({
  title: true,
  description: true,
  originalContent: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  originalContent: z.string().optional(),
});

type CreateFormData = z.infer<typeof createFormSchema>;

export default function DocuGenie() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<DocuGenieForm | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [editedHtml, setEditedHtml] = useState("");
  const [isSubmissionsOpen, setIsSubmissionsOpen] = useState(false);

  const form = useForm<CreateFormData>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      title: "",
      description: "",
      originalContent: "",
    },
  });

  const { data: forms = [], isLoading } = useQuery<DocuGenieForm[]>({
    queryKey: ["/api/docugenie/forms"],
  });

  const { data: submissions = [] } = useQuery<DocuGenieFormSubmission[]>({
    queryKey: ["/api/docugenie/forms", selectedForm?.id, "submissions"],
    enabled: !!selectedForm?.id && isSubmissionsOpen,
  });

  const createForm = useMutation({
    mutationFn: async (data: CreateFormData) => {
      return apiRequest("POST", "/api/docugenie/forms", data);
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/docugenie/forms"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Form created successfully" });
      const newForm = await response.json();
      setSelectedForm(newForm);
      setIsEditorOpen(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error creating form", description: error.message, variant: "destructive" });
    },
  });

  const updateForm = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<DocuGenieForm>) => {
      return apiRequest("PATCH", `/api/docugenie/forms/${id}`, data);
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/docugenie/forms"] });
      const updated = await response.json();
      setSelectedForm(updated);
      toast({ title: "Form updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating form", description: error.message, variant: "destructive" });
    },
  });

  const deleteForm = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/docugenie/forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docugenie/forms"] });
      setSelectedForm(null);
      setIsEditorOpen(false);
      toast({ title: "Form deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting form", description: error.message, variant: "destructive" });
    },
  });

  const publishForm = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/docugenie/forms/${id}/publish`, {});
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/docugenie/forms"] });
      const updated = await response.json();
      setSelectedForm(updated);
      toast({ 
        title: "Form published!", 
        description: "A shareable link has been generated." 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error publishing form", description: error.message, variant: "destructive" });
    },
  });

  const convertToForm = async () => {
    if (!selectedForm?.originalContent) {
      toast({ title: "No content to convert", variant: "destructive" });
      return;
    }
    
    setIsConverting(true);
    try {
      const response = await apiRequest("POST", "/api/docugenie/convert", {
        content: selectedForm.originalContent,
        title: selectedForm.title,
      });
      const data = await response.json();
      
      if (data.htmlForm) {
        setEditedHtml(data.htmlForm);
        await updateForm.mutateAsync({
          id: selectedForm.id,
          htmlForm: data.htmlForm,
          formFields: data.formFields,
        });
        toast({ title: "Content converted to form successfully!" });
      }
    } catch (error: any) {
      toast({ title: "Error converting content", description: error.message, variant: "destructive" });
    } finally {
      setIsConverting(false);
    }
  };

  const handleCreateSubmit = (data: CreateFormData) => {
    createForm.mutate(data);
  };

  const copyShareLink = () => {
    if (!selectedForm?.shareToken) return;
    const link = `${window.location.origin}/form/${selectedForm.shareToken}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" data-testid="badge-status-draft">Draft</Badge>;
      case "published":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-status-published">Published</Badge>;
      case "closed":
        return <Badge variant="destructive" data-testid="badge-status-closed">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="loading-spinner">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="docugenie-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-docugenie">
            <Sparkles className="h-6 w-6 text-primary" />
            DocuGenie
          </h1>
          <p className="text-muted-foreground">
            Convert documents and Google Forms into embeddable HTML forms
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-form">
              <Plus className="h-4 w-4 mr-2" />
              New Form
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl" data-testid="dialog-create-form">
            <DialogHeader>
              <DialogTitle>Create New Form</DialogTitle>
              <DialogDescription>
                Paste content from a Google Doc, Google Form, or any document to convert it into an embeddable HTML form.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Employee Onboarding Form" {...field} data-testid="input-form-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of the form" {...field} data-testid="input-form-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="originalContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paste Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Paste the content from your Google Doc, Form, or any document here..." 
                          className="min-h-[200px]"
                          {...field} 
                          data-testid="textarea-original-content"
                        />
                      </FormControl>
                      <FormDescription>
                        The AI will analyze this content and convert it into form fields.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createForm.isPending} data-testid="button-submit-create">
                    {createForm.isPending ? "Creating..." : "Create Form"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card data-testid="card-forms-list">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Forms
              </CardTitle>
              <CardDescription>{forms.length} form(s) created</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {forms.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground" data-testid="empty-forms-message">
                  No forms yet. Create your first form to get started.
                </div>
              ) : (
                <div className="divide-y">
                  {forms.map((f) => (
                    <div
                      key={f.id}
                      className={`p-4 cursor-pointer hover-elevate transition-colors ${selectedForm?.id === f.id ? "bg-accent" : ""}`}
                      onClick={() => {
                        setSelectedForm(f);
                        setEditedHtml(f.htmlForm || "");
                        setIsEditorOpen(true);
                      }}
                      data-testid={`form-item-${f.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-medium">{f.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {f.description || "No description"}
                          </p>
                        </div>
                        {getStatusBadge(f.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Created {format(new Date(f.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {isEditorOpen && selectedForm ? (
            <Card data-testid="card-form-editor">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileEdit className="h-5 w-5" />
                      {selectedForm.title}
                    </CardTitle>
                    <CardDescription>{selectedForm.description || "No description"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedForm.status === "published" && selectedForm.shareToken && (
                      <Button variant="outline" size="sm" onClick={copyShareLink} data-testid="button-copy-link">
                        <Link2 className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setIsSubmissionsOpen(true);
                      }}
                      data-testid="button-view-submissions"
                    >
                      <Inbox className="h-4 w-4 mr-2" />
                      Submissions
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteForm.mutate(selectedForm.id)}
                      disabled={deleteForm.isPending}
                      data-testid="button-delete-form"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="content" className="space-y-4">
                  <TabsList data-testid="tabs-form-editor">
                    <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
                    <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
                    <TabsTrigger value="html" data-testid="tab-html">HTML Code</TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Original Content</label>
                      <Textarea
                        value={selectedForm.originalContent || ""}
                        onChange={(e) => {
                          const updated = { ...selectedForm, originalContent: e.target.value };
                          setSelectedForm(updated);
                        }}
                        onBlur={() => {
                          if (selectedForm.originalContent) {
                            updateForm.mutate({ id: selectedForm.id, originalContent: selectedForm.originalContent });
                          }
                        }}
                        placeholder="Paste your document content here..."
                        className="min-h-[200px]"
                        data-testid="textarea-edit-content"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={convertToForm}
                        disabled={isConverting || !selectedForm.originalContent}
                        data-testid="button-convert-ai"
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        {isConverting ? "Converting..." : "Convert with AI"}
                      </Button>
                      {selectedForm.status === "draft" && selectedForm.htmlForm && (
                        <Button
                          onClick={() => publishForm.mutate(selectedForm.id)}
                          disabled={publishForm.isPending}
                          variant="default"
                          data-testid="button-publish-form"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {publishForm.isPending ? "Publishing..." : "Publish Form"}
                        </Button>
                      )}
                      {selectedForm.status === "published" && selectedForm.shareToken && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(`/form/${selectedForm.shareToken}`, "_blank")}
                          data-testid="button-open-form"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Form
                        </Button>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="border rounded-lg p-4 bg-white min-h-[300px]" data-testid="form-preview">
                      {selectedForm.htmlForm ? (
                        <div 
                          dangerouslySetInnerHTML={{ __html: sanitizeFormHtml(selectedForm.htmlForm) }} 
                          className="prose max-w-none"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                          <Eye className="h-12 w-12 mb-4 opacity-20" />
                          <p>No form generated yet. Add content and click "Convert with AI".</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="html" className="space-y-4">
                    <Textarea
                      value={editedHtml}
                      onChange={(e) => setEditedHtml(e.target.value)}
                      className="min-h-[300px] font-mono text-sm"
                      placeholder="HTML form code will appear here after conversion..."
                      data-testid="textarea-html-code"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(editedHtml);
                          toast({ title: "HTML copied to clipboard" });
                        }}
                        disabled={!editedHtml}
                        data-testid="button-copy-html"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy HTML
                      </Button>
                      <Button
                        onClick={() => {
                          updateForm.mutate({ id: selectedForm.id, htmlForm: editedHtml });
                        }}
                        disabled={updateForm.isPending}
                        data-testid="button-save-html"
                      >
                        {updateForm.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]" data-testid="card-empty-editor">
              <div className="text-center text-muted-foreground">
                <Settings2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a form to edit</p>
                <p className="text-sm">Or create a new form to get started</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isSubmissionsOpen} onOpenChange={setIsSubmissionsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-submissions">
          <DialogHeader>
            <DialogTitle>Form Submissions</DialogTitle>
            <DialogDescription>
              View all submissions for "{selectedForm?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {submissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-submissions-message">
                No submissions yet.
              </div>
            ) : (
              <Table data-testid="table-submissions">
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitter</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow key={sub.id} data-testid={`submission-row-${sub.id}`}>
                      <TableCell>{sub.submitterName || "Anonymous"}</TableCell>
                      <TableCell>{sub.submitterEmail || "-"}</TableCell>
                      <TableCell>{format(new Date(sub.submittedAt), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            try {
                              const data = JSON.parse(sub.formData);
                              toast({
                                title: "Form Data",
                                description: JSON.stringify(data, null, 2),
                              });
                            } catch {
                              toast({
                                title: "Form Data",
                                description: sub.formData,
                              });
                            }
                          }}
                          data-testid={`button-view-data-${sub.id}`}
                        >
                          View Data
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
