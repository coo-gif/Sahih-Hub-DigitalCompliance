import { useEffect, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle, CheckCircle2, ExternalLink, FileText, FileType, HardDrive, Link2, Loader2, LogOut, Pencil, RefreshCw, Search, X,
} from "lucide-react";

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
// Google Drive import
// ---------------------------------------------------------------------------

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  owner: string | null;
  webViewLink: string | null;
  importable: boolean;
}

export interface ImportedDriveFile {
  fileName: string;
  title: string;
  mimeType: string;
  webViewLink: string | null;
  html: string;
}

const FILE_KINDS: Record<string, string> = {
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "text/plain": "Text",
  "text/html": "HTML",
  "application/pdf": "PDF",
};

/**
 * Connects the user's Google Drive, lets them pick a file and returns its content as editor HTML.
 * The caller pastes it into the document form together with the other fields.
 */
export function DriveImportPanel({
  imported,
  onImported,
  returnTo = "/documents/new",
}: {
  imported: ImportedDriveFile | null;
  onImported: (file: ImportedDriveFile) => void;
  returnTo?: string;
}) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: status, isLoading } = useQuery<DriveStatus>({ queryKey: ["/api/drive/status"] });

  // Back from Google's consent screen: open the picker straight away
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive") === "connected") {
      toast({ title: "Google Drive connected", description: "Choose the file to import." });
      params.delete("drive");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["/api/drive/status"] });
      setPickerOpen(true);
    }
  }, [toast]);

  const connect = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/drive/connect?returnTo=${encodeURIComponent(returnTo)}`);
      return (await res.json()) as { authUrl: string };
    },
    onSuccess: ({ authUrl }) => { window.location.href = authUrl; },
    onError: (error) => toast({ title: "Could not connect Google Drive", description: errorMessage(error), variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: () => apiRequest("POST", "/api/drive/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive/status"] });
      toast({ title: "Google Drive disconnected" });
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (!status?.configured) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3" data-testid="drive-not-configured">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div>
          Google Drive import is not set up yet. An admin needs to add the Google sign-in keys
          (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) and enable the Google Drive API. Until then, enter the document manually.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="drive-panel">
      {!status.connected ? (
        <div className="rounded-md border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium flex items-center gap-2"><HardDrive className="h-4 w-4" /> Connect your Google Drive</div>
            <p className="text-muted-foreground mt-1">Read-only access: Sahih Hub only opens the file you choose.</p>
          </div>
          <Button onClick={() => connect.mutate()} disabled={connect.isPending} data-testid="button-drive-connect">
            {connect.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDrive className="h-4 w-4 mr-2" />}
            Connect Google Drive
          </Button>
        </div>
      ) : (
        <div className="rounded-md border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Google Drive connected
            </div>
            {status.connectedAt && (
              <p className="text-muted-foreground mt-1">Since {format(new Date(status.connectedAt), "dd MMM yyyy")}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setPickerOpen(true)} data-testid="button-drive-choose">
              <FileText className="h-4 w-4 mr-2" /> {imported ? "Choose another file" : "Choose a file"}
            </Button>
            <Button variant="ghost" size="icon" title="Disconnect Google Drive" onClick={() => disconnect.mutate()} data-testid="button-drive-disconnect">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {imported && (
        <div className="rounded-md bg-muted/50 p-3 text-sm flex items-center justify-between gap-3" data-testid="drive-imported">
          <span>
            Imported from Google Drive: <span className="font-medium">{imported.fileName}</span>
            <span className="text-muted-foreground"> · review the fields and the content below before saving.</span>
          </span>
          {imported.webViewLink && (
            <a href={imported.webViewLink} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 flex-shrink-0">
              Open in Drive <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      <DriveFilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onImported={(file) => { setPickerOpen(false); onImported(file); }}
        onDisconnected={() => queryClient.invalidateQueries({ queryKey: ["/api/drive/status"] })}
      />
    </div>
  );
}

function DriveFilePicker({
  open, onOpenChange, onImported, onDisconnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (file: ImportedDriveFile) => void;
  onDisconnected: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const filesUrl = `/api/drive/files${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  const { data: files = [], isLoading, isFetching, error, refetch } = useQuery<DriveFile[]>({
    queryKey: [filesUrl],
    enabled: open,
    retry: false,
  });

  useEffect(() => {
    if (error && /^409/.test((error as Error).message)) onDisconnected();
  }, [error, onDisconnected]);

  const importFile = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await apiRequest("POST", `/api/drive/files/${encodeURIComponent(fileId)}/import`);
      return (await res.json()) as ImportedDriveFile;
    },
    onSuccess: (file) => {
      toast({ title: "File imported", description: `${file.fileName} has been pasted into the document.` });
      onImported(file);
    },
    onError: (err) => toast({ title: "Could not import this file", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-drive-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Choose a file from Google Drive</DialogTitle>
          <DialogDescription>Google Docs, Word (.docx) and text files can be imported. PDFs must first be opened as a Google Doc.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by file name" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-drive-search" />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
          {isLoading ? (
            <div className="p-3 space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : error ? (
            <p className="p-6 text-sm text-center text-destructive">{errorMessage(error)}</p>
          ) : files.length === 0 ? (
            <p className="p-6 text-sm text-center text-muted-foreground">No documents found{query ? ` for "${query}"` : ""}.</p>
          ) : files.map(file => {
            const busy = importFile.isPending && importFile.variables === file.id;
            return (
              <div key={file.id} className="flex items-center gap-3 p-3" data-testid={`drive-file-${file.id}`}>
                <FileType className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {FILE_KINDS[file.mimeType] ?? file.mimeType}
                    {file.modifiedTime && ` · modified ${format(new Date(file.modifiedTime), "dd MMM yyyy")}`}
                    {file.owner && ` · ${file.owner}`}
                  </div>
                  {!file.importable && (
                    <div className="text-xs text-amber-700 mt-0.5">
                      {file.mimeType === "application/pdf" ? "PDF: open it with Google Docs in Drive, then import that copy." : "This file type cannot be imported."}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={!file.importable || importFile.isPending}
                  onClick={() => importFile.mutate(file.id)}
                  data-testid={`button-import-${file.id}`}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
