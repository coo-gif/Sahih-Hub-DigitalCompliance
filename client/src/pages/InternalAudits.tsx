import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/DocumentSources";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { OVERALL_LABEL, type AuditSummary } from "@shared/auditTemplate";
import InternalAuditTemplate, { type AuditChanges, type AuditEvidence, type AuditView } from "@/features/internal-audit/InternalAuditTemplate";

interface AuditListRow {
  id: number;
  reference: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: AuditView["status"];
  leadAuditorName: string | null;
  signedOffByName: string | null;
  signedOffAt: string | null;
  summary: AuditSummary;
  permissions: AuditView["permissions"];
}

const STATUS_STYLE: Record<AuditView["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-700" },
  pending_signoff: { label: "Awaiting sign-off", className: "bg-amber-100 text-amber-800" },
  closed: { label: "Closed", className: "bg-emerald-100 text-emerald-700" },
};

const isAuditStaff = (user?: { role: string; email: string } | null) => !!user &&
  (["admin", "quality_manager", "auditor"].includes(user.role) || user.email === "coo@sahihcertify.com" || user.email === "ceo@sahihcertify.com");
const isAuditAdmin = (user?: { role: string; email: string } | null) => !!user &&
  (["admin", "quality_manager"].includes(user.role) || user.email === "coo@sahihcertify.com" || user.email === "ceo@sahihcertify.com");

export default function InternalAudits() {
  const [, params] = useRoute("/internal-audits/:id");
  return params?.id ? <AuditDetail id={Number(params.id)} /> : <AuditList />;
}

