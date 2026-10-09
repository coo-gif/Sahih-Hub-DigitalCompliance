import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";
import sahihLogoPath from "@assets/sahih_logo-1.png";
import { CR_STATUS, type ChangeRequestDetail } from "@/components/DocumentControl";

const when = (value: string | null | undefined) => (value ? format(new Date(value), "dd MMM yyyy, HH:mm") : "-");

// Printable Change Request Form (print or save as PDF from the browser)
export default function ChangeRequestForm() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/records/change-requests/:id");
  const { data: cr, isLoading } = useQuery<ChangeRequestDetail>({
    queryKey: [`/api/change-requests/${params?.id}`],
    enabled: !!params?.id,
  });

  if (isLoading || !cr) {
    return <div className="p-6 space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }

  const decision = cr.status === "rejected" ? "Rejected" : cr.status === "accepted" || cr.status === "implemented" ? "Accepted" : "Pending";
  const row = (label: string, value: React.ReactNode) => (
    <tr>
      <th className="text-left align-top p-2 border border-slate-300 bg-slate-50 w-48 font-semibold">{label}</th>
      <td className="p-2 border border-slate-300">{value}</td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate("/records")}><ArrowLeft className="h-4 w-4 mr-2" />Back to records</Button>
        <Button onClick={() => window.print()} data-testid="button-print-cr"><Printer className="h-4 w-4 mr-2" />Print / Save as PDF</Button>
      </div>

      <div className="bg-white text-black max-w-4xl mx-auto p-8 shadow print:shadow-none print:p-0" data-testid="cr-form">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-4">
          <img src={sahihLogoPath} alt="Sahih Certifications" className="h-14" />
          <div className="text-right">
            <div className="text-xl font-bold">CHANGE REQUEST FORM</div>
            <div className="font-mono text-sm">{cr.crNumber}</div>
            <div className="text-xs mt-1">Status: {CR_STATUS[cr.status]?.label ?? cr.status}</div>
          </div>
        </div>

        <h2 className="font-semibold mb-2">1. Document</h2>
        <table className="w-full text-sm border-collapse mb-5">
          <tbody>
            {row("Document name", cr.documentTitle)}
            {row("Document reference", cr.documentCode)}
            {row("Edition / revision", `Ed.${cr.editionNumber} Rev.${cr.revisionNumber}`)}
          </tbody>
        </table>

        <h2 className="font-semibold mb-2">2. Request</h2>
        <table className="w-full text-sm border-collapse mb-5">
          <tbody>
            {row("Initiator", cr.initiatorName)}
            {row("Date raised", when(cr.submittedAt ?? cr.createdAt))}
            {row("Need of change", cr.reasons.join(", "))}
            {row("Summary", cr.summary || "-")}
          </tbody>
        </table>

        <h2 className="font-semibold mb-2">3. Points raised</h2>
        <table className="w-full text-sm border-collapse mb-5">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-2 border border-slate-300 w-8">#</th>
              <th className="p-2 border border-slate-300 text-left">Text in the document</th>
              <th className="p-2 border border-slate-300 text-left">Requested change</th>
              <th className="p-2 border border-slate-300 text-left w-40">Reason</th>
            </tr>
          </thead>
          <tbody>
            {cr.points.map((p, i) => (
              <tr key={p.id}>
                <td className="p-2 border border-slate-300 text-center align-top">{i + 1}</td>
                <td className="p-2 border border-slate-300 italic align-top">"{p.quotedText}"</td>
                <td className="p-2 border border-slate-300 align-top">{p.content}</td>
                <td className="p-2 border border-slate-300 align-top">{p.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="font-semibold mb-2">4. Decision (COO)</h2>
        <table className="w-full text-sm border-collapse mb-5">
          <tbody>
            {row("Decision", decision)}
            {row("Decided by", cr.decidedByName ?? "-")}
            {row("Date", when(cr.decidedAt))}
            {row("Note", cr.decisionNote || "-")}
            {cr.revisionPreparerName && row("Revision prepared by", cr.revisionPreparerName)}
          </tbody>
        </table>

        <h2 className="font-semibold mb-2">5. Implementation</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {row("New version", cr.newRevisionNumber !== null ? `Ed.${cr.newEditionNumber} Rev.${cr.newRevisionNumber}` : "-")}
            {row("Approved on", when(cr.implementedAt))}
            {row("Previous version", cr.status === "implemented" ? `Ed.${cr.editionNumber} Rev.${cr.revisionNumber}: stamped obsolete and retained` : "-")}
          </tbody>
        </table>

        <p className="text-xs text-slate-500 mt-6">Controlled record generated by Sahih Hub on {format(new Date(), "dd MMM yyyy, HH:mm")}.</p>
      </div>
    </div>
  );
}
