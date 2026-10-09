import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DOMPurify from "dompurify";
import { 
  FileText, 
  Lock, 
  Eye, 
  Users, 
  Check, 
  X, 
  Clock, 
  MoreHorizontal, 
  UserPlus, 
  UserMinus, 
  Shield,
  FileDown,
  Loader2,
  Search,
  ShieldCheck,
  Tag,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { DocumentHubStatus } from "@shared/schema";
import type { Document, User, DocumentAccessRequest, DocumentAccess } from "@shared/schema";

const COO_EMAIL = 'coo@sahihcertify.com';

const categoryColors: Record<string, string> = {
  policy: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  manual: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  sop: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  format: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  job_description: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const classificationOptions = [
  {
    value: "confidential",
    label: "Confidential",
    description: "Only the people you select can view it.",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  {
    value: "controlled_copy",
    label: "Controlled Copy",
    description: "Official copy under document control. Selected people only; downloads need approval.",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  {
    value: "public_information",
    label: "Public Information",
    description: "Every signed-in user can view it.",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    value: "legal",
    label: "Legal",
    description: "Legal record. Only the people you select can view it.",
    className: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  },
] as const;

function ClassificationBadge({ classification }: { classification: string | null }) {
  const option = classificationOptions.find(o => o.value === classification);
  if (!option) {
    return <span className="text-sm text-muted-foreground">Not classified</span>;
  }
  return <Badge className={option.className}>{option.label}</Badge>;
}

export default function DocumentHub() {
  const { data: currentUser } = useAuth();
  const { data: users = [] } = useUsers();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showGrantAccessDialog, setShowGrantAccessDialog] = useState(false);
  const [showAccessListDialog, setShowAccessListDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [showFinalApprovalDialog, setShowFinalApprovalDialog] = useState(false);
  const [showClassificationDialog, setShowClassificationDialog] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<string>("");
  
  const isCOO = currentUser?.email === COO_EMAIL;
  
  const { data: approvedDocuments = [], isLoading: isLoadingDocs } = useQuery<Document[]>({
    queryKey: ["/api/documents?status=approved"],
  });
  
  const { data: pendingRequests = [], isLoading: isLoadingRequests } = useQuery<DocumentAccessRequest[]>({
    queryKey: ["/api/document-access-requests?status=pending"],
    enabled: isCOO,
  });
  
  const { data: documentAccess = [] } = useQuery<DocumentAccess[]>({
    queryKey: ["/api/document-access"],
    enabled: isCOO,
  });
  
  const resetFinalApproval = () => {
    setShowFinalApprovalDialog(false);
    setSelectedDocument(null);
    setSelectedClassification("");
    setSelectedUserIds([]);
    setUserSearchQuery("");
    setDecisionNote("");
  };

  const finalApprovalMutation = useMutation({
    mutationFn: async ({ documentId, classification, userIds, comments }: { documentId: number; classification: string; userIds: number[]; comments?: string }) => {
      const response = await apiRequest("POST", `/api/documents/${documentId}/hub-approve`, { classification, userIds, comments });
      return response.json() as Promise<{ accessGrantedTo: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents?status=approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-access"] });
      resetFinalApproval();
      toast({
        title: "Document stored in Sahih Hub",
        description: data.accessGrantedTo > 0
          ? `Locked and stored. ${data.accessGrantedTo} user${data.accessGrantedTo > 1 ? 's' : ''} granted access.`
          : "Locked and stored.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const changeClassificationMutation = useMutation({
    mutationFn: async ({ documentId, classification }: { documentId: number; classification: string }) => {
      return apiRequest("POST", `/api/documents/${documentId}/classification`, { classification });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents?status=approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setShowClassificationDialog(false);
      setSelectedDocument(null);
      setSelectedClassification("");
      toast({ title: "Classification updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, note }: { requestId: number; note?: string }) => {
      return apiRequest("POST", `/api/document-access-requests/${requestId}/approve`, { decisionNote: note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-access"] });
      toast({ title: "Access granted", description: "The user now has access to the document." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ requestId, note }: { requestId: number; note?: string }) => {
      return apiRequest("POST", `/api/document-access-requests/${requestId}/reject`, { decisionNote: note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-access-requests"] });
      toast({ title: "Access denied", description: "The access request has been rejected." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const grantMultipleAccessMutation = useMutation({
    mutationFn: async ({ documentId, userIds }: { documentId: number; userIds: number[] }) => {
      const response = await apiRequest("POST", `/api/documents/${documentId}/grant-access-multiple`, { userIds });
      return response.json() as Promise<{ granted: number; results: DocumentAccess[] }>;
    },
    onSuccess: (data, { userIds }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-access"] });
      setShowGrantAccessDialog(false);
      setSelectedUserIds([]);
      setUserSearchQuery("");
      const skipped = userIds.length - data.granted;
      if (skipped > 0 && data.granted > 0) {
        toast({ 
          title: "Access granted", 
          description: `${data.granted} user${data.granted > 1 ? 's' : ''} granted access. ${skipped} already had access.` 
        });
      } else if (data.granted > 0) {
        toast({ 
          title: "Access granted", 
          description: `${data.granted} user${data.granted > 1 ? 's' : ''} can now view this document.` 
        });
      } else {
        toast({ 
          title: "No changes", 
          description: "All selected users already have access to this document." 
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const revokeAccessMutation = useMutation({
    mutationFn: async ({ documentId, userId }: { documentId: number; userId: number }) => {
      return apiRequest("POST", `/api/documents/${documentId}/revoke-access`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-access"] });
      toast({ title: "Access revoked", description: "User can no longer view this document." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.name || `User #${userId}`;
  };
  
  const getUserEmail = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.email || "";
  };
  
  const getDocumentName = (docId: number) => {
    const doc = approvedDocuments.find(d => d.id === docId);
    return doc ? `${doc.documentCode} - ${doc.title}` : `Document #${docId}`;
  };
  
  const getDocumentAccessList = (docId: number) => {
    return documentAccess.filter(a => a.documentId === docId && !a.isRevoked);
  };
  
  const matchesSearch = (doc: Document) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.documentCode.toLowerCase().includes(searchQuery.toLowerCase());

  const awaitingFinalApproval = approvedDocuments.filter(doc => doc.hubStatus === DocumentHubStatus.PENDING_COO_APPROVAL);
  const filteredDocuments = approvedDocuments.filter(doc => doc.hubStatus !== DocumentHubStatus.PENDING_COO_APPROVAL && matchesSearch(doc));
  
  if (!isCOO) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <Shield className="h-12 w-12 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold">Access Restricted</h2>
                <p className="text-muted-foreground mt-2">
                  The Document Hub is only accessible by the COO. Please contact the COO if you need access to approved documents.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-full">
      <div className="container py-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Lock className="h-8 w-8 text-primary" />
            Document Hub
          </h1>
          <p className="text-muted-foreground">
            Give final approval to approved documents, classify them and store them in the Sahih Hub. Only you (COO) can view and grant access to locked documents.
          </p>
        </div>
        
        <Tabs defaultValue={awaitingFinalApproval.length > 0 ? "final-approval" : "master-list"} className="space-y-4">
          <TabsList>
            <TabsTrigger value="final-approval" data-testid="tab-final-approval">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Awaiting Final Approval
              {awaitingFinalApproval.length > 0 && (
                <Badge variant="destructive" className="ml-2">{awaitingFinalApproval.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="master-list" data-testid="tab-master-list">
              <FileText className="h-4 w-4 mr-2" />
              Document Master List
            </TabsTrigger>
            <TabsTrigger value="access-requests" data-testid="tab-access-requests">
              <Clock className="h-4 w-4 mr-2" />
              Access Requests
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="final-approval" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Awaiting Final Approval</CardTitle>
                <CardDescription>
                  Documents signed off by their approver. Review each one, then either choose a classification and store it, or comment on it and return it to the approver.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDocs ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : awaitingFinalApproval.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No documents awaiting your final approval</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Approved By</TableHead>
                        <TableHead>Moved to Hub</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {awaitingFinalApproval.map(doc => (
                        <TableRow key={doc.id} data-testid={`row-pending-document-${doc.id}`}>
                          <TableCell>
                            <div className="font-medium">{doc.documentCode}</div>
                            <div className="text-sm text-muted-foreground">{doc.title}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={categoryColors[doc.category] || "bg-muted"}>
                              {doc.category.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{doc.approverId ? getUserName(doc.approverId) : "-"}</TableCell>
                          <TableCell>
                            {doc.transferredToHubAt ? format(new Date(doc.transferredToHubAt), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setShowViewDialog(true);
                                }}
                                data-testid={`button-review-pending-${doc.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/documents/${doc.id}/edit`)}
                                data-testid={`button-comment-pending-${doc.id}`}
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Comment / Return
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setShowFinalApprovalDialog(true);
                                }}
                                data-testid={`button-final-approve-${doc.id}`}
                              >
                                <ShieldCheck className="h-4 w-4 mr-1" />
                                Approve & Store
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="master-list" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Approved Documents</CardTitle>
                    <CardDescription>All documents stored in the Sahih Hub</CardDescription>
                  </div>
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs"
                    data-testid="input-search-documents"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDocs ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No approved documents found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Classification</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Users with Access</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map(doc => {
                        const accessList = getDocumentAccessList(doc.id);
                        return (
                          <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-amber-500" />
                                <div>
                                  <div className="font-medium">{doc.documentCode}</div>
                                  <div className="text-sm text-muted-foreground">{doc.title}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={categoryColors[doc.category] || "bg-muted"}>
                                {doc.category.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <ClassificationBadge classification={doc.classification} />
                            </TableCell>
                            <TableCell>
                              {doc.approvedAt ? format(new Date(doc.approvedAt), "MMM d, yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setShowAccessListDialog(true);
                                }}
                                data-testid={`button-view-access-${doc.id}`}
                              >
                                <Users className="h-4 w-4 mr-1" />
                                {accessList.length} users
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-actions-${doc.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setShowViewDialog(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Document
                                  </DropdownMenuItem>
                                  {doc.finalPdfUrl && (
                                    <DropdownMenuItem
                                      onClick={() => window.open(doc.finalPdfUrl!, '_blank')}
                                    >
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Download PDF
                                    </DropdownMenuItem>
                                  )}
                                  {doc.isLocked && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedDocument(doc);
                                        setSelectedClassification(doc.classification || "");
                                        setShowClassificationDialog(true);
                                      }}
                                      data-testid={`button-classify-${doc.id}`}
                                    >
                                      <Tag className="h-4 w-4 mr-2" />
                                      Change Classification
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setShowGrantAccessDialog(true);
                                    }}
                                  >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Grant Access
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setShowAccessListDialog(true);
                                    }}
                                  >
                                    <Users className="h-4 w-4 mr-2" />
                                    Manage Access
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="access-requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Access Requests</CardTitle>
                <CardDescription>Staff members requesting access to approved documents</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRequests ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No pending access requests</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requester</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map(req => (
                        <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{getUserName(req.requesterId)}</div>
                              <div className="text-sm text-muted-foreground">{getUserEmail(req.requesterId)}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{getDocumentName(req.documentId)}</div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {req.requestReason || "-"}
                          </TableCell>
                          <TableCell>
                            {req.createdAt ? format(new Date(req.createdAt), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveRequestMutation.mutate({ requestId: req.id })}
                                disabled={approveRequestMutation.isPending}
                                data-testid={`button-approve-${req.id}`}
                              >
                                {approveRequestMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                <span className="ml-1">Approve</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectRequestMutation.mutate({ requestId: req.id })}
                                disabled={rejectRequestMutation.isPending}
                                data-testid={`button-reject-${req.id}`}
                              >
                                {rejectRequestMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                                <span className="ml-1">Deny</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                {selectedDocument?.documentCode} - {selectedDocument?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedDocument?.hubStatus === DocumentHubStatus.PENDING_COO_APPROVAL
                  ? "Approved document awaiting your final approval (read-only)"
                  : "Approved document (read-only)"}
              </DialogDescription>
            </DialogHeader>
            {selectedDocument?.content && (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/30 rounded-md"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedDocument.content) }}
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={showGrantAccessDialog} onOpenChange={(open) => {
          setShowGrantAccessDialog(open);
          if (!open) {
            setSelectedUserIds([]);
            setUserSearchQuery("");
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Share Document
              </DialogTitle>
              <DialogDescription>
                Select users to grant access to "{selectedDocument?.documentCode} - {selectedDocument?.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-users"
                />
              </div>
              
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUserIds.map(userId => {
                    const user = users.find(u => u.id === userId);
                    return user ? (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {user.name}
                        <button
                          onClick={() => setSelectedUserIds(ids => ids.filter(id => id !== userId))}
                          className="ml-1 rounded-full hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                  {users
                    .filter(u => u.email !== COO_EMAIL)
                    .filter(u => 
                      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                    .map(user => {
                      const hasAccess = selectedDocument 
                        ? getDocumentAccessList(selectedDocument.id).some(a => a.userId === user.id)
                        : false;
                      const isSelected = selectedUserIds.includes(user.id);
                      
                      return (
                        <div 
                          key={user.id}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                            hasAccess 
                              ? 'opacity-50 cursor-not-allowed' 
                              : isSelected 
                                ? 'bg-primary/10' 
                                : 'hover:bg-muted'
                          }`}
                          onClick={() => {
                            if (!hasAccess) {
                              setSelectedUserIds(ids => 
                                isSelected 
                                  ? ids.filter(id => id !== user.id)
                                  : [...ids, user.id]
                              );
                            }
                          }}
                          data-testid={`user-option-${user.id}`}
                        >
                          <Checkbox
                            checked={isSelected || hasAccess}
                            disabled={hasAccess}
                            onCheckedChange={(checked) => {
                              if (!hasAccess) {
                                setSelectedUserIds(ids => 
                                  checked 
                                    ? [...ids, user.id]
                                    : ids.filter(id => id !== user.id)
                                );
                              }
                            }}
                            data-testid={`checkbox-user-${user.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{user.name}</div>
                            <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                          </div>
                          {hasAccess && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Has access
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
              
              <div className="text-sm text-muted-foreground">
                {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowGrantAccessDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedDocument && selectedUserIds.length > 0) {
                    grantMultipleAccessMutation.mutate({
                      documentId: selectedDocument.id,
                      userIds: selectedUserIds,
                    });
                  }
                }}
                disabled={selectedUserIds.length === 0 || grantMultipleAccessMutation.isPending}
                data-testid="button-confirm-grant"
              >
                {grantMultipleAccessMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Share with {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={showAccessListDialog} onOpenChange={setShowAccessListDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Document Access</DialogTitle>
              <DialogDescription>
                Users with access to "{selectedDocument?.documentCode} - {selectedDocument?.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {selectedDocument && getDocumentAccessList(selectedDocument.id).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No users have been granted access to this document</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDocument && getDocumentAccessList(selectedDocument.id).map(access => (
                    <div 
                      key={access.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                    >
                      <div>
                        <div className="font-medium">{getUserName(access.userId)}</div>
                        <div className="text-sm text-muted-foreground">{getUserEmail(access.userId)}</div>
                        {access.grantedAt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Granted: {format(new Date(access.grantedAt), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (selectedDocument) {
                            revokeAccessMutation.mutate({
                              documentId: selectedDocument.id,
                              userId: access.userId,
                            });
                          }
                        }}
                        disabled={revokeAccessMutation.isPending}
                        data-testid={`button-revoke-${access.id}`}
                      >
                        {revokeAccessMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                        <span className="ml-1">Revoke</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAccessListDialog(false);
                  setShowGrantAccessDialog(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Grant New Access
              </Button>
              <Button onClick={() => setShowAccessListDialog(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showFinalApprovalDialog} onOpenChange={(open) => { if (!open) resetFinalApproval(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Final Approval
              </DialogTitle>
              <DialogDescription>
                Classify "{selectedDocument?.documentCode} - {selectedDocument?.title}" and store it in the Sahih Hub. The document will be locked and become read-only.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm font-medium mb-2 block">Classification</Label>
              <RadioGroup
                value={selectedClassification}
                onValueChange={setSelectedClassification}
                className="space-y-2"
              >
                {classificationOptions.map(option => (
                  <Label
                    key={option.value}
                    htmlFor={`final-${option.value}`}
                    className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer font-normal ${
                      selectedClassification === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={`final-${option.value}`}
                      className="mt-0.5"
                      data-testid={`radio-final-${option.value}`}
                    />
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
              </div>

              {selectedClassification && selectedClassification !== "public_information" && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Who should have access? (optional)</Label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-final-approval-search-users"
                    />
                  </div>
                  <ScrollArea className="h-48 border rounded-md">
                    <div className="p-2 space-y-1">
                      {users
                        .filter(u => u.email !== COO_EMAIL)
                        .filter(u =>
                          u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                        )
                        .map(user => {
                          const isSelected = selectedUserIds.includes(user.id);
                          return (
                            <div
                              key={user.id}
                              className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`}
                              onClick={() => setSelectedUserIds(ids => isSelected ? ids.filter(id => id !== user.id) : [...ids, user.id])}
                              data-testid={`final-approval-user-${user.id}`}
                            >
                              <Checkbox checked={isSelected} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{user.name}</div>
                                <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected. You can grant more access later.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="final-approval-comments" className="text-sm font-medium mb-2 block">Comments (optional)</Label>
                <Textarea
                  id="final-approval-comments"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Notes for the audit trail"
                  data-testid="input-final-approval-comments"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={resetFinalApproval}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedDocument && selectedClassification) {
                    finalApprovalMutation.mutate({
                      documentId: selectedDocument.id,
                      classification: selectedClassification,
                      userIds: selectedClassification === "public_information" ? [] : selectedUserIds,
                      comments: decisionNote || undefined,
                    });
                  }
                }}
                disabled={!selectedClassification || finalApprovalMutation.isPending}
                data-testid="button-confirm-final-approval"
              >
                {finalApprovalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Approve & Store
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showClassificationDialog} onOpenChange={(open) => {
          setShowClassificationDialog(open);
          if (!open) {
            setSelectedDocument(null);
            setSelectedClassification("");
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Change Classification
              </DialogTitle>
              <DialogDescription>
                "{selectedDocument?.documentCode} - {selectedDocument?.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <RadioGroup
                value={selectedClassification}
                onValueChange={setSelectedClassification}
                className="space-y-2"
              >
                {classificationOptions.map(option => (
                  <Label
                    key={option.value}
                    htmlFor={`classify-${option.value}`}
                    className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer font-normal ${
                      selectedClassification === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={`classify-${option.value}`}
                      className="mt-0.5"
                      data-testid={`radio-classify-${option.value}`}
                    />
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowClassificationDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedDocument && selectedClassification) {
                    changeClassificationMutation.mutate({
                      documentId: selectedDocument.id,
                      classification: selectedClassification,
                    });
                  }
                }}
                disabled={!selectedClassification || selectedClassification === selectedDocument?.classification || changeClassificationMutation.isPending}
                data-testid="button-confirm-classification"
              >
                {changeClassificationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
