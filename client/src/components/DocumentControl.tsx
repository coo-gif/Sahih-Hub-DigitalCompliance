import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import DOMPurify from "dompurify";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Eye, FileText, Loader2, X } from "lucide-react";
import { TargetDateField, TARGET_DAYS, defaultTargetInput, targetToIso } from "@/components/TargetDateField";

export interface ChangeRequestDetail {
  id: number;
  crNumber: string;
  documentId: number;
  documentCode: string;
  documentTitle: string;
  editionNumber: number;
  revisionNumber: number;
  initiatorId: number;
  initiatorName: string | null;
  status: "draft" | "submitted" | "rejected" | "accepted" | "implemented";
  summary: string | null;
  submittedAt: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  revisionPreparerName: string | null;
  implementedAt: string | null;
  newEditionNumber: number | null;
  newRevisionNumber: number | null;
  createdAt: string;
  reasons: string[];
  points: Array<{ id: number; quotedText: string; content: string; reason: string; createdAt: string }>;
}

export const CR_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  submitted: { label: "Awaiting COO", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  accepted: { label: "Accepted · under revision", className: "bg-blue-100 text-blue-700" },
  implemented: { label: "Implemented", className: "bg-emerald-100 text-emerald-700" },
};

// Change requests waiting for the COO, with accept / reject
export function HubChangeRequests() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: users = [] } = useUsers();
  const { data: requests = [], isLoading } = useQuery<ChangeRequestDetail[]>({ queryKey: ["/api/change-requests?status=submitted"] });
  const [deciding, setDeciding] = useState<{ cr: ChangeRequestDetail; decision: "accept" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [preparerId, setPreparerId] = useState("");
  const [target, setTarget] = useState(defaultTargetInput(TARGET_DAYS.prepare));

  const open = (cr: ChangeRequestDetail, decision: "accept" | "reject") => {
    setDeciding({ cr, decision });
    setNote("");
    setPreparerId("");
    setTarget(defaultTargetInput(TARGET_DAYS.prepare));
  };

  const decideMutation = useMutation({
    mutationFn: async () => {
      if (!deciding) return;
      const res = await apiRequest("POST", `/api/change-requests/${deciding.cr.id}/decide`, {
        decision: deciding.decision,
        note: note || undefined,
        preparerId: deciding.decision === "accept" && preparerId ? Number(preparerId) : undefined,
        targetDate: deciding.decision === "accept" ? targetToIso(target) : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/change-requests") });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      toast({
        title: deciding?.decision === "accept" ? "Change request accepted" : "Change request rejected",
        description: deciding?.decision === "accept"
          ? "The document is now under revision. The approved version stays in force until the new one is approved."
          : "The approved version remains valid.",
      });
      setDeciding(null);
    },
    onError: (error: Error) => toast({ title: "Could not record the decision", description: error.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Requests</CardTitle>
        <CardDescription>Requests to change approved documents. Accepting starts a revision; rejecting keeps the approved version as it is.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No change requests waiting for you</p>
          </div>
        ) : requests.map(cr => (
          <div key={cr.id} className="rounded-md border p-4 space-y-3" data-testid={`cr-${cr.crNumber}`}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{cr.crNumber}</span>
                  <span className="font-medium">{cr.documentCode} - {cr.documentTitle}</span>
                  <Badge variant="outline">Ed.{cr.editionNumber} Rev.{cr.revisionNumber}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Raised by {cr.initiatorName} {cr.submittedAt && `on ${format(new Date(cr.submittedAt), "MMM d, yyyy")}`} · Reason: {cr.reasons.join(", ")}
                </p>
                {cr.summary && <p className="text-sm">"{cr.summary}"</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${cr.documentId}/edit`)}>
                  <Eye className="h-4 w-4 mr-1" /> View in document
                </Button>
                <Button variant="outline" size="sm" onClick={() => open(cr, "reject")} data-testid={`button-reject-cr-${cr.id}`}>
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button size="sm" onClick={() => open(cr, "accept")} data-testid={`button-accept-cr-${cr.id}`}>
                  <Check className="h-4 w-4 mr-1" /> Accept
                </Button>
              </div>
            </div>
            <ol className="space-y-2 text-sm list-decimal pl-5">
              {cr.points.map(p => (
                <li key={p.id}>
                  <span className="italic text-muted-foreground">"{p.quotedText.slice(0, 120)}"</span>
                  <Badge variant="secondary" className="ml-2 text-xs">{p.reason}</Badge>
                  <div>{p.content}</div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!deciding} onOpenChange={(o) => { if (!o) setDeciding(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{deciding?.decision === "accept" ? "Accept change request" : "Reject change request"}</DialogTitle>
            <DialogDescription>
              {deciding?.cr.crNumber}: {deciding?.cr.documentCode} - {deciding?.cr.documentTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {deciding?.decision === "accept" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  The document becomes <strong>Current, under revision</strong>. Readers keep using the approved version until the revised one goes through review, approval and your final approval.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="cr-preparer">Who prepares the revision</Label>
                  <Select value={preparerId} onValueChange={setPreparerId}>
                    <SelectTrigger id="cr-preparer" data-testid="select-cr-preparer">
                      <SelectValue placeholder="The document's original preparer" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <TargetDateField id="cr-target" label="Revision due by" value={target} onChange={setTarget} defaultDays={TARGET_DAYS.prepare} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">The previously approved version remains valid. The person who raised it will be told.</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cr-note">Note {deciding?.decision === "reject" ? "(reason)" : "(optional)"}</Label>
              <Textarea id="cr-note" value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-cr-note" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button
              variant={deciding?.decision === "reject" ? "destructive" : "default"}
              onClick={() => decideMutation.mutate()}
              disabled={decideMutation.isPending || (deciding?.decision === "accept" && !target)}
              data-testid="button-confirm-cr-decision"
            >
              {decideMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deciding?.decision === "accept" ? "Accept and start revision" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface VersionRow {
  id: number;
  versionNumber: string;
  title: string | null;
  status: "current" | "obsolete";
  approvedAt: string | null;
  approvedByName: string | null;
  obsoletedAt: string | null;
  content: string | null;
}

// Every approved version of a document: the current one and the obsolete ones kept as records
export function DocumentVersionsDialog({ documentId, title, onClose }: { documentId: number | null; title: string; onClose: () => void }) {
  const { data: versions = [], isLoading } = useQuery<VersionRow[]>({
    queryKey: [`/api/documents/${documentId}/versions`],
    enabled: !!documentId,
  });
  const [viewing, setViewing] = useState<VersionRow | null>(null);
  return (
    <Dialog open={!!documentId} onOpenChange={(o) => { if (!o) { setViewing(null); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>{title}. All approved versions are kept as controlled records.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : viewing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{viewing.versionNumber} {viewing.title && `- ${viewing.title}`}</div>
              <Button variant="outline" size="sm" onClick={() => setViewing(null)}>Back to versions</Button>
            </div>
            <div className="relative rounded-md border p-4 bg-muted/30">
              {viewing.status === "obsolete" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-black tracking-widest text-red-500/20 -rotate-12 border-4 border-red-500/20 px-6 py-2">OBSOLETE</span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewing.content || "<p><em>No content stored.</em></p>") }} />
            </div>
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No approved versions recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Version</th>
                <th className="p-2">Approved</th>
                <th className="p-2">Approved by</th>
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr key={v.id} className="border-t" data-testid={`version-${v.versionNumber}`}>
                  <td className="p-2 font-mono">{v.versionNumber}</td>
                  <td className="p-2">{v.approvedAt ? format(new Date(v.approvedAt), "MMM d, yyyy") : "-"}</td>
                  <td className="p-2">{v.approvedByName ?? "-"}</td>
                  <td className="p-2">
                    {v.status === "current"
                      ? <Badge className="bg-emerald-100 text-emerald-700">Current</Badge>
                      : <Badge className="bg-slate-200 text-slate-700">Obsolete {v.obsoletedAt && `· ${format(new Date(v.obsoletedAt), "MMM d, yyyy")}`}</Badge>}
                  </td>
                  <td className="p-2 text-right">
                    {v.content !== null && (
                      <Button variant="ghost" size="sm" onClick={() => setViewing(v)}>
                        <FileText className="h-4 w-4 mr-1" /> View
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