function AuditList() {
  const [, navigate] = useLocation();
  const { data: currentUser } = useAuth();
  const { data: audits = [], isLoading } = useQuery<AuditListRow[]>({ queryKey: ["/api/internal-audits"] });
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-primary" /> Internal Audit
          </h1>
          <p className="text-muted-foreground mt-1">
            ISO/IEC 17021-1 deep review, module by module (4–10), with live system evidence, sampling, corrective actions and management sign-off.
          </p>
        </div>
        {isAuditStaff(currentUser) && (
          <Button onClick={() => setCreating(true)} data-testid="button-new-audit"><Plus className="h-4 w-4 mr-2" /> Start internal audit</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit programme</CardTitle>
          <CardDescription>Every internal audit, its conclusion and open corrective actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : audits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No internal audits yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Lead auditor</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Conclusion</TableHead>
                  <TableHead>Open actions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map(a => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/internal-audits/${a.id}`)} data-testid={`audit-row-${a.reference}`}>
                    <TableCell className="font-mono">{a.reference}</TableCell>
                    <TableCell>{a.periodStart ?? "–"} to {a.periodEnd ?? "–"}</TableCell>
                    <TableCell>{a.leadAuditorName ?? "–"}</TableCell>
                    <TableCell>{a.summary.assessed}/{a.summary.total}</TableCell>
                    <TableCell className="max-w-[260px]">{OVERALL_LABEL[a.summary.overall]}</TableCell>
                    <TableCell>{a.summary.openActions}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[a.status].className}>{STATUS_STYLE[a.status].label}</Badge>
                      {a.signedOffAt && <div className="text-xs text-muted-foreground mt-1">{a.signedOffByName}, {format(new Date(a.signedOffAt), "dd MMM yyyy")}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewAuditDialog open={creating} onOpenChange={setCreating} defaultLeadId={currentUser?.id} />
    </div>
  );
}

function NewAuditDialog({ open, onOpenChange, defaultLeadId }: { open: boolean; onOpenChange: (open: boolean) => void; defaultLeadId?: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: users = [] } = useUsers();
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ periodStart: `${year}-01-01`, periodEnd: new Date().toISOString().slice(0, 10), leadAuditorId: "", scopeNotes: "" });
  const [team, setTeam] = useState<number[]>([]);
  const leadId = form.leadAuditorId || (defaultLeadId ? String(defaultLeadId) : "");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/internal-audits", {
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        leadAuditorId: Number(leadId),
        auditTeamIds: team.filter(id => String(id) !== leadId),
        scopeNotes: form.scopeNotes,
      });
      return res.json();
    },
    onSuccess: (audit: { id: number; reference: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-audits"] });
      toast({ title: `Internal audit ${audit.reference} started` });
      onOpenChange(false);
      navigate(`/internal-audits/${audit.id}`);
    },
    onError: (err) => toast({ title: "Could not start the audit", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start internal audit</DialogTitle>
          <DialogDescription>Choose the period under review and the audit team. The lead auditor gets the audit as a task, due at the end of the period.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ia-start">Period start</Label>
              <Input id="ia-start" type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ia-end">Period end</Label>
              <Input id="ia-end" type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Lead auditor</Label>
            <Select value={leadId} onValueChange={v => setForm({ ...form, leadAuditorId: v })}>
              <SelectTrigger data-testid="select-lead-auditor"><SelectValue placeholder="Choose the lead auditor" /></SelectTrigger>
              <SelectContent>{users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Audit team</Label>
            <div className="max-h-36 overflow-y-auto border rounded-md divide-y">
              {users.filter(u => String(u.id) !== leadId).map(u => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                  <Checkbox checked={team.includes(u.id)} onCheckedChange={() => setTeam(t => t.includes(u.id) ? t.filter(x => x !== u.id) : [...t, u.id])} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ia-scope">Scope notes</Label>
            <Textarea id="ia-scope" rows={3} value={form.scopeNotes} onChange={e => setForm({ ...form, scopeNotes: e.target.value })} placeholder="Areas, sites or processes in scope; anything excluded" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !leadId || !form.periodStart || !form.periodEnd} data-testid="button-create-audit">
            Start audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditDetail({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: currentUser } = useAuth();
  const { data: users = [] } = useUsers();
  const auditKey = [`/api/internal-audits/${id}`];
  const { data: audit, isLoading, error } = useQuery<AuditView>({ queryKey: auditKey, retry: false });
  const evidenceUrl = audit
    ? `/api/internal-audits/evidence?from=${audit.record.meta.periodStart}&to=${audit.record.meta.periodEnd}`
    : "";
  const { data: evidence, isFetching: evidenceLoading, refetch: refetchEvidence } = useQuery<AuditEvidence>({
    queryKey: [evidenceUrl],
    enabled: !!audit && isAuditStaff(currentUser) && audit.status !== "closed",
  });

  const afterChange = (updated: AuditView, message?: string) => {
    queryClient.setQueryData(auditKey, updated);
    queryClient.invalidateQueries({ queryKey: ["/api/internal-audits"] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
    if (message) toast({ title: message });
  };
  const call = useMutation({
    mutationFn: async ({ method, path, body }: { method: string; path: string; body?: unknown; message?: string }) => {
      const res = await apiRequest(method, `/api/internal-audits/${id}${path}`, body);
      return res.status === 204 ? null : res.json();
    },
    onSuccess: (updated, vars) => { if (updated) afterChange(updated, vars.message); },
    onError: (err) => {
      let description = errorMessage(err);
      try {
        const body = JSON.parse(String((err as Error).message).replace(/^\d{3}:\s*/, ""));
        if (Array.isArray(body.issues)) description = `${body.message}: ${body.issues.join(" ")}`;
      } catch { /* plain message */ }
      toast({ title: "Not done", description, variant: "destructive" });
    },
  });
  const run = (method: string, path: string, body?: unknown, message?: string) => call.mutateAsync({ method, path, body, message }).catch(() => undefined);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;
  if (error || !audit) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/internal-audits")}><ArrowLeft className="h-4 w-4 mr-2" />Internal audits</Button>
        <p className="text-muted-foreground">This audit was not found, or you don't have access to it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" onClick={() => navigate("/internal-audits")}><ArrowLeft className="h-4 w-4 mr-2" />Internal audits</Button>
        {audit.permissions.canDelete && (
          <Button variant="ghost" className="text-destructive" onClick={async () => {
            if (!window.confirm(`Delete draft audit ${audit.reference}?`)) return;
            await run("DELETE", "");
            queryClient.invalidateQueries({ queryKey: ["/api/internal-audits"] });
            navigate("/internal-audits");
          }}>
            <Trash2 className="h-4 w-4 mr-2" />Delete draft
          </Button>
        )}
      </div>
      <InternalAuditTemplate
        audit={audit}
        users={users.map(u => ({ id: u.id, name: u.name }))}
        evidence={evidence}
        evidenceLoading={evidenceLoading}
        canManageTeam={isAuditAdmin(currentUser)}
        busy={call.isPending}
        onSave={(changes: AuditChanges) => run("PUT", "", changes, "Audit saved")}
        onRefreshEvidence={() => refetchEvidence()}
        onSubmit={() => run("POST", "/submit", {}, "Submitted for management sign-off")}
        onSignOff={() => run("POST", "/sign-off", {}, "Audit signed off")}
        onReturn={(note) => run("POST", "/return", { note }, "Returned to the audit team")}
        onCompleteAction={(checkId, actionTaken) => run("POST", `/actions/${checkId}/complete`, { actionTaken }, "Action recorded")}
        onVerify={(checkId, effective, note) => run("POST", `/actions/${checkId}/verify`, { effective, note }, effective ? "Verified effective" : "Sent back to the owner")}
      />
    </div>
  );
}
