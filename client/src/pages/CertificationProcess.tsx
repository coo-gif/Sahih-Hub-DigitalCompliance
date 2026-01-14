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
  assignedAuditorId?: number;
  leadAuditorId?: number;
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
      toast({ title: "Error creating application", description: error.message, variant: "destructive" });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CertificationApplication> }) => {
      return apiRequest("PUT", `/api/certification-applications/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certification-applications"] });
      toast({ title: "Application updated successfully" });
      setSelectedApplication(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating application", description: error.message, variant: "destructive" });
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
                        {(app.status === "approved" || app.status === "stage2_complete" || app.status === "pending_decision") && (
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

              <div>
                <Label className="text-muted-foreground">Update Status</Label>
                <div className="flex gap-2 mt-2">
                  <Select 
                    defaultValue={selectedApplication.status}
                    onValueChange={(value) => {
                      updateApplicationMutation.mutate({
                        id: selectedApplication.id,
                        data: { status: value }
                      });
                    }}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-update-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedApplication.status === "approved" && (
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
