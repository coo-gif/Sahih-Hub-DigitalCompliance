import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDocuments } from "@/hooks/use-documents";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ExternalLink, HardDrive, Link2, Loader2, Pencil, Search, Upload, X } from "lucide-react";

// Server errors arrive as "409: {json}"; show the message part
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const body = raw.replace(/^\d{3}:\s*/, "");
  try {
    return JSON.parse(body).message || body;
  } catch {
    return body;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  policy: "Policy", manual: "Manual", sop: "SOP", format: "Format",
  job_description: "Job Description", training_assessment: "Trainings and Assessment",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  current: { label: "Current", className: "bg-emerald-100 text-emerald-700" },
  under_revision: { label: "Current · Under revision", className: "bg-blue-100 text-blue-700" },
  obsolete: { label: "Obsolete", className: "bg-slate-200 text-slate-700" },
  quarantine: { label: "Quarantine", className: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const known = STATUS_LABELS[status];
  return (
    <Badge variant={known ? undefined : "outline"} className={known?.className}>
      {known?.label ?? status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Word upload: the file opens in the document editor
// ---------------------------------------------------------------------------

export interface UploadedFile {
  fileName: string;
  title: string;
  html: string;
}

const readAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export function WordUploadPanel({ uploaded, onUploaded }: { uploaded: UploadedFile | null; onUploaded: (file: UploadedFile) => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const convert = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 7 * 1024 * 1024) throw new Error("The file is larger than 7 MB");
      const res = await apiRequest("POST", "/api/documents/convert-upload", { fileName: file.name, data: await readAsBase64(file) });
      return (await res.json()) as UploadedFile;
    },
    onSuccess: (file) => {
      toast({ title: "File opened", description: `${file.fileName} is now in the editor below.` });
      onUploaded(file);
    },
    onError: (err) => toast({ title: "Could not open this file", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div className="rounded-md border border-dashed p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="upload-panel">
      <div className="text-sm">
        <div className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Upload a Word file</div>
        <p className="text-muted-foreground mt-1">
          {uploaded
            ? <>Opened <span className="font-medium text-foreground">{uploaded.fileName}</span>. Check the content in the editor below.</>
            : "Word (.docx), text or HTML, up to 7 MB. Old .doc files: save as .docx first."}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.txt,.html,.htm,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) convert.mutate(file); e.target.value = ""; }}
        data-testid="input-upload-file"
      />
      <Button onClick={() => inputRef.current?.click()} disabled={convert.isPending} data-testid="button-upload-file">
        {convert.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {uploaded ? "Upload another file" : "Choose file"}
      </Button>
    </div>
  );
}

// Google Docs / Sheets / Slides / Drive links (kept and opened in Google)
export const isGoogleFileUrl = (value: string) => /^https:\/\/(docs|drive)\.google\.com\//.test(value.trim());

export function googleFileKind(url: string | null | undefined): string {
  if (!url) return "Google file";
  if (url.includes("/spreadsheets/")) return "Google Sheet";
  if (url.includes("/presentation/")) return "Google Slides";
  if (url.includes("/document/")) return "Google Doc";
  if (url.includes("/forms/")) return "Google Form";
  return "Google Drive file";
}

/** For documents kept in Google: open the file in a new tab. */
export function GoogleFileCard({ url, title }: { url: string | null | undefined; title: string }) {
  return (
    <Card data-testid="card-google-file">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Kept in Google</CardTitle>
        <CardDescription>
          This document is maintained as a {googleFileKind(url)}. Sahih Hub holds its register details (doc ref, edition, revision, issue date, signatories) and its approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {url ? (
          <Button asChild data-testid="button-open-google">
            <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Open {title} in Google</a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">You need access to this document to open it. Use Request Access.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Associated procedures
// ---------------------------------------------------------------------------

/** Multi-select of existing documents this document refers to. */
export function AssociatedProceduresPicker({
  value, onChange, excludeId, disabled,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  excludeId?: number;
  disabled?: boolean;
}) {
  const { data: documents = [], isLoading } = useDocuments();
  const [search, setSearch] = useState("");

  const options = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents
      .filter(d => d.id !== excludeId)
      .filter(d => !term || `${d.documentCode} ${d.title}`.toLowerCase().includes(term))
      .sort((a, b) => a.documentCode.localeCompare(b.documentCode));
  }, [documents, search, excludeId]);

  const selected = documents.filter(d => value.includes(d.id));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  return (
    <div className="space-y-3" data-testid="associated-procedures-picker">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(d => (
            <Badge key={d.id} variant="secondary" className="gap-1 pr-1" data-testid={`linked-chip-${d.id}`}>
              <span className="font-mono">{d.documentCode}</span> {d.title}
              {!disabled && (
                <button type="button" onClick={() => toggle(d.id)} className="ml-1 rounded hover:bg-muted p-0.5" aria-label={`Remove ${d.documentCode}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      {!disabled && (
        <>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search procedures by code or title" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-link-search" />
          </div>
          <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
            {isLoading ? (
              <div className="p-3 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : options.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">No documents found.</p>
            ) : options.map(d => (
              <label key={d.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm">
                <Checkbox checked={value.includes(d.id)} onCheckedChange={() => toggle(d.id)} data-testid={`checkbox-link-${d.id}`} />
                <span className="font-mono text-xs w-24 flex-shrink-0">{d.documentCode}</span>
                <span className="flex-1 min-w-0 truncate">{d.title}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{CATEGORY_LABELS[d.category] ?? d.category}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface LinkedDocument {
  linkId: number;
  documentId: number;
  documentCode: string;
  title: string;
  category: string;
  currentVersion: string;
  status: string;
  linkedVersion?: string | null;
  needsReview: boolean;
  flaggedAt?: string | null;
  flagNote?: string | null;
  reviewedAt?: string | null;
}

/**
 * The procedures a document refers to (with a flag when one of them changed since it was linked)
 * and the documents that refer to it.
 */
export function AssociatedProceduresCard({
  documentId, canEdit, canConfirmReview, onRaiseChangeRequest,
}: {
  documentId: number;
  canEdit: boolean;
  canConfirmReview: boolean;
  // Offered when the document is approved and locked, so a change must go through a change request
  onRaiseChangeRequest?: () => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  const linksKey = [`/api/documents/${documentId}/links`];
  const { data, isLoading } = useQuery<{ linksTo: LinkedDocument[]; linkedFrom: LinkedDocument[] }>({ queryKey: linksKey });
  const linksTo = data?.linksTo ?? [];
  const linkedFrom = data?.linkedFrom ?? [];
  const flagged = linksTo.filter(l => l.needsReview);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: linksKey });
    queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
  };

  const save = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/documents/${documentId}/links`, { linkedDocumentIds: draft }),
    onSuccess: () => { setEditing(false); refresh(); toast({ title: "Associated procedures updated" }); },
    onError: (err) => toast({ title: "Could not update", description: errorMessage(err), variant: "destructive" }),
  });

  const markReviewed = useMutation({
    mutationFn: (linkId: number) => apiRequest("POST", `/api/document-links/${linkId}/reviewed`, {}),
    onSuccess: () => { refresh(); toast({ title: "Marked as reviewed", description: "The link now points to the procedure's current version." }); },
    onError: (err) => toast({ title: "Could not confirm", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <Card data-testid="card-associated-procedures">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Associated Procedures
            {flagged.length > 0 && <Badge className="bg-amber-100 text-amber-800">{flagged.length} changed</Badge>}
          </CardTitle>
          <CardDescription>When a linked procedure gets a new version, this document is flagged for review.</CardDescription>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => { setDraft(linksTo.map(l => l.documentId)); setEditing(true); }} data-testid="button-edit-links">
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Skeleton className="h-16 w-full" /> : editing ? (
          <div className="space-y-3">
            <AssociatedProceduresPicker value={draft} onChange={setDraft} excludeId={documentId} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-links">Save</Button>
            </div>
          </div>
        ) : (
          <>
            {linksTo.length === 0 ? (
              <p className="text-sm text-muted-foreground">No associated procedures linked.</p>
            ) : (
              <div className="divide-y border rounded-md">
                {linksTo.map(link => (
                  <div key={link.linkId} className={`p-3 text-sm ${link.needsReview ? "bg-amber-50" : ""}`} data-testid={`link-${link.documentId}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="font-mono text-primary hover:underline" onClick={() => navigate(`/documents/${link.documentId}/edit`)}>
                        {link.documentCode}
                      </button>
                      <span className="flex-1 min-w-0">{link.title}</span>
                      <Badge variant="outline" className="font-mono">{link.currentVersion}</Badge>
                      <StatusBadge status={link.status} />
                    </div>
                    {link.needsReview && (
                      <div className="mt-2 flex flex-col md:flex-row md:items-center gap-2 justify-between">
                        <div className="text-amber-800 flex gap-2">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>
                            {link.flagNote ?? `Updated since linked (${link.linkedVersion ?? "earlier version"} → ${link.currentVersion}).`}
                            {" "}Check whether this document still fits.
                          </span>
                        </div>
                        {canConfirmReview && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => markReviewed.mutate(link.linkId)} disabled={markReviewed.isPending} data-testid={`button-link-reviewed-${link.linkId}`}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Still valid, mark reviewed
                            </Button>
                            {onRaiseChangeRequest && (
                              <Button size="sm" onClick={onRaiseChangeRequest} data-testid={`button-link-cr-${link.linkId}`}>
                                Raise change request
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {!link.needsReview && link.linkedVersion && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Linked against {link.linkedVersion}{link.reviewedAt ? `, reviewed ${format(new Date(link.reviewedAt), "dd MMM yyyy")}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {linkedFrom.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Referenced by</div>
                <div className="flex flex-wrap gap-2">
                  {linkedFrom.map(link => (
                    <Badge
                      key={link.linkId}
                      variant="outline"
                      className="cursor-pointer gap-1"
                      onClick={() => navigate(`/documents/${link.documentId}/edit`)}
                      data-testid={`linked-from-${link.documentId}`}
                    >
                      <span className="font-mono">{link.documentCode}</span> {link.title}
                      {link.needsReview && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
