import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileCheck, 
  ClipboardList, 
  Award, 
  Search,
  Building2,
  Calendar,
  User,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import CertificateDesigner from "@/components/CertificateDesigner";
import { useAuth } from "@/hooks/use-auth";

const ISO_STANDARDS = [
  { value: "ISO 9001:2015", label: "ISO 9001:2015 - Quality Management" },
  { value: "ISO 14001:2015", label: "ISO 14001:2015 - Environmental Management" },
  { value: "ISO 45001:2018", label: "ISO 45001:2018 - Occupational Health & Safety" },
  { value: "ISO 22000:2018", label: "ISO 22000:2018 - Food Safety" },
  { value: "ISO 27001:2022", label: "ISO 27001:2022 - Information Security" },
  { value: "ISO 50001:2018", label: "ISO 50001:2018 - Energy Management" },
];

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  audit_scheduled: "Audit Scheduled",
  stage1_complete: "Stage 1 Complete",
  stage2_scheduled: "Stage 2 Scheduled",
  stage2_complete: "Stage 2 Complete",
  pending_decision: "Pending Decision",
  approved: "Approved",
  certificate_issued: "Certificate Issued",
  rejected: "Rejected",
  suspended: "Suspended",
  withdrawn: "Withdrawn",
};

const AUDIT_TYPES = [
  { value: "stage1", label: "Stage 1 Audit" },
  { value: "stage2", label: "Stage 2 Audit" },
  { value: "surveillance1", label: "1st Surveillance Audit" },
  { value: "surveillance2", label: "2nd Surveillance Audit" },
  { value: "recertification", label: "Recertification Audit" },
  { value: "special", label: "Special Audit" },
];

// Status order checked by the server: one step forward, or rejected / suspended / withdrawn from an open application.
// "certificate_issued" is set by issuing the certificate.
const APPLICATION_FLOW = [
  "submitted", "under_review", "audit_scheduled", "stage1_complete", "stage2_scheduled",
  "stage2_complete", "pending_decision", "approved", "certificate_issued",
];
const MANAGER_DECISIONS = ["approved", "rejected", "suspended"];

function allowedStatuses(current: string, isManager: boolean): string[] {
  const idx = APPLICATION_FLOW.indexOf(current);
  if (idx === -1) return [current];
  const options = [current];
  const next = APPLICATION_FLOW[idx + 1];
  if (next && next !== "certificate_issued") options.push(next);
  options.push(...(current === "certificate_issued" ? ["suspended", "withdrawn"] : ["rejected", "suspended", "withdrawn"]));
  return options.filter(s => s === current || isManager || !MANAGER_DECISIONS.includes(s));
}

const AUDIT_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const AUDIT_RECOMMENDATIONS = [
  { value: "proceed_to_stage2", label: "Proceed to Stage 2" },
  { value: "recommend_certification", label: "Recommend certification" },
  { value: "recommend_after_corrective_actions", label: "Recommend after corrective actions are verified" },
  { value: "continue_certification", label: "Continue certification" },
  { value: "not_recommended", label: "Not recommended" },
];

const FINDING_TYPES = [
  { value: "major_nc", label: "Major NC" },
  { value: "minor_nc", label: "Minor NC" },
  { value: "observation", label: "Observation" },
  { value: "opportunity", label: "Opportunity for Improvement" },
];

const FINDING_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  pending_verification: "Pending Verification",
  closed: "Closed",
};

// Server errors arrive as `400: {"message": "..."}`; show just the message
function apiErrorMessage(error: Error): string {
  const raw = error.message.replace(/^\d+: /, "");
  try {
    return JSON.parse(raw).message || raw;
  } catch {
    return raw;
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "submitted":
    case "under_review":
      return "secondary";
    case "audit_scheduled":
    case "stage1_complete":
    case "stage2_scheduled":
    case "stage2_complete":
    case "pending_decision":
      return "default";
    case "approved":
    case "certificate_issued":
      return "default";
    case "rejected":
    case "suspended":
    case "withdrawn":
      return "destructive";
    default:
      return "secondary";
  }
}

