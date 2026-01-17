import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

interface UserAgreementModalProps {
  isOpen: boolean;
  userName: string;
}

export function UserAgreementModal({ isOpen, userName }: UserAgreementModalProps) {
  const [hasReadAgreement, setHasReadAgreement] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedConfidentiality, setAcceptedConfidentiality] = useState(false);
  const [acceptedSecurity, setAcceptedSecurity] = useState(false);
  const [acceptedCompliance, setAcceptedCompliance] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const allAccepted = hasReadAgreement && acceptedTerms && acceptedConfidentiality && acceptedSecurity && acceptedCompliance;

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/auth/accept-agreement', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Agreement Accepted",
        description: "Thank you for accepting the user agreement. You may now proceed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept agreement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    if (allAccepted) {
      acceptMutation.mutate();
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                User Agreement & Security Policy
              </DialogTitle>
              <DialogDescription className="mt-1">
                ISO 27001 Compliance | Sahih Certifications QMS
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-6 py-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Important Notice</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Welcome, <strong>{userName}</strong>. Before accessing the Quality Management System, 
                    you must read and accept the following terms and conditions. This agreement is mandatory 
                    for all employees as per ISO 27001 information security requirements.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">1. Terms of Use</h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <p>
                  <strong>1.1</strong> This Quality Management System (QMS) is the property of Sahih Certifications 
                  and is provided for authorized business use only.
                </p>
                <p>
                  <strong>1.2</strong> Access to this system is granted based on your role and responsibilities 
                  within the organization. You agree to use the system only for its intended purposes.
                </p>
                <p>
                  <strong>1.3</strong> You acknowledge that all activities within this system are logged and 
                  monitored for security and compliance purposes.
                </p>
                <p>
                  <strong>1.4</strong> Unauthorized access, modification, or distribution of system data or 
                  documents is strictly prohibited and may result in disciplinary action.
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">2. Confidentiality Agreement</h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <p>
                  <strong>2.1</strong> All information accessed through this system, including but not limited to 
                  client data, certification records, audit findings, and internal documents, is strictly confidential.
                </p>
                <p>
                  <strong>2.2</strong> You agree not to disclose, copy, distribute, or share any confidential 
                  information with unauthorized parties, whether internal or external to the organization.
                </p>
                <p>
                  <strong>2.3</strong> Confidentiality obligations continue to apply even after termination of 
                  employment or access privileges.
                </p>
                <p>
                  <strong>2.4</strong> Any suspected breach of confidentiality must be immediately reported to 
                  the Quality Manager or designated security officer.
                </p>
                <p>
                  <strong>2.5</strong> Client information and certification records shall be treated with the 
                  highest level of confidentiality in accordance with ISO 17021-1 requirements.
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">3. Information Security Policy (ISO 27001)</h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <p>
                  <strong>3.1 Access Control:</strong> You must protect your login credentials at all times. 
                  Never share your password or allow others to use your account. Log out when leaving your 
                  workstation unattended.
                </p>
                <p>
                  <strong>3.2 Password Security:</strong> Maintain strong passwords and change them periodically. 
                  Report any suspected compromise of your credentials immediately.
                </p>
                <p>
                  <strong>3.3 Data Protection:</strong> Handle all data according to its classification level. 
                  Personal data must be processed in compliance with applicable data protection regulations.
                </p>
                <p>
                  <strong>3.4 Clean Desk Policy:</strong> Ensure sensitive documents are not left visible on 
                  screens or desks when unattended. Lock screens when away from your workstation.
                </p>
                <p>
                  <strong>3.5 Incident Reporting:</strong> Report any security incidents, suspected breaches, 
                  or vulnerabilities to the IT Security team immediately.
                </p>
                <p>
                  <strong>3.6 Acceptable Use:</strong> System resources shall not be used for personal purposes, 
                  unauthorized software installation, or any activities that may compromise security.
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">4. Compliance Obligations</h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <p>
                  <strong>4.1</strong> You agree to comply with all applicable laws, regulations, and organizational 
                  policies while using this system.
                </p>
                <p>
                  <strong>4.2</strong> As an employee of an accredited certification body, you must maintain 
                  impartiality and avoid conflicts of interest in all activities.
                </p>
                <p>
                  <strong>4.3</strong> You are responsible for the accuracy and integrity of data you enter 
                  into the system.
                </p>
                <p>
                  <strong>4.4</strong> Document control procedures must be followed at all times. Only approved 
                  documents shall be used for certification activities.
                </p>
                <p>
                  <strong>4.5</strong> Any violations of this agreement may result in disciplinary action, 
                  including termination of employment and legal proceedings.
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Acknowledgment & Acceptance</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="hasRead"
                      checked={hasReadAgreement}
                      onCheckedChange={(checked) => setHasReadAgreement(checked === true)}
                      data-testid="checkbox-has-read"
                    />
                    <label htmlFor="hasRead" className="text-sm cursor-pointer leading-relaxed">
                      I confirm that I have read and understood all sections of this agreement.
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="acceptTerms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      data-testid="checkbox-accept-terms"
                    />
                    <label htmlFor="acceptTerms" className="text-sm cursor-pointer leading-relaxed">
                      I agree to the <strong>Terms of Use</strong> and will use the system only for authorized 
                      business purposes.
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="acceptConfidentiality"
                      checked={acceptedConfidentiality}
                      onCheckedChange={(checked) => setAcceptedConfidentiality(checked === true)}
                      data-testid="checkbox-accept-confidentiality"
                    />
                    <label htmlFor="acceptConfidentiality" className="text-sm cursor-pointer leading-relaxed">
                      I agree to the <strong>Confidentiality Agreement</strong> and will protect all sensitive 
                      information.
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="acceptSecurity"
                      checked={acceptedSecurity}
                      onCheckedChange={(checked) => setAcceptedSecurity(checked === true)}
                      data-testid="checkbox-accept-security"
                    />
                    <label htmlFor="acceptSecurity" className="text-sm cursor-pointer leading-relaxed">
                      I agree to comply with the <strong>Information Security Policy (ISO 27001)</strong> and 
                      will follow all security procedures.
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="acceptCompliance"
                      checked={acceptedCompliance}
                      onCheckedChange={(checked) => setAcceptedCompliance(checked === true)}
                      data-testid="checkbox-accept-compliance"
                    />
                    <label htmlFor="acceptCompliance" className="text-sm cursor-pointer leading-relaxed">
                      I understand and accept the <strong>Compliance Obligations</strong> and acknowledge that 
                      violations may result in disciplinary action.
                    </label>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            By clicking "Accept & Continue", you electronically sign this agreement. 
            This action will be recorded for audit purposes.
          </p>
          <Button
            onClick={handleAccept}
            disabled={!allAccepted || acceptMutation.isPending}
            className="min-w-[180px]"
            data-testid="button-accept-agreement"
          >
            {acceptMutation.isPending ? (
              <>Processing...</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept & Continue
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
