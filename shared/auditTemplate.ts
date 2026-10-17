/**
 * Internal audit template – ISO/IEC 17021-1:2015 deep review.
 * Framework-agnostic: safe to import on the client or the server.
 * Check IDs (C4.1 …) match docs/ISO-17021-AUDIT-FRAMEWORK.md.
 *
 * Sahih Hub additions: a corrective action owner is a system user (ownerId), so the action becomes
 * their task; the owner records the action taken, then the lead auditor verifies effectiveness.
 */

export type Rating =
  | "not_assessed"
  | "compliant"
  | "observation"
  | "minor_nc"
  | "major_nc";

export type Severity = "none" | "low" | "medium" | "high";

export interface RatingDef {
  value: Rating;
  label: string;
  severity: Severity;
  /** Corrective action must be recorded before sign-off. */
  requiresAction: boolean;
}

export const RATINGS: RatingDef[] = [
  { value: "not_assessed", label: "Not assessed", severity: "none", requiresAction: false },
  { value: "compliant", label: "Compliant", severity: "low", requiresAction: false },
  { value: "observation", label: "Observation", severity: "low", requiresAction: false },
  { value: "minor_nc", label: "Minor non-conformity", severity: "medium", requiresAction: true },
  { value: "major_nc", label: "Major non-conformity", severity: "high", requiresAction: true },
];

export const RATING_LABEL: Record<Rating, string> = Object.fromEntries(
  RATINGS.map((r) => [r.value, r.label]),
) as Record<Rating, string>;

/** Higher number = worse. Used to find the worst rating in a module. */
const RATING_WEIGHT: Record<Rating, number> = {
  not_assessed: 0,
  compliant: 1,
  observation: 2,
  minor_nc: 3,
  major_nc: 4,
};

export interface AuditCheckDef {
  id: string;
  text: string;
  evidence: string[];
}

export interface ClauseDef {
  id: string; // "c4"
  number: number; // 4
  title: string;
  requirement: string;
  objectives: string[];
  questions: string[];
  criteria: { compliant: string; observation: string; nonConformity: string };
  checks: AuditCheckDef[];
}