interface CertificationApplication {
  id: number;
  applicationNumber: string;
  clientName: string;
  clientLocation: string;
  clientContactName?: string;
  clientContactEmail?: string;
  clientContactPhone?: string;
  isoStandard: string;
  standardName: string;
  sectorCode?: string;
  certificationScope: string;
  status: string;
  assignedAuditorId?: number | null;
  leadAuditorId?: number | null;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Certificate {
  id: number;
  applicationId: number;
  certificateNumber: string;
  clientName: string;
  clientLocation?: string;
  isoStandard: string;
  standardName: string;
  sectorCode?: string;
  certificationScope: string;
  issueDate: string;
  expiryDate: string;
  firstSurveillanceDate?: string;
  secondSurveillanceDate?: string;
  status: string;
  certificateImageUrl?: string;
  certificatePdfUrl?: string;
  leftBackgroundImage?: string;
  rightBackgroundImage?: string;
}

interface CertificationAudit {
  id: number;
  applicationId: number;
  auditType: string;
  scheduledDate?: string | null;
  completedDate?: string | null;
  status: string;
  leadAuditorId?: number | null;
  auditTeamIds?: string | null;
  recommendation?: string | null;
  notes?: string | null;
}

interface AuditFinding {
  id: number;
  auditId: number;
  findingNumber: string;
  findingType: string;
  clauseReference?: string | null;
  description: string;
  objectiveEvidence?: string | null;
  status: string;
  correctiveAction?: string | null;
  targetClosureDate?: string | null;
  verifiedAt?: string | null;
  verifiedById?: number | null;
}

type AuditorOption = { id: number; name: string; role: string };

export default function CertificationProcess() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("applications");
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewAppDialogOpen, setIsNewAppDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<CertificationApplication | null>(null);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [designerApplication, setDesignerApplication] = useState<CertificationApplication | null>(null);

  const { data: applications = [], isLoading: loadingApps } = useQuery<CertificationApplication[]>({
    queryKey: ["/api/certification-applications"],
  });

