import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, Eye, FolderOpen, File } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface UserRecord {
  id: number;
  userId: number;
  reportType: string;
  reportTitle: string;
  reportNumber: string;
  relatedDocumentId?: number;
  relatedEmployeeId?: number;
  pdfDataUrl?: string;
  reviewerName?: string;
  approverName?: string;
  createdAt: string;
  metadata?: string;
}

export default function UserRecords() {
  const [selectedRecord, setSelectedRecord] = useState<UserRecord | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const { data: records, isLoading } = useQuery<UserRecord[]>({
    queryKey: ["/api/user-records"],
  });

  const handleViewPdf = async (record: UserRecord) => {
    try {
      const response = await fetch(`/api/user-records/${record.id}/pdf`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPdfUrl(data.pdfUrl);
        setSelectedRecord(record);
        setPdfViewerOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch PDF:", error);
    }
  };

  const handleDownloadPdf = async (record: UserRecord) => {
    try {
      const response = await fetch(`/api/user-records/${record.id}/pdf`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const link = document.createElement("a");
        link.href = data.pdfUrl;
        link.download = `${record.reportNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Failed to download PDF:", error);
    }
  };

  const getReportTypeBadgeColor = (reportType: string) => {
    switch (reportType) {
      case "document_approval":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "staff_confirmation":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getReportTypeLabel = (reportType: string) => {
    switch (reportType) {
      case "document_approval":
        return "Document Approval";
      case "staff_confirmation":
        return "Staff Confirmation";
      default:
        return reportType;
    }
  };

  const parseMetadata = (metadata?: string) => {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center shadow-md">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Records</h1>
            <p className="text-muted-foreground text-sm">
              View and download your completion reports
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {records?.length || 0} Records
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <File className="w-5 h-5 text-cyan-600" />
            Completion Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records && records.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Related Item</TableHead>
                  <TableHead>Approver</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const metadata = parseMetadata(record.metadata);
                  return (
                    <TableRow key={record.id} data-testid={`record-row-${record.id}`}>
                      <TableCell className="font-mono text-sm font-medium">
                        {record.reportNumber}
                      </TableCell>
                      <TableCell>
                        <Badge className={getReportTypeBadgeColor(record.reportType)}>
                          {getReportTypeLabel(record.reportType)}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.reportTitle}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {metadata?.documentCode || metadata?.employeeName || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.approverName || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(record.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewPdf(record)}
                            data-testid={`view-pdf-${record.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleDownloadPdf(record)}
                            data-testid={`download-pdf-${record.id}`}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No Records Yet</h3>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-md">
                When documents you approve or employees you confirm are completed, 
                completion reports will appear here for your records.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={pdfViewerOpen} onOpenChange={setPdfViewerOpen}>
        <DialogContent className="max-w-4xl h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-600" />
              {selectedRecord?.reportTitle} - {selectedRecord?.reportNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg border">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="PDF Viewer"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
