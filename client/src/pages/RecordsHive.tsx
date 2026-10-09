import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, Download, ExternalLink, FileText, History, ListChecks, Printer } from "lucide-react";
import { CR_STATUS, type ChangeRequestDetail } from "@/components/DocumentControl";

interface ObsoleteRow {
  kind: "superseded_version" | "withdrawn_document";
  documentId: number;
  versionId: number;
  documentCode: string;
  title: string;
  version: string;
  approvedAt: string | null;
  approvedByName: string | null;
  obsoletedAt: string | null;
  supersededBy: string | null;
  changeRequest: string | null;
}

interface MasterListRow {
  documentId: number;
  documentCode: string;
  title: string;
  category: string;
  version: string;
  editionNumber: number;
  revisionNumber: number;
  issueDate: string | null;
  preparedByName: string | null;
  reviewedByName: string | null;
  signedApprovedByName: string | null;
  sourceType: string;
  googleUrl: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  classification: string | null;
  status: string;
  nextReviewDate: string | null;
  versionsKept: number;
}

const day = (value: string | null | undefined) => (value ? format(new Date(value), "dd MMM yyyy") : "-");
const label = (value: string | null | undefined) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "-";
const typeLabel = (value: string | null | undefined) => (value === "sop" ? "SOP" : label(value));