export const CLAUSES: ClauseDef[] = [
  {
    id: "c4",
    number: 4,
    title: "Organizational context",
    requirement:
      "The organization shall understand its context, purpose and responsibilities.",
    objectives: [
      "Responsibility distribution is clear",
      "Job roles are documented",
      "Relevant functions are assigned to accountable personnel",
    ],
    questions: [
      "Does each role have accountability?",
      "Are roles linked to actual personnel assignments?",
      "Are local responsibilities understood at operational and management levels?",
    ],
    criteria: {
      compliant: "Roles are clearly assigned and active records are consistent.",
      observation: "Role names are unclear or inconsistent.",
      nonConformity: "Responsibilities are ambiguous or undocumented.",
    },
    checks: [
      { id: "C4.1", text: "Every user has a defined role.", evidence: ["users.role"] },
      {
        id: "C4.2",
        text: "Employees have job title, department and supervisor recorded.",
        evidence: ["employees.jobTitle", "employees.department", "employees.supervisorId"],
      },
      {
        id: "C4.3",
        text: "Job descriptions exist and align with employee records.",
        evidence: ["documents.category = 'job_description'"],
      },
      {
        id: "C4.4",
        text: "Induction status is tracked and completed.",
        evidence: ["userRecords.reportType", "trainingCompletions"],
      },
      {
        id: "C4.5",
        text: "Department ownership is clear for document review and approval.",
        evidence: ["documents", "workflowLogs"],
      },
    ],
  },
  {
    id: "c5",
    number: 5,
    title: "Leadership",
    requirement:
      "Leadership shall demonstrate commitment to the management system and the effective operation of the compliance framework.",
    objectives: [
      "Management reviews effectiveness",
      "Leadership drives quality and compliance",
      "Performance trends are monitored",
    ],
    questions: [
      "Are leadership reviews actually happening?",
      "Are issues escalated and addressed?",
      "Is there evidence that leadership uses performance data to act?",
    ],
    criteria: {
      compliant: "Management review is documented and actioned.",
      observation: "Data exists but action is weak or inconsistent.",
      nonConformity: "No management review or action path exists.",
    },
    checks: [
      {
        id: "C5.1",
        text: "Monthly performance reports are generated and approved on schedule.",
        evidence: ["monthlyPerformanceReports"],
      },
      {
        id: "C5.2",
        text: "Management approval records exist.",
        evidence: ["workflowLogs", "auditLogs"],
      },
      {
        id: "C5.3",
        text: "Quality-related actions are tracked and followed through.",
        evidence: ["changeRequests", "buddyStatus", "userRecords"],
      },
      {
        id: "C5.4",
        text: "Non-conformities are addressed in a formal way.",
        evidence: ["auditFindings", "auditLogs"],
      },
    ],
  },
  {
    id: "c6",
    number: 6,
    title: "Planning",
    requirement:
      "The organization shall plan for competence, resources and required controls.",
    objectives: [
      "Competence requirements are defined",
      "Training is assigned and monitored",
      "A review schedule is maintained",
      "Resources and responsibilities are organized",
    ],
    questions: [
      "Are training requirements tied to function and role?",
      "Are training records current and traceable?",
      "Are planning activities being executed?",
    ],
    criteria: {
      compliant: "Skills, review dates and planning are active and effective.",
      observation: "Gaps exist but mitigation is in place.",
      nonConformity: "Planning is absent or not executed.",
    },
    checks: [
      {
        id: "C6.1",
        text: "Required training is defined for each role.",
        evidence: ["trainingAssignments", "employees"],
      },
      {
        id: "C6.2",
        text: "Training assignments are current and complete.",
        evidence: ["trainingAssignments", "trainingCompletions"],
      },
      {
        id: "C6.3",
        text: "Document review dates are assigned and monitored.",
        evidence: ["documents.nextReviewDate"],
      },
      {
        id: "C6.4",
        text: "Internal planning is maintained for audit and compliance activity.",
        evidence: ["certificationApplications", "certificationAudits"],
      },
    ],
  },
  {
    id: "c7",
    number: 7,
    title: "Support and resources",
    requirement:
      "The organization shall provide the resources needed to operate the management system.",
    objectives: [
      "System access is controlled",
      "User activity is traceable",
      "Records are protected",
      "Operations have the tools and support they need",
    ],
    questions: [
      "Are permission decisions documented?",
      "Is there a complete audit trail for record changes?",
      "Are activity records sufficient to demonstrate operational integrity?",
    ],
    criteria: {
      compliant: "Access and activity controls are robust and traceable.",
      observation: "Controls exist but are not fully evidence-based.",
      nonConformity: "Access and activity are weak or unlogged.",
    },
    checks: [
      {
        id: "C7.1",
        text: "Document access is authorized and decisions are documented.",
        evidence: ["documentAccess", "documentAccessRequests"],
      },
      {
        id: "C7.2",
        text: "Access revocation is tracked.",
        evidence: ["documentAccess.isRevoked"],
      },
      {
        id: "C7.3",
        text: "System activity is logged and the audit trail is complete (previous and new values present).",
        evidence: ["auditLogs", "userActivityLogs"],
      },
      {
        id: "C7.4",
        text: "Controlled documents are accessible only to authorized roles.",
        evidence: ["documentAccess", "users.role"],
      },
    ],
  },
  {
    id: "c8",
    number: 8,
    title: "Operational planning and control",
    requirement: "Operational processes shall be planned, controlled and monitored.",
    objectives: [
      "Work is assigned",
      "Status is visible",
      "Quality outcomes are measured",
      "Corrective action is managed",
    ],
    questions: [
      "Is each task assigned, tracked and closed?",
      "Are due dates realistic and enforced?",
      "Are corrective actions visible and timely?",
    ],
    criteria: {
      compliant: "Activities are assigned, visible and controlled.",
      observation: "Tasks are delayed or not consistently closed.",
      nonConformity: "Workflow controls are not operating.",
    },
    checks: [
      {
        id: "C8.1",
        text: "Document tasks are assigned with due dates.",
        evidence: ["documentTasks", "taskAssignments"],
      },
      {
        id: "C8.2",
        text: "Tasks progress through defined workflow states.",
        evidence: ["taskRecords", "workflowLogs"],
      },
      {
        id: "C8.3",
        text: "Findings are tracked to closure.",
        evidence: ["auditFindings"],
      },
      {
        id: "C8.4",
        text: "Audit actions are assigned and monitored.",
        evidence: ["certificationAudits", "changeRequests"],
      },
    ],
  },
  {
    id: "c9",
    number: 9,
    title: "Performance evaluation and internal audit",
    requirement:
      "The organization shall evaluate performance and conduct internal audits.",
    objectives: [
      "Performance metrics are active and reviewed",
      "Audit findings are tracked",
      "Review results are used for improvement",
    ],
    questions: [
      "Is the business measuring the right operational indicators?",
      "Are review results consistently used to drive action?",
      "Do system-generated alerts effectively trigger review?",
    ],
    criteria: {
      compliant: "Performance and audit review are active and acted upon.",
      observation: "Review is irregular or incomplete.",
      nonConformity: "Review and evaluation are absent or superficial.",
    },
    checks: [
      {
        id: "C9.1",
        text: "Monthly performance reports are completed.",
        evidence: ["monthlyPerformanceReports"],
      },
      {
        id: "C9.2",
        text: "KPI targets are met or formally reviewed.",
        evidence: ["monthlyPerformanceReports", "buddyStatus"],
      },
      {
        id: "C9.3",
        text: "Non-conformities are tracked.",
        evidence: ["auditFindings", "bugReports"],
      },
      {
        id: "C9.4",
        text: "Internal review records exist in system history.",
        evidence: ["auditLogs", "userRecords"],
      },
      {
        id: "C9.5",
        text: "Compliance risk triggers and alerts are monitored.",
        evidence: ["compliance alert logic", "auditLogs"],
      },
    ],
  },
  {
    id: "c10",
    number: 10,
    title: "Improvement",
    requirement: "The organization shall continually improve effectiveness.",
    objectives: [
      "Issues are acted upon",
      "Lessons learned are captured",
      "Corrective actions are tracked",
      "Improvement is formalized and evidenced",
    ],
    questions: [
      "Is improvement based on evidence rather than assumptions?",
      "Are lessons learned recorded and acted upon?",
      "Is there evidence that corrective actions are effective?",
    ],
    criteria: {
      compliant: "Improvement is documented, measured and verified.",
      observation: "Improvement is ad hoc or undocumented.",
      nonConformity: "No formal improvement loop exists.",
    },
    checks: [
      {
        id: "C10.1",
        text: "Change requests exist and are tracked through to implementation.",
        evidence: ["changeRequests"],
      },
      {
        id: "C10.2",
        text: "Revision history is maintained with a recorded reason.",
        evidence: ["revisionHistory"],
      },
      {
        id: "C10.3",
        text: "Document comments and improvement reasons are recorded.",
        evidence: ["documentComments"],
      },
      {
        id: "C10.4",
        text: "Corrective actions are implemented and verified as effective.",
        evidence: ["auditFindings", "bugReports", "workflowLogs"],
      },
    ],
  },
];