  const { data: certificates = [], isLoading: loadingCerts } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
  });

  const { data: users = [] } = useQuery<Array<{ id: number; name: string; role: string }>>({
    queryKey: ["/api/users"],
  });

  const auditors = users.filter(u => u.role === "auditor" || u.role === "admin" || u.role === "quality_manager");
  const userName = (id?: number | null) => (id ? users.find(u => u.id === id)?.name || `User #${id}` : "Unassigned");

  const { data: currentUser } = useAuth();
  const isManager = !!currentUser && (currentUser.role === "admin" || currentUser.role === "quality_manager" || currentUser.email === "coo@sahihcertify.com");

  const createApplicationMutation = useMutation({
    mutationFn: async (data: Partial<CertificationApplication>) => {
      return apiRequest("POST", "/api/certification-applications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certification-applications"] });
      toast({ title: "Application created successfully" });
      setIsNewAppDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error creating application", description: apiErrorMessage(error), variant: "destructive" });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CertificationApplication> }) => {
      const res = await apiRequest("PUT", `/api/certification-applications/${id}`, data);
      return res.json() as Promise<CertificationApplication>;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/certification-applications"] });
      toast({ title: "Application updated successfully" });
      // keep the details open so the reviewer can continue (assign, plan audits...)
      setSelectedApplication(updated);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating application", description: apiErrorMessage(error), variant: "destructive" });
    },
  });

  const filteredApplications = applications.filter(app =>
    app.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.isoStandard.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCertificates = certificates.filter(cert =>
    cert.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.certificateNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewApplication = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const isoStandard = formData.get("isoStandard") as string;
    const standardInfo = ISO_STANDARDS.find(s => s.value === isoStandard);
    
    createApplicationMutation.mutate({
      clientName: formData.get("clientName") as string,
      clientLocation: formData.get("clientLocation") as string,
      clientContactName: formData.get("clientContactName") as string,
      clientContactEmail: formData.get("clientContactEmail") as string,
      clientContactPhone: formData.get("clientContactPhone") as string,
      isoStandard: isoStandard,
      standardName: standardInfo?.label.split(" - ")[1] || isoStandard,
      sectorCode: formData.get("sectorCode") as string,
      certificationScope: formData.get("certificationScope") as string,
    });
  };

  const handleOpenDesigner = (app: CertificationApplication) => {
    setDesignerApplication(app);
    setIsDesignerOpen(true);
  };

  const handleCertificateCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/certification-applications"] });
    setIsDesignerOpen(false);
    setDesignerApplication(null);
    toast({ title: "Certificate created successfully" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Certification Process</h1>
          <p className="text-muted-foreground">Manage certification applications from review to certificate issuance</p>
        </div>
        <Dialog open={isNewAppDialogOpen} onOpenChange={setIsNewAppDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-application">
              <Plus className="h-4 w-4 mr-2" />
              New Application
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Certification Application</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleNewApplication} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="clientName">Client / Organization Name *</Label>
                  <Input id="clientName" name="clientName" required data-testid="input-client-name" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="clientLocation">Location *</Label>
                  <Input id="clientLocation" name="clientLocation" required data-testid="input-client-location" />
                </div>
                <div>
                  <Label htmlFor="clientContactName">Contact Name</Label>
                  <Input id="clientContactName" name="clientContactName" data-testid="input-contact-name" />
                </div>
                <div>
                  <Label htmlFor="clientContactEmail">Contact Email</Label>
                  <Input id="clientContactEmail" name="clientContactEmail" type="email" data-testid="input-contact-email" />
                </div>
                <div>
                  <Label htmlFor="clientContactPhone">Contact Phone</Label>
                  <Input id="clientContactPhone" name="clientContactPhone" data-testid="input-contact-phone" />
                </div>
                <div>
                  <Label htmlFor="isoStandard">ISO Standard *</Label>
                  <Select name="isoStandard" required>
                    <SelectTrigger data-testid="select-iso-standard">
                      <SelectValue placeholder="Select standard" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISO_STANDARDS.map(std => (
                        <SelectItem key={std.value} value={std.value}>{std.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sectorCode">Sector Code</Label>
                  <Input id="sectorCode" name="sectorCode" placeholder="e.g., EA 28" data-testid="input-sector-code" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="certificationScope">Certification Scope *</Label>
                  <Textarea 
                    id="certificationScope" 
                    name="certificationScope" 
                    required 
                    placeholder="Describe the scope of certification..."
                    data-testid="input-certification-scope"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsNewAppDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createApplicationMutation.isPending} data-testid="button-submit-application">
                  {createApplicationMutation.isPending ? "Creating..." : "Create Application"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search applications or certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="applications" data-testid="tab-applications">
            <ClipboardList className="h-4 w-4 mr-2" />
            Applications ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="certificates" data-testid="tab-certificates">
            <Award className="h-4 w-4 mr-2" />
            Certificates ({certificates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          {loadingApps ? (
            <div className="text-center py-8 text-muted-foreground">Loading applications...</div>
          ) : filteredApplications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No certification applications found</p>
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={() => setIsNewAppDialogOpen(true)}
                >
                  Create First Application
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredApplications.map(app => (
                <Card key={app.id} className="hover-elevate" data-testid={`card-application-${app.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(app.status)}>
                            {APPLICATION_STATUS_LABELS[app.status] || app.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{app.applicationNumber}</span>
                        </div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {app.clientName}
                        </h3>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileCheck className="h-4 w-4" />
                            {app.isoStandard}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(app.createdAt), "MMM d, yyyy")}
                          </span>
                          {(app.leadAuditorId || app.assignedAuditorId) && (
                            <span className="flex items-center gap-1" data-testid={`text-application-auditors-${app.id}`}>
                              <User className="h-4 w-4" />
                              {app.leadAuditorId ? `Lead: ${userName(app.leadAuditorId)}` : ""}
                              {app.leadAuditorId && app.assignedAuditorId ? " · " : ""}
                              {app.assignedAuditorId ? `Auditor: ${userName(app.assignedAuditorId)}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{app.certificationScope}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedApplication(app)}
                          data-testid={`button-view-application-${app.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {app.status === "approved" && isManager && (
                          <Button 
                            size="sm"
                            onClick={() => handleOpenDesigner(app)}
                            data-testid={`button-issue-certificate-${app.id}`}
                          >
                            <Award className="h-4 w-4 mr-1" />
                            Issue Certificate
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certificates" className="space-y-4">
          {loadingCerts ? (
            <div className="text-center py-8 text-muted-foreground">Loading certificates...</div>
          ) : filteredCertificates.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No certificates issued yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCertificates.map(cert => (
                <Card key={cert.id} className="hover-elevate" data-testid={`card-certificate-${cert.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={cert.status === "active" ? "default" : "secondary"}>
                        {cert.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{cert.certificateNumber}</span>
                    </div>
                    <CardTitle className="text-base">{cert.clientName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">{cert.isoStandard}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Issued: {format(new Date(cert.issueDate), "MMM d, yyyy")}</span>
                      <span>Expires: {format(new Date(cert.expiryDate), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1" data-testid={`button-view-cert-${cert.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedApplication && (
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Application Details - {selectedApplication.applicationNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Client Name</Label>
                  <p className="font-medium">{selectedApplication.clientName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="font-medium">{selectedApplication.clientLocation}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ISO Standard</Label>
                  <p className="font-medium">{selectedApplication.isoStandard}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={getStatusBadgeVariant(selectedApplication.status)}>
                    {APPLICATION_STATUS_LABELS[selectedApplication.status]}
                  </Badge>
                </div>
                {selectedApplication.sectorCode && (
                  <div>
                    <Label className="text-muted-foreground">Sector Code</Label>
                    <p className="font-medium">{selectedApplication.sectorCode}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">
                    {selectedApplication.submittedAt 
                      ? format(new Date(selectedApplication.submittedAt), "PPP") 
                      : format(new Date(selectedApplication.createdAt), "PPP")}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Certification Scope</Label>
                <p className="mt-1 p-3 bg-muted rounded-md">{selectedApplication.certificationScope}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([["assignedAuditorId", "Auditor"], ["leadAuditorId", "Lead Auditor"]] as const).map(([field, label]) => (
                  <div key={field}>
                    <Label className="text-muted-foreground">{label}</Label>
                    <Select
                      value={selectedApplication[field] ? String(selectedApplication[field]) : "none"}
                      disabled={!isManager || updateApplicationMutation.isPending}
                      onValueChange={(value) => {
                        updateApplicationMutation.mutate({
                          id: selectedApplication.id,
                          data: { [field]: value === "none" ? null : Number(value) },
                        });
                      }}
                    >
                      <SelectTrigger className="mt-2" data-testid={`select-${field === "leadAuditorId" ? "lead-auditor" : "auditor"}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {auditors.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.role.replace(/_/g, " ")})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {!isManager && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">Only managers can assign the auditor and lead auditor.</p>
                )}
              </div>

              <div>
                <Label className="text-muted-foreground">Update Status</Label>
                <div className="flex gap-2 mt-2">
                  <Select
                    value={selectedApplication.status}
                    disabled={updateApplicationMutation.isPending}
                    onValueChange={(value) => {
                      if (value === selectedApplication.status) return;
                      updateApplicationMutation.mutate({
                        id: selectedApplication.id,
                        data: { status: value }
                      });
                    }}
                  >
                    <SelectTrigger className="w-[220px]" data-testid="select-update-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedStatuses(selectedApplication.status, isManager).map(value => (
                        <SelectItem key={value} value={value}>{APPLICATION_STATUS_LABELS[value] || value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ApplicationAudits application={selectedApplication} auditors={auditors} userName={userName} isManager={isManager} />

              {selectedApplication.status === "approved" && isManager && (
                <div className="pt-4 border-t">
                  <Button onClick={() => handleOpenDesigner(selectedApplication)} data-testid="button-prepare-certificate">
                    <Award className="h-4 w-4 mr-2" />
                    Prepare Certificate
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isDesignerOpen && designerApplication && (
        <CertificateDesigner
          isOpen={isDesignerOpen}
          onClose={() => {
            setIsDesignerOpen(false);
            setDesignerApplication(null);
          }}
          application={designerApplication}
          onCertificateCreated={handleCertificateCreated}
        />
      )}
    </div>
  );
}

// ---- Audits planned for an application (stage 1, stage 2, surveillance...) ----
function ApplicationAudits({
  application,
  auditors,
  userName,
  isManager,
}: {
  application: CertificationApplication;
  auditors: AuditorOption[];
  userName: (id?: number | null) => string;
  isManager: boolean;
}) {
  const { toast } = useToast();
  const auditsKey = [`/api/certification-audits?applicationId=${application.id}`];
  const { data: audits = [], isLoading } = useQuery<CertificationAudit[]>({ queryKey: auditsKey });
  const [showNewAudit, setShowNewAudit] = useState(false);
  const emptyAudit = () => ({
    auditType: "stage1",
    scheduledDate: "",
    leadAuditorId: application.leadAuditorId ?? application.assignedAuditorId ?? null,
    notes: "",
  });
  const [newAudit, setNewAudit] = useState(emptyAudit);
  const isClosed = ["certificate_issued", "rejected", "suspended", "withdrawn"].includes(application.status);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: auditsKey });
    queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
  };

  const createAuditMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/certification-audits", { applicationId: application.id, ...newAudit }),
    onSuccess: () => {
      refresh();
      setShowNewAudit(false);
      setNewAudit(emptyAudit());
      toast({ title: "Audit planned" });
    },
    onError: (error: Error) => toast({ title: "Could not plan the audit", description: apiErrorMessage(error), variant: "destructive" }),
  });

  const updateAuditMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => apiRequest("PUT", `/api/certification-audits/${id}`, data),
    onSuccess: () => {
      refresh();
      toast({ title: "Audit updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update the audit", description: apiErrorMessage(error), variant: "destructive" }),
  });

  return (
    <div className="pt-4 border-t space-y-3" data-testid="section-audits">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Audits ({audits.length})
        </h3>
        {!isClosed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // default the lead auditor from the application's current assignment
              if (!showNewAudit) setNewAudit(emptyAudit());
              setShowNewAudit(v => !v);
            }}
            data-testid="button-new-audit"
          >
            <Plus className="h-4 w-4 mr-1" />
            Plan Audit
          </Button>
        )}
      </div>

      {showNewAudit && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Audit Type *</Label>
                <Select value={newAudit.auditType} onValueChange={(v) => setNewAudit(a => ({ ...a, auditType: v }))}>
                  <SelectTrigger data-testid="select-new-audit-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scheduled Date</Label>
                <Input
                  type="date"
                  value={newAudit.scheduledDate}
                  onChange={(e) => setNewAudit(a => ({ ...a, scheduledDate: e.target.value }))}
                  data-testid="input-new-audit-date"
                />
              </div>
              <div>
                <Label>Lead Auditor</Label>
                <Select
                  value={newAudit.leadAuditorId ? String(newAudit.leadAuditorId) : "none"}
                  onValueChange={(v) => setNewAudit(a => ({ ...a, leadAuditorId: v === "none" ? null : Number(v) }))}
                >
                  <SelectTrigger data-testid="select-new-audit-lead"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not assigned</SelectItem>
                    {auditors.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newAudit.notes}
                onChange={(e) => setNewAudit(a => ({ ...a, notes: e.target.value }))}
                placeholder="Audit scope, sites, team..."
                rows={2}
                data-testid="input-new-audit-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewAudit(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createAuditMutation.mutate()} disabled={createAuditMutation.isPending} data-testid="button-create-audit">
                {createAuditMutation.isPending ? "Saving..." : "Plan Audit"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading audits...</p>
      ) : audits.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-audits">No audits planned yet.</p>
      ) : (
        audits.map(audit => (
          <AuditCard
            key={audit.id}
            audit={audit}
            userName={userName}
            isManager={isManager}
            updating={updateAuditMutation.isPending}
            onUpdate={(data) => updateAuditMutation.mutate({ id: audit.id, data })}
          />
        ))
      )}
    </div>
  );
}

function AuditCard({
  audit,
  userName,
  isManager,
  updating,
  onUpdate,
}: {
  audit: CertificationAudit;
  userName: (id?: number | null) => string;
  isManager: boolean;
  updating: boolean;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const [recommendation, setRecommendation] = useState(audit.recommendation || "");
  const locked = audit.status === "completed" || audit.status === "cancelled";
  const typeLabel = AUDIT_TYPES.find(t => t.value === audit.auditType)?.label || audit.auditType;
  const recommendationLabel = (value?: string | null) => AUDIT_RECOMMENDATIONS.find(r => r.value === value)?.label || value;

  return (
    <Card data-testid={`card-audit-${audit.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="font-medium">{typeLabel}</div>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {audit.scheduledDate ? format(new Date(audit.scheduledDate), "MMM d, yyyy") : "Not scheduled"}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Lead: {userName(audit.leadAuditorId)}
              </span>
              {audit.completedDate && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Completed {format(new Date(audit.completedDate), "MMM d, yyyy")}
                </span>
              )}
            </div>
            {audit.notes && <p className="text-sm text-muted-foreground">{audit.notes}</p>}
          </div>
          <Badge variant={audit.status === "completed" ? "default" : audit.status === "cancelled" ? "destructive" : "secondary"} data-testid={`badge-audit-status-${audit.id}`}>
            {AUDIT_STATUS_LABELS[audit.status] || audit.status}
          </Badge>
        </div>

        {locked ? (
          audit.recommendation && (
            <p className="text-sm" data-testid={`text-audit-recommendation-${audit.id}`}>
              <span className="text-muted-foreground">Recommendation:</span> {recommendationLabel(audit.recommendation)}
            </p>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[150px_160px_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={audit.status} disabled={updating} onValueChange={(v) => v !== audit.status && onUpdate({ status: v })}>
                <SelectTrigger data-testid={`select-audit-status-${audit.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Scheduled Date</Label>
              <Input
                type="date"
                defaultValue={audit.scheduledDate ? format(new Date(audit.scheduledDate), "yyyy-MM-dd") : ""}
                onBlur={(e) => {
                  const current = audit.scheduledDate ? format(new Date(audit.scheduledDate), "yyyy-MM-dd") : "";
                  if (e.target.value !== current) onUpdate({ scheduledDate: e.target.value });
                }}
                data-testid={`input-audit-date-${audit.id}`}
              />
            </div>
            <div>
              <Label className="text-xs">Recommendation</Label>
              <Select value={recommendation} onValueChange={setRecommendation}>
                <SelectTrigger data-testid={`select-audit-recommendation-${audit.id}`}><SelectValue placeholder="Select recommendation" /></SelectTrigger>
                <SelectContent>
                  {AUDIT_RECOMMENDATIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => onUpdate({ status: "completed", recommendation })}
              disabled={!recommendation || updating}
              data-testid={`button-complete-audit-${audit.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Complete Audit
            </Button>
          </div>
        )}

        <AuditFindings audit={audit} />
      </CardContent>
    </Card>
  );
}

// ---- Findings of one audit: record, add corrective action, verify and close ----
function AuditFindings({ audit }: { audit: CertificationAudit }) {
  const { toast } = useToast();
  const findingsKey = [`/api/audit-findings?auditId=${audit.id}`];
  const { data: findings = [] } = useQuery<AuditFinding[]>({ queryKey: findingsKey });
  const [showNewFinding, setShowNewFinding] = useState(false);
  const emptyFinding = { findingType: "minor_nc", clauseReference: "", description: "", objectiveEvidence: "", targetClosureDate: "" };
  const [newFinding, setNewFinding] = useState(emptyFinding);
  const [actionDrafts, setActionDrafts] = useState<Record<number, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const locked = audit.status === "completed" || audit.status === "cancelled";
  const openMajor = findings.filter(f => f.findingType === "major_nc" && f.status !== "closed").length;

  const createFindingMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/audit-findings", { auditId: audit.id, ...newFinding }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: findingsKey });
      setShowNewFinding(false);
      setNewFinding(emptyFinding);
      toast({ title: "Finding recorded" });
    },
    onError: (error: Error) => toast({ title: "Could not record the finding", description: apiErrorMessage(error), variant: "destructive" }),
  });

  const updateFindingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => apiRequest("PUT", `/api/audit-findings/${id}`, data),
    onSuccess: (_res, { id }) => {
      queryClient.invalidateQueries({ queryKey: findingsKey });
      setActionDrafts(d => ({ ...d, [id]: "" }));
      setNoteDrafts(d => ({ ...d, [id]: "" }));
      toast({ title: "Finding updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update the finding", description: apiErrorMessage(error), variant: "destructive" }),
  });

  const findingTypeLabel = (value: string) => FINDING_TYPES.find(t => t.value === value)?.label || value;

  return (
    <div className="border-t pt-3 space-y-2" data-testid={`section-findings-${audit.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Findings ({findings.length})
          {openMajor > 0 && <Badge variant="destructive">{openMajor} open major NC</Badge>}
        </h4>
        {!locked && (
          <Button size="sm" variant="ghost" onClick={() => setShowNewFinding(v => !v)} data-testid={`button-new-finding-${audit.id}`}>
            <Plus className="h-4 w-4 mr-1" />
            Add Finding
          </Button>
        )}
      </div>

      {showNewFinding && (
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Type *</Label>
              <Select value={newFinding.findingType} onValueChange={(v) => setNewFinding(f => ({ ...f, findingType: v }))}>
                <SelectTrigger data-testid="select-new-finding-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINDING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Clause</Label>
              <Input
                value={newFinding.clauseReference}
                onChange={(e) => setNewFinding(f => ({ ...f, clauseReference: e.target.value }))}
                placeholder="e.g. 7.5.3"
                data-testid="input-new-finding-clause"
              />
            </div>
            <div>
              <Label className="text-xs">Target Closure</Label>
              <Input
                type="date"
                value={newFinding.targetClosureDate}
                onChange={(e) => setNewFinding(f => ({ ...f, targetClosureDate: e.target.value }))}
                data-testid="input-new-finding-target"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description *</Label>
            <Textarea
              value={newFinding.description}
              onChange={(e) => setNewFinding(f => ({ ...f, description: e.target.value }))}
              rows={2}
              data-testid="input-new-finding-description"
            />
          </div>
          <div>
            <Label className="text-xs">Objective Evidence</Label>
            <Textarea
              value={newFinding.objectiveEvidence}
              onChange={(e) => setNewFinding(f => ({ ...f, objectiveEvidence: e.target.value }))}
              rows={2}
              data-testid="input-new-finding-evidence"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowNewFinding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createFindingMutation.mutate()} disabled={createFindingMutation.isPending} data-testid="button-create-finding">
              {createFindingMutation.isPending ? "Saving..." : "Record Finding"}
            </Button>
          </div>
        </div>
      )}

      {findings.length === 0 && !showNewFinding && (
        <p className="text-sm text-muted-foreground">No findings recorded.</p>
      )}

      {findings.map(f => (
        <div key={f.id} className="rounded-md border p-3 space-y-2 text-sm" data-testid={`row-finding-${f.id}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{f.findingNumber}</span>
            <Badge variant={f.findingType === "major_nc" ? "destructive" : f.findingType === "minor_nc" ? "default" : "secondary"}>
              {findingTypeLabel(f.findingType)}
            </Badge>
            {f.clauseReference && <span className="text-xs text-muted-foreground">Clause {f.clauseReference}</span>}
            <Badge variant="outline" className="ml-auto" data-testid={`badge-finding-status-${f.id}`}>
              {f.status === "closed" ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
              {FINDING_STATUS_LABELS[f.status] || f.status}
            </Badge>
          </div>
          <p>{f.description}</p>
          {f.objectiveEvidence && <p className="text-xs text-muted-foreground">Evidence: {f.objectiveEvidence}</p>}
          {f.targetClosureDate && (
            <p className="text-xs text-muted-foreground">Target closure: {format(new Date(f.targetClosureDate), "MMM d, yyyy")}</p>
          )}
          {f.correctiveAction && (
            <p className="text-xs"><span className="font-medium">Corrective action:</span> {f.correctiveAction}</p>
          )}
          {f.status === "closed" && f.verifiedAt && (
            <p className="text-xs text-green-700 dark:text-green-400">Verified and closed {format(new Date(f.verifiedAt), "MMM d, yyyy")}</p>
          )}

          {f.status === "open" && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Textarea
                value={actionDrafts[f.id] || ""}
                onChange={(e) => setActionDrafts(d => ({ ...d, [f.id]: e.target.value }))}
                placeholder="Corrective action taken by the client"
                rows={2}
                className="flex-1"
                data-testid={`input-corrective-action-${f.id}`}
              />
              <Button
                size="sm"
                disabled={!actionDrafts[f.id]?.trim() || updateFindingMutation.isPending}
                onClick={() => updateFindingMutation.mutate({ id: f.id, data: { correctiveAction: actionDrafts[f.id] } })}
                data-testid={`button-add-corrective-action-${f.id}`}
              >
                Add Corrective Action
              </Button>
            </div>
          )}
          {f.status === "open" && (f.findingType === "observation" || f.findingType === "opportunity") && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={noteDrafts[f.id] || ""}
                onChange={(e) => setNoteDrafts(d => ({ ...d, [f.id]: e.target.value }))}
                placeholder="Verification note (no corrective action needed)"
                className="flex-1"
                data-testid={`input-verification-note-${f.id}`}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!noteDrafts[f.id]?.trim() || updateFindingMutation.isPending}
                onClick={() => updateFindingMutation.mutate({ id: f.id, data: { status: "closed", verificationNote: noteDrafts[f.id] } })}
                data-testid={`button-close-with-note-${f.id}`}
              >
                Close with Note
              </Button>
            </div>
          )}
          {f.status === "pending_verification" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={updateFindingMutation.isPending}
                onClick={() => updateFindingMutation.mutate({ id: f.id, data: { status: "closed" } })}
                data-testid={`button-verify-close-${f.id}`}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Verify & Close
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={updateFindingMutation.isPending}
                onClick={() => updateFindingMutation.mutate({ id: f.id, data: { status: "open" } })}
                data-testid={`button-reject-action-${f.id}`}
              >
                Not Effective - Reopen
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
