import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, Save, Eye, FileImage } from "lucide-react";
import { format, addYears, addMonths } from "date-fns";
import sahihLogo from "@assets/sahih_logo_transparent.png";

const ISO_STANDARDS = [
  { value: "ISO 9001:2015", label: "ISO 9001:2015", name: "Quality Management System" },
  { value: "ISO 14001:2015", label: "ISO 14001:2015", name: "Environmental Management System" },
  { value: "ISO 45001:2018", label: "ISO 45001:2018", name: "Occupational Health & Safety Management System" },
  { value: "ISO 22000:2018", label: "ISO 22000:2018", name: "Food Safety Management System" },
  { value: "ISO 27001:2022", label: "ISO 27001:2022", name: "Information Security Management System" },
  { value: "ISO 50001:2018", label: "ISO 50001:2018", name: "Energy Management System" },
];

interface CertificateDesignerProps {
  isOpen: boolean;
  onClose: () => void;
  application: {
    id: number;
    clientName: string;
    clientLocation: string;
    isoStandard: string;
    standardName: string;
    sectorCode?: string;
    certificationScope: string;
  };
  onCertificateCreated: () => void;
}

export default function CertificateDesigner({ 
  isOpen, 
  onClose, 
  application,
  onCertificateCreated 
}: CertificateDesignerProps) {
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  
  const today = new Date();
  const threeYearsLater = addYears(today, 3);
  const oneYearLater = addYears(today, 1);
  const twoYearsLater = addYears(today, 2);

  const [formData, setFormData] = useState({
    clientName: application.clientName,
    clientLocation: application.clientLocation,
    isoStandard: application.isoStandard,
    standardName: ISO_STANDARDS.find(s => s.value === application.isoStandard)?.name || application.standardName,
    sectorCode: application.sectorCode || "",
    certificationScope: application.certificationScope,
    certificateNumber: generateCertNumber(application.isoStandard),
    issueDate: format(today, "yyyy-MM-dd"),
    expiryDate: format(threeYearsLater, "yyyy-MM-dd"),
    firstSurveillanceDate: format(oneYearLater, "yyyy-MM-dd"),
    secondSurveillanceDate: format(twoYearsLater, "yyyy-MM-dd"),
  });

  function generateCertNumber(standard: string): string {
    const year = new Date().getFullYear();
    const stdCode = standard.split(":")[0].replace("ISO ", "");
    const random = Math.floor(Math.random() * 999).toString().padStart(3, "0");
    return `SC-QTR-${year}-${stdCode}-${random}`;
  }

  const createCertificateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/certificates", {
        applicationId: application.id,
        certificateNumber: formData.certificateNumber,
        clientName: formData.clientName,
        clientLocation: formData.clientLocation,
        isoStandard: formData.isoStandard,
        standardName: formData.standardName,
        sectorCode: formData.sectorCode,
        certificationScope: formData.certificationScope,
        issueDate: new Date(formData.issueDate).toISOString(),
        expiryDate: new Date(formData.expiryDate).toISOString(),
        firstSurveillanceDate: formData.firstSurveillanceDate ? new Date(formData.firstSurveillanceDate).toISOString() : null,
        secondSurveillanceDate: formData.secondSurveillanceDate ? new Date(formData.secondSurveillanceDate).toISOString() : null,
        status: "active",
      });
    },
    onSuccess: () => {
      onCertificateCreated();
    },
    onError: (error: Error) => {
      toast({ title: "Error creating certificate", description: error.message, variant: "destructive" });
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === "isoStandard") {
      const stdInfo = ISO_STANDARDS.find(s => s.value === value);
      if (stdInfo) {
        setFormData(prev => ({ 
          ...prev, 
          isoStandard: value,
          standardName: stdInfo.name,
          certificateNumber: generateCertNumber(value)
        }));
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Certificate Designer</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 flex-1 overflow-hidden">
          <div className="w-1/3 overflow-y-auto space-y-4 pr-2">
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold">Certificate Details</h3>
                
                <div>
                  <Label htmlFor="clientName">Client / Organization Name</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => handleChange("clientName", e.target.value)}
                    data-testid="input-cert-client-name"
                  />
                </div>

                <div>
                  <Label htmlFor="clientLocation">Location</Label>
                  <Input
                    id="clientLocation"
                    value={formData.clientLocation}
                    onChange={(e) => handleChange("clientLocation", e.target.value)}
                    data-testid="input-cert-location"
                  />
                </div>

                <div>
                  <Label htmlFor="isoStandard">ISO Standard</Label>
                  <Select value={formData.isoStandard} onValueChange={(v) => handleChange("isoStandard", v)}>
                    <SelectTrigger data-testid="select-cert-standard">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISO_STANDARDS.map(std => (
                        <SelectItem key={std.value} value={std.value}>{std.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="standardName">Standard Name</Label>
                  <Input
                    id="standardName"
                    value={formData.standardName}
                    onChange={(e) => handleChange("standardName", e.target.value)}
                    data-testid="input-cert-standard-name"
                  />
                </div>

                <div>
                  <Label htmlFor="sectorCode">Sector Code</Label>
                  <Input
                    id="sectorCode"
                    value={formData.sectorCode}
                    onChange={(e) => handleChange("sectorCode", e.target.value)}
                    placeholder="e.g., EA 28"
                    data-testid="input-cert-sector-code"
                  />
                </div>

                <div>
                  <Label htmlFor="certificationScope">Certification Scope</Label>
                  <Textarea
                    id="certificationScope"
                    value={formData.certificationScope}
                    onChange={(e) => handleChange("certificationScope", e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-cert-scope"
                  />
                </div>

                <div>
                  <Label htmlFor="certificateNumber">Certificate Number</Label>
                  <Input
                    id="certificateNumber"
                    value={formData.certificateNumber}
                    onChange={(e) => handleChange("certificateNumber", e.target.value)}
                    data-testid="input-cert-number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="issueDate">Issue Date</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => handleChange("issueDate", e.target.value)}
                      data-testid="input-cert-issue-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => handleChange("expiryDate", e.target.value)}
                      data-testid="input-cert-expiry-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="firstSurveillanceDate">1st Surveillance</Label>
                    <Input
                      id="firstSurveillanceDate"
                      type="date"
                      value={formData.firstSurveillanceDate}
                      onChange={(e) => handleChange("firstSurveillanceDate", e.target.value)}
                      data-testid="input-cert-surv1-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="secondSurveillanceDate">2nd Surveillance</Label>
                    <Input
                      id="secondSurveillanceDate"
                      type="date"
                      value={formData.secondSurveillanceDate}
                      onChange={(e) => handleChange("secondSurveillanceDate", e.target.value)}
                      data-testid="input-cert-surv2-date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                onClick={() => createCertificateMutation.mutate()} 
                disabled={createCertificateMutation.isPending}
                className="flex-1"
                data-testid="button-save-certificate"
              >
                <Save className="h-4 w-4 mr-2" />
                {createCertificateMutation.isPending ? "Saving..." : "Save Certificate"}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-muted/30 rounded-lg p-4">
            <div className="text-sm font-medium mb-2 text-muted-foreground">Live Preview</div>
            <div 
              ref={previewRef}
              className="bg-white shadow-lg mx-auto"
              style={{ 
                width: "794px", 
                minHeight: "1123px",
                transform: "scale(0.7)",
                transformOrigin: "top left",
              }}
            >
              <div className="relative p-8" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #f0fdf4 100%)" }}>
                <div className="absolute inset-0 opacity-5">
                  <div 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-9xl font-bold text-cyan-900 rotate-[-30deg]"
                    style={{ fontSize: "200px" }}
                  >
                    SAHIH
                  </div>
                </div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <img 
                      src={sahihLogo} 
                      alt="Sahih Certifications" 
                      className="h-16"
                    />
                    <div className="text-right text-xs text-muted-foreground">
                      <div>UKAS Accredited</div>
                      <div>IAF MLA Signatory</div>
                    </div>
                  </div>

                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-cyan-700 tracking-wide">
                      Certificate of Registration
                    </h1>
                    <div className="w-32 h-1 bg-gradient-to-r from-cyan-500 to-teal-500 mx-auto mt-3"></div>
                  </div>

                  <div className="text-center mb-6">
                    <p className="text-gray-600 mb-2">This is to certify that</p>
                    <h2 className="text-2xl font-bold text-gray-800 mb-1">
                      {formData.clientName || "CLIENT NAME"}
                    </h2>
                    <p className="text-gray-600">{formData.clientLocation || "Location"}</p>
                  </div>

                  <div className="text-center mb-6">
                    <p className="text-gray-600 mb-2">has been assessed and certified as meeting the requirements of</p>
                    <h3 className="text-xl font-bold text-cyan-700 mb-1">
                      {formData.isoStandard}
                    </h3>
                    <p className="text-lg font-semibold text-gray-700">
                      {formData.standardName.toUpperCase()}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2 font-medium">Scope of Certification:</p>
                    <p className="text-gray-800">
                      {formData.certificationScope || "Your certification scope will appear here"}
                    </p>
                  </div>

                  <p className="text-center text-sm text-gray-600 mb-6">
                    The above-mentioned organization, scope, and standard have been audited<br />
                    and found to be in compliance with the applicable requirements.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                    <div className="bg-white rounded p-3 border">
                      <div className="text-gray-500">Certificate No:</div>
                      <div className="font-mono font-bold">{formData.certificateNumber}</div>
                    </div>
                    <div className="bg-white rounded p-3 border">
                      <div className="text-gray-500">Issue Date:</div>
                      <div className="font-bold">{formData.issueDate ? format(new Date(formData.issueDate), "dd-MM-yyyy") : ""}</div>
                    </div>
                    <div className="bg-white rounded p-3 border">
                      <div className="text-gray-500">Expiry Date:</div>
                      <div className="font-bold">{formData.expiryDate ? format(new Date(formData.expiryDate), "dd-MM-yyyy") : ""}</div>
                    </div>
                    <div className="bg-white rounded p-3 border">
                      <div className="text-gray-500">Surveillance:</div>
                      <div className="text-xs">
                        1st: {formData.firstSurveillanceDate ? format(new Date(formData.firstSurveillanceDate), "dd-MM-yyyy") : ""}<br />
                        2nd: {formData.secondSurveillanceDate ? format(new Date(formData.secondSurveillanceDate), "dd-MM-yyyy") : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-6">
                    <div className="text-center">
                      <div className="w-32 h-16 border-b-2 border-gray-300 mb-2 flex items-end justify-center">
                        <span className="text-gray-400 italic text-xs">Signature</span>
                      </div>
                      <div className="text-sm font-bold">Nazif Ahammad</div>
                      <div className="text-xs text-gray-500">Chief Operating Officer</div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">
                        UKAS
                      </div>
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">
                        SEAL
                      </div>
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">
                        IAF
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-xs text-gray-500 border-t pt-4">
                    <p>Sahih Certifications | PO 2120, Old Airport Area, D-Ring Road, Doha, State of Qatar | www.sahihcertify.com</p>
                    <p className="mt-1 italic">
                      This certification is granted, maintained and continued as per the rules and regulations of certification of Sahih Certifications.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