export const ALL_CHECKS: AuditCheckDef[] = CLAUSES.flatMap((c) => c.checks);

export interface SamplingItemDef {
  key: string;
  label: string;
  rule: string;
}

export const SAMPLING_ITEMS: SamplingItemDef[] = [
  {
    key: "recent_documents",
    label: "Recent documents",
    rule: "5–10% of recent documents, or at least 20 records, whichever is greater",
  },
  {
    key: "overdue_reviews",
    label: "Overdue document reviews",
    rule: "All documents with overdue review dates",
  },
  {
    key: "missing_review_date",
    label: "Approved documents without a review date",
    rule: "All approved documents with no nextReviewDate",
  },
  {
    key: "open_corrective_actions",
    label: "Open corrective actions",
    rule: "All open corrective actions",
  },
  {
    key: "overdue_tasks",
    label: "Overdue compliance tasks",
    rule: "All overdue compliance tasks",
  },
  {
    key: "major_change_requests",
    label: "Major change requests",
    rule: "All major change requests accepted within the audit period",
  },
  {
    key: "open_findings",
    label: "Open audit findings",
    rule: "All open audit findings",
  },
  {
    key: "performance_reports",
    label: "Monthly performance reports",
    rule: "Recent monthly performance reports",
  },
];

/* ------------------------------------------------------------------ */
/* Record shape                                                        */
/* ------------------------------------------------------------------ */

export interface CheckResponse {
  rating: Rating;
  evidenceRef: string;
  details: string;
  rootCause: string;
  correctiveAction: string;
  owner: string;
  ownerId: number | null; // user responsible for the corrective action
  dueDate: string; // ISO date (yyyy-mm-dd)
  actionTaken: string; // recorded by the owner
  actionCompleted: boolean; // owner says the action is done; the lead auditor then verifies it
  effectivenessVerified: boolean;
}

export interface SamplingEntry {
  completed: boolean;
  populationSize: string;
  sampleSize: string;
}

export interface AuditMeta {
  reference: string;
  periodStart: string;
  periodEnd: string;
  leadAuditor: string;
  leadAuditorId: number | null;
  auditTeam: string;
  auditTeamIds: number[];
  scopeNotes: string;
}

export interface SignOff {
  name: string;
  role: string;
  date: string;
}