const STATUS_STYLES: Record<string, string> = {
  current: "bg-emerald-100 text-emerald-700",
  under_revision: "bg-blue-100 text-blue-700",
  obsolete: "bg-slate-200 text-slate-700",
  quarantine: "bg-red-100 text-red-700",
};

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Records & Data Hive: controlled records of document changes, obsolete versions and the master list
export default function RecordsHive() {
  const [, navigate] = useLocation();
  const { data: changeRequests = [], isLoading: loadingCrs } = useQuery<ChangeRequestDetail[]>({ queryKey: ["/api/records/change-requests"] });
  const { data: obsolete = [], isLoading: loadingObsolete } = useQuery<ObsoleteRow[]>({ queryKey: ["/api/records/obsolete"] });
  const { data: master, isLoading: loadingMaster } = useQuery<{ updatedAt: string | null; documents: MasterListRow[] }>({ queryKey: ["/api/records/master-list"] });
  const masterRows = master?.documents ?? [];

  const loading = (
    <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
  );

  return (
    <div className="space-y-6 min-w-0 print:space-y-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Archive className="h-7 w-7 text-primary" />
            Records &amp; Data Hive
          </h1>
          <p className="text-muted-foreground mt-1">
            Controlled records: change requests and revision history, obsolete documents and the Document Master List.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>

      <Tabs defaultValue="change-requests" className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="change-requests" data-testid="tab-records-crs"><History className="h-4 w-4 mr-2" />Change Requests &amp; Revision History</TabsTrigger>
          <TabsTrigger value="obsolete" data-testid="tab-records-obsolete"><Archive className="h-4 w-4 mr-2" />Obsolete Documents</TabsTrigger>
          <TabsTrigger value="master" data-testid="tab-records-master"><ListChecks className="h-4 w-4 mr-2" />Document Master List</TabsTrigger>
        </TabsList>

        <TabsContent value="change-requests">
          <Card>
            <CardHeader>
              <CardTitle>Change Request &amp; Revision Register</CardTitle>
              <CardDescription>Every change request raised on an approved document, with its decision and outcome.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCrs ? loading : changeRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No change requests yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CR No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Doc Ref</TableHead>
                      <TableHead>Edition</TableHead>
                      <TableHead>Initiator</TableHead>
                      <TableHead>Approver</TableHead>
                      <TableHead>Need of change</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>New version</TableHead>
                      <TableHead className="print:hidden"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeRequests.map(cr => (
                      <TableRow key={cr.id} data-testid={`record-cr-${cr.crNumber}`}>
                        <TableCell className="font-mono">{cr.crNumber}</TableCell>
                        <TableCell>{day(cr.submittedAt ?? cr.createdAt)}</TableCell>
                        <TableCell>{cr.documentTitle}</TableCell>
                        <TableCell className="font-mono">{cr.documentCode}</TableCell>
                        <TableCell>Ed.{cr.editionNumber} Rev.{cr.revisionNumber}</TableCell>
                        <TableCell>{cr.initiatorName}</TableCell>
                        <TableCell>{cr.decidedByName ?? "-"}</TableCell>
                        <TableCell className="max-w-[220px]">{cr.reasons.join(", ")}</TableCell>
                        <TableCell><Badge className={CR_STATUS[cr.status]?.className}>{CR_STATUS[cr.status]?.label ?? cr.status}</Badge></TableCell>
                        <TableCell>{cr.newRevisionNumber !== null ? `Ed.${cr.newEditionNumber} Rev.${cr.newRevisionNumber}` : "-"}</TableCell>
                        <TableCell className="print:hidden">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/records/change-requests/${cr.id}`)} data-testid={`button-cr-form-${cr.id}`}>
                            <FileText className="h-4 w-4 mr-1" /> Form
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obsolete">
          <Card>
            <CardHeader>
              <CardTitle>List of Obsolete Documents</CardTitle>
              <CardDescription>Superseded versions and withdrawn documents. They are retained as records and are not for use.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingObsolete ? loading : obsolete.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No obsolete documents.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doc Ref</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Approved</TableHead>
                      <TableHead>Approved by</TableHead>
                      <TableHead>Obsolete since</TableHead>
                      <TableHead>Superseded by</TableHead>
                      <TableHead>Change request</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {obsolete.map(row => (
                      <TableRow key={`${row.kind}-${row.documentId}-${row.versionId}`}>
                        <TableCell className="font-mono">{row.documentCode}</TableCell>
                        <TableCell>{row.title}</TableCell>
                        <TableCell className="font-mono">{row.version}</TableCell>
                        <TableCell>{day(row.approvedAt)}</TableCell>
                        <TableCell>{row.approvedByName ?? "-"}</TableCell>
                        <TableCell>{day(row.obsoletedAt)}</TableCell>
                        <TableCell>{row.kind === "withdrawn_document" ? <Badge variant="outline">Withdrawn by COO</Badge> : row.supersededBy}</TableCell>
                        <TableCell className="font-mono">{row.changeRequest ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="master">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Document Master List</CardTitle>
                <CardDescription>
                  Updated automatically every time a document is approved.
                  {master?.updatedAt && <> Last approval: {day(master.updatedAt)}.</>}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="print:hidden"
                disabled={masterRows.length === 0}
                onClick={() => downloadCsv(`document-master-list-${format(new Date(), "yyyy-MM-dd")}.csv`, masterRows.map(r => ({
                  "Doc Ref No.": r.documentCode, "Document Name": r.title, Type: typeLabel(r.category),
                  Edition: r.editionNumber, Revision: r.revisionNumber, "Issue Date": day(r.issueDate),
                  "Prepared by": r.preparedByName ?? "", "Reviewed by": r.reviewedByName ?? "", "Approved by": r.signedApprovedByName ?? "",
                  "Final approval (COO)": r.approvedByName ?? "", Classification: label(r.classification),
                  Status: label(r.status), "Next review": day(r.nextReviewDate), "Kept in": r.googleUrl ?? "Sahih Hub",
                  "Versions kept": r.versionsKept,
                })))}
                data-testid="button-export-master-list"
              >
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loadingMaster ? loading : masterRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No approved documents yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doc Ref No.</TableHead>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Edition</TableHead>
                      <TableHead className="text-center">Revision</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Prepared by</TableHead>
                      <TableHead>Reviewed by</TableHead>
                      <TableHead>Approved by</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterRows.map(row => (
                      <TableRow key={row.documentId} data-testid={`master-${row.documentCode}`}>
                        <TableCell className="font-mono">{row.documentCode}</TableCell>
                        <TableCell>
                          {row.googleUrl
                            ? <a href={row.googleUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">{row.title}<ExternalLink className="h-3 w-3" /></a>
                            : row.title}
                        </TableCell>
                        <TableCell>{typeLabel(row.category)}</TableCell>
                        <TableCell className="text-center">{row.editionNumber}</TableCell>
                        <TableCell className="text-center">{row.revisionNumber}</TableCell>
                        <TableCell>{day(row.issueDate)}</TableCell>
                        <TableCell>{row.preparedByName ?? "-"}</TableCell>
                        <TableCell>{row.reviewedByName ?? "-"}</TableCell>
                        <TableCell>{row.signedApprovedByName ?? "-"}</TableCell>
                        <TableCell>{label(row.classification)}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLES[row.status] ?? ""}>
                            {row.status === "under_revision" ? "Current · Under revision" : label(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{day(row.nextReviewDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
