import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import type { Document, User, DocumentAccessRequest, DocumentAccess } from "@shared/schema";

const COO_EMAIL = 'coo@sahihcertify.com';

const categoryColors: Record<string, string> = {
  policy: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  manual: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  sop: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  format: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  job_description: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function DocumentHub() {
  const { data: currentUser } = useAuth();
  const { data: users = [] } = useUsers();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showGrantAccessDialog, setShowGrantAccessDialog] = useState(false);
  const [showAccessListDialog, setShowAccessListDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [decisionNote, setDecisionNote] = useState("");
  
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
  
  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, note }: { requestId: number; note?: string }) => {
      return apiRequest(`/api/document-access-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ decisionNote: note }),
        headers: { "Content-Type": "application/json" },
      });
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
      return apiRequest(`/api/document-access-requests/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ decisionNote: note }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-access-requests"] });
      toast({ title: "Access denied", description: "The access request has been rejected." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const grantAccessMutation = useMutation({
    mutationFn: async ({ documentId, userId }: { documentId: number; userId: number }) => {
      return apiRequest(`/api/documents/${documentId}/grant-access`, {
        method: "POST",
        body: JSON.stringify({ userId }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-access"] });
      setShowGrantAccessDialog(false);
      setSelectedUserId("");
      toast({ title: "Access granted", description: "User can now view this document." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const revokeAccessMutation = useMutation({
    mutationFn: async ({ documentId, userId }: { documentId: number; userId: number }) => {
      return apiRequest(`/api/documents/${documentId}/revoke-access`, {
        method: "POST",
        body: JSON.stringify({ userId }),
        headers: { "Content-Type": "application/json" },
      });
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
  
  const filteredDocuments = approvedDocuments.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.documentCode.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
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
            Manage access to approved documents. Only you (COO) can view and grant access to locked documents.
          </p>
        </div>
        
        <Tabs defaultValue="master-list" className="space-y-4">
          <TabsList>
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
          
          <TabsContent value="master-list" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Approved Documents</CardTitle>
                    <CardDescription>All locked documents in the system</CardDescription>
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
                Approved document (read-only)
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
        
        <Dialog open={showGrantAccessDialog} onOpenChange={setShowGrantAccessDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Document Access</DialogTitle>
              <DialogDescription>
                Select a user to grant access to "{selectedDocument?.documentCode} - {selectedDocument?.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger data-testid="select-user-grant">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter(u => u.email !== COO_EMAIL)
                      .map(user => {
                        const hasAccess = selectedDocument 
                          ? getDocumentAccessList(selectedDocument.id).some(a => a.userId === user.id)
                          : false;
                        return (
                          <SelectItem 
                            key={user.id} 
                            value={user.id.toString()}
                            disabled={hasAccess}
                          >
                            {user.name} ({user.email})
                            {hasAccess && " - Already has access"}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGrantAccessDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedDocument && selectedUserId) {
                    grantAccessMutation.mutate({
                      documentId: selectedDocument.id,
                      userId: parseInt(selectedUserId),
                    });
                  }
                }}
                disabled={!selectedUserId || grantAccessMutation.isPending}
                data-testid="button-confirm-grant"
              >
                {grantAccessMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Grant Access
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
      </div>
    </ScrollArea>
  );
}