export interface AuditRecord {
  meta: AuditMeta;
  responses: Record<string, CheckResponse>;
  sampling: Record<string, SamplingEntry>;
  signOff: SignOff;
}

export function emptyResponse(): CheckResponse {
  return {
    rating: "not_assessed",
    evidenceRef: "",
    details: "",
    rootCause: "",
    correctiveAction: "",
    owner: "",
    ownerId: null,
    dueDate: "",
    actionTaken: "",
    actionCompleted: false,
    effectivenessVerified: false,
  };
}

export function emptyAudit(): AuditRecord {
  const year = new Date().getFullYear();
  return {
    meta: {
      reference: `IA-${year}-001`,
      periodStart: "",
      periodEnd: "",
      leadAuditor: "",
      leadAuditorId: null,
      auditTeam: "",
      auditTeamIds: [],
      scopeNotes: "",
    },
    responses: Object.fromEntries(ALL_CHECKS.map((c) => [c.id, emptyResponse()])),
    sampling: Object.fromEntries(
      SAMPLING_ITEMS.map((s) => [
        s.key,
        { completed: false, populationSize: "", sampleSize: "" },
      ]),
    ),
    signOff: { name: "", role: "", date: "" },
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function severityOf(rating: Rating): Severity {
  return RATINGS.find((r) => r.value === rating)?.severity ?? "none";
}

export function requiresAction(rating: Rating): boolean {
  return RATINGS.find((r) => r.value === rating)?.requiresAction ?? false;
}

export interface ClauseSummary {
  total: number;
  assessed: number;
  worst: Rating;
}

export interface AuditSummary {
  total: number;
  assessed: number;
  counts: Record<Rating, number>;
  byClause: Record<string, ClauseSummary>;
  openActions: number;
  overall: "not_started" | "in_progress" | "effective" | "effective_with_observations" | "not_effective";
}

export function summarize(audit: AuditRecord): AuditSummary {
  const counts: Record<Rating, number> = {
    not_assessed: 0,
    compliant: 0,
    observation: 0,
    minor_nc: 0,
    major_nc: 0,
  };
  const byClause: Record<string, ClauseSummary> = {};
  let openActions = 0;

  for (const clause of CLAUSES) {
    const cs: ClauseSummary = { total: clause.checks.length, assessed: 0, worst: "not_assessed" };
    for (const check of clause.checks) {
      const r = audit.responses[check.id] ?? emptyResponse();
      counts[r.rating] += 1;
      if (r.rating !== "not_assessed") cs.assessed += 1;
      if (RATING_WEIGHT[r.rating] > RATING_WEIGHT[cs.worst]) cs.worst = r.rating;
      if (requiresAction(r.rating) && !r.effectivenessVerified) openActions += 1;
    }
    byClause[clause.id] = cs;
  }

  const total = ALL_CHECKS.length;
  const assessed = total - counts.not_assessed;

  let overall: AuditSummary["overall"];
  if (assessed === 0) overall = "not_started";
  else if (assessed < total) overall = "in_progress";
  else if (counts.major_nc > 0) overall = "not_effective";
  else if (counts.minor_nc > 0 || counts.observation > 0) overall = "effective_with_observations";
  else overall = "effective";

  return { total, assessed, counts, byClause, openActions, overall };
}

export const OVERALL_LABEL: Record<AuditSummary["overall"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  effective: "Effective",
  effective_with_observations: "Effective with observations and non-conformities to close",
  not_effective: "Not effective: major non-conformity open",
};

/* ------------------------------------------------------------------ */
/* Validation (sign-off gate)                                          */
/* ------------------------------------------------------------------ */

export function validateAudit(audit: AuditRecord): string[] {
  const issues: string[] = [];

  const unassessed = ALL_CHECKS.filter(
    (c) => (audit.responses[c.id]?.rating ?? "not_assessed") === "not_assessed",
  );
  if (unassessed.length > 0) {
    issues.push(`${unassessed.length} check(s) not yet assessed.`);
  }

  for (const check of ALL_CHECKS) {
    const r = audit.responses[check.id];
    if (!r || r.rating === "not_assessed") continue;
    if (r.rating !== "compliant" && !r.evidenceRef.trim()) {
      issues.push(`${check.id}: add an evidence reference.`);
    }
    if (requiresAction(r.rating)) {
      const missing: string[] = [];
      if (!r.rootCause.trim()) missing.push("root cause");
      if (!r.correctiveAction.trim()) missing.push("corrective action");
      if (!r.owner.trim()) missing.push("owner");
      if (!r.dueDate) missing.push("due date");
      if (missing.length) issues.push(`${check.id}: missing ${missing.join(", ")}.`);
    }
  }

  const samplingOpen = SAMPLING_ITEMS.filter((s) => !audit.sampling[s.key]?.completed);
  if (samplingOpen.length > 0) {
    issues.push(`${samplingOpen.length} sampling item(s) not completed.`);
  }

  if (!audit.meta.leadAuditor.trim()) issues.push("Lead auditor not recorded.");
  if (!audit.meta.periodStart || !audit.meta.periodEnd) issues.push("Audit period not set.");

  return issues;
}

export function signOffComplete(s: SignOff): boolean {
  return Boolean(s.name.trim() && s.role.trim() && s.date);
}

/* ------------------------------------------------------------------ */
/* Markdown report export                                              */
/* ------------------------------------------------------------------ */

const cell = (v: string) => (v.trim() ? v.replace(/\|/g, "\\|").replace(/\r?\n/g, " ") : "–");

export function toMarkdownReport(audit: AuditRecord): string {
  const s = summarize(audit);
  const m = audit.meta;
  const lines: string[] = [];

  lines.push(`# Internal Audit Report – ${m.reference || "Untitled"}`, "");
  lines.push(`**Audit period:** ${m.periodStart || "–"} to ${m.periodEnd || "–"}`);
  lines.push(`**Lead auditor:** ${m.leadAuditor || "–"}`);
  lines.push(`**Audit team:** ${m.auditTeam || "–"}`, "");

  lines.push("## 1. Summary", "");
  lines.push(`- Checks assessed: ${s.assessed} of ${s.total}`);
  lines.push(
    `- Compliant: ${s.counts.compliant} | Observations: ${s.counts.observation} | Minor NC: ${s.counts.minor_nc} | Major NC: ${s.counts.major_nc}`,
  );
  lines.push(`- Open corrective actions: ${s.openActions}`);
  lines.push(`- Overall conclusion: ${OVERALL_LABEL[s.overall]}`, "");

  if (m.scopeNotes.trim()) {
    lines.push("## 2. Scope notes", "", m.scopeNotes.trim(), "");
  }

  lines.push("## 3. Sampling", "");
  lines.push("| Population | Rule | Population size | Sample size | Done |", "|---|---|---|---|---|");
  for (const item of SAMPLING_ITEMS) {
    const e = audit.sampling[item.key];
    lines.push(
      `| ${item.label} | ${item.rule} | ${cell(e?.populationSize ?? "")} | ${cell(e?.sampleSize ?? "")} | ${e?.completed ? "Yes" : "No"} |`,
    );
  }
  lines.push("");

  lines.push("## 4. Findings by module", "");
  for (const clause of CLAUSES) {
    lines.push(`### Module ${clause.number} – ${clause.title}`, "");
    lines.push(`*Requirement:* ${clause.requirement}`, "");
    lines.push(
      "| Check | Requirement | Evidence | Result | Severity | Details | Corrective action | Owner | Due |",
      "|---|---|---|---|---|---|---|---|---|",
    );
    for (const check of clause.checks) {
      const r = audit.responses[check.id] ?? emptyResponse();
      lines.push(
        `| ${check.id} | ${cell(check.text)} | ${cell(r.evidenceRef || check.evidence.join(", "))} | ${RATING_LABEL[r.rating]} | ${severityOf(r.rating)} | ${cell(r.details)} | ${cell(r.correctiveAction)} | ${cell(r.owner)} | ${cell(r.dueDate)} |`,
      );
    }
    lines.push("");
  }

  const actions = ALL_CHECKS.filter((c) => requiresAction(audit.responses[c.id]?.rating ?? "not_assessed"));
  lines.push("## 5. Corrective action register", "");
  if (actions.length === 0) {
    lines.push("No non-conformities recorded.", "");
  } else {
    lines.push("| Ref | Root cause | Action | Owner | Due | Action taken | Verified |", "|---|---|---|---|---|---|---|");
    for (const c of actions) {
      const r = audit.responses[c.id];
      lines.push(
        `| ${c.id} | ${cell(r.rootCause)} | ${cell(r.correctiveAction)} | ${cell(r.owner)} | ${cell(r.dueDate)} | ${cell(r.actionTaken ?? "")} | ${r.effectivenessVerified ? "Yes" : "No"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## 6. Management sign-off", "");
  lines.push(`Name: ${audit.signOff.name || "–"}  `);
  lines.push(`Role: ${audit.signOff.role || "–"}  `);
  lines.push(`Date: ${audit.signOff.date || "–"}`, "");

  return lines.join("\n");
}
