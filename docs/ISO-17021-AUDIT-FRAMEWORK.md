# ISO 17021-1:2015 Internal Audit Framework

**System:** Sahih Hub Digital Compliance platform
**Document type:** Internal audit procedure, methodology and templates
**Applies to:** Quality Manager, internal auditors, management reviewers, system administrators

> Table and column names below follow the system tables named in the audit brief (`users`, `employees`, `documents`, and so on). Adjust names in the SQL library (section 12) to match the actual database schema before running anything.

---

## Contents

1. Audit objective
2. Audit scope
3. Evidence sources
4. Methodology
5. Rating definitions
6. Audit modules (clause-by-clause)
7. Clause crosswalk to ISO/IEC 17021-1:2015
8. Sampling approach
9. Risk-based review matrix
10. Corrective action model
11. Findings record (data model)
12. SQL evidence library
13. Completion criteria and sign-off
14. Audit report template
15. In-app template integration

---

## 1. Audit objective

This internal audit verifies that the Sahih Hub Digital Compliance platform operates in a manner consistent with ISO/IEC 17021-1:2015 principles, in particular:

- leadership commitment
- document control and record retention
- competence and personnel development
- operational planning and control
- evidence-based review and corrective action
- continual improvement

The audit does not stop at confirming that policies and records exist. It evaluates whether process controls are **effective, measurable, traceable and auditable in the live system**.

---

## 2. Audit scope

| Domain | Covered |
|---|---|
| User and employee role management | Yes |
| Document lifecycle and approval workflow | Yes |
| Training and competency tracking | Yes |
| Workflow logs and audit logs | Yes |
| Performance reporting and compliance dashboards | Yes |
| Corrective action and change management | Yes |
| Certification-related audit evidence | Yes |
| CRM and customer/compliance records (where they intersect with audit obligations) | Yes |

---

## 3. Evidence sources

System tables are the primary evidence. Every conclusion must cite at least one record reference.

| Area | Tables |
|---|---|
| People and roles | `users`, `employees`, `userRecords`, `buddyStatus` |
| Documents | `documents`, `documentVersions`, `documentAccess`, `documentAccessRequests`, `documentComments`, `revisionHistory` |
| Workflow and tasks | `workflowLogs`, `documentTasks`, `taskAssignments`, `taskRecords` |
| Logs | `auditLogs`, `userActivityLogs`, `notifications`, `pushSubscriptions` |
| Competence | `trainingAssignments`, `trainingCompletions` |
| Performance | `monthlyPerformanceReports` |
| Change and improvement | `changeRequests`, `bugReports` |
| Certification | `certificationApplications`, `certificationAudits`, `auditFindings`, `certificates` |

Evidence must be validated against:

- actual operational records
- approvals and signatures
- review dates and due dates
- document states and statuses
- issue resolution records
- management review output

---

## 4. Methodology

The audit is risk-based and evidence-based. For each requirement:

1. Define the requirement.
2. Identify the system evidence source.
3. Review the operational record.
4. Compare with the expected control outcome.
5. Record **compliant**, **observation**, **minor non-conformity** or **major non-conformity**.
6. Assign corrective action and a responsible owner.
7. Verify the effectiveness of the corrective action.

Each finding must include: status, evidence reference, root cause, corrective action, owner and target closure date.

---

## 5. Rating definitions

| Rating | Definition |
|---|---|
| Compliant | Requirement and evidence are present and effective. |
| Observation | Requirement is generally met, but evidence or process consistency is weak. |
| Minor non-conformity | Requirement exists but gaps affect consistent control. |
| Major non-conformity | Requirement is absent, ineffective or not enforced. |

Severity mapping used by the system:

| Rating | Severity | Corrective action required |
|---|---|---|
| Compliant | Low | No |
| Observation | Low | Recommended |
| Minor non-conformity | Medium | Yes |
| Major non-conformity | High | Yes, with escalation to management |

---

## 6. Audit modules (clause-by-clause)

Each module lists the requirement, control objectives, numbered audit checks, evidence and conclusion criteria. Check IDs (for example `C4.1`) are used identically in the in-app template.

### 6.1 Module 4 – Organizational context

**Requirement:** The organization shall understand its context, purpose and responsibilities.

**Control objectives**
- Responsibility distribution is clear.
- Job roles are documented.
- Relevant functions are assigned to accountable personnel.

| ID | Audit check | Evidence |
|---|---|---|
| C4.1 | Every user has a defined role. | `users.role` |
| C4.2 | Employees have job title, department and supervisor recorded. | `employees.jobTitle`, `employees.department`, `employees.supervisorId` |
| C4.3 | Job descriptions exist and align with employee records. | `documents.category = 'job_description'` |
| C4.4 | Induction status is tracked and completed. | `userRecords.reportType`, `trainingCompletions` |
| C4.5 | Department ownership is clear for document review and approval. | `documents`, `workflowLogs` |

**Audit evidence questions**
- Does each role have accountability?
- Are roles linked to actual personnel assignments?
- Are local responsibilities understood at operational and management levels?

**Conclusion criteria**
- **Compliant:** roles are clearly assigned and active records are consistent.
- **Observation:** role names are unclear or inconsistent.
- **Non-conformity:** responsibilities are ambiguous or undocumented.

---

### 6.2 Module 5 – Leadership

**Requirement:** Leadership shall demonstrate commitment to the management system and the effective operation of the compliance framework.

**Control objectives**
- Management reviews effectiveness.
- Leadership drives quality and compliance.
- Performance trends are monitored.

| ID | Audit check | Evidence |
|---|---|---|
| C5.1 | Monthly performance reports are generated and approved on schedule. | `monthlyPerformanceReports` |
| C5.2 | Management approval records exist. | `workflowLogs`, `auditLogs` |
| C5.3 | Quality-related actions are tracked and followed through. | `changeRequests`, `buddyStatus`, `userRecords` |
| C5.4 | Non-conformities are addressed in a formal way. | `auditFindings`, `auditLogs` |

**Audit evidence questions**
- Are leadership reviews actually happening?
- Are issues escalated and addressed?
- Is there evidence that leadership uses performance data to act?

**Conclusion criteria**
- **Compliant:** management review is documented and actioned.
- **Observation:** data exists but action is weak or inconsistent.
- **Non-conformity:** no management review or action path exists.

---

### 6.3 Module 6 – Planning

**Requirement:** The organization shall plan for competence, resources and required controls.

**Control objectives**
- Competence requirements are defined.
- Training is assigned and monitored.
- A review schedule is maintained.
- Resources and responsibilities are organized.

| ID | Audit check | Evidence |
|---|---|---|
| C6.1 | Required training is defined for each role. | `trainingAssignments`, `employees` |
| C6.2 | Training assignments are current and complete. | `trainingAssignments`, `trainingCompletions` |
| C6.3 | Document review dates are assigned and monitored. | `documents.nextReviewDate` |
| C6.4 | Internal planning is maintained for audit and compliance activity. | `certificationApplications`, `certificationAudits` |

**Audit evidence questions**
- Are training requirements tied to function and role?
- Are training records current and traceable?
- Are planning activities being executed?

**Conclusion criteria**
- **Compliant:** skills, review dates and planning are active and effective.
- **Observation:** gaps exist but mitigation is in place.
- **Non-conformity:** planning is absent or not executed.

---

### 6.4 Module 7 – Support and resources

**Requirement:** The organization shall provide the resources needed to operate the management system.

**Control objectives**
- System access is controlled.
- User activity is traceable.
- Records are protected.
- Operations have the tools and support they need.

| ID | Audit check | Evidence |
|---|---|---|
| C7.1 | Document access is authorized and decisions are documented. | `documentAccess`, `documentAccessRequests` |
| C7.2 | Access revocation is tracked. | `documentAccess.isRevoked` |
| C7.3 | System activity is logged and the audit trail is complete (previous and new values present). | `auditLogs`, `userActivityLogs` |
| C7.4 | Controlled documents are accessible only to authorized roles. | `documentAccess`, `users.role` |

**Audit evidence questions**
- Are permission decisions documented?
- Is there a complete audit trail for record changes?
- Are activity records sufficient to demonstrate operational integrity?

**Conclusion criteria**
- **Compliant:** access and activity controls are robust and traceable.
- **Observation:** controls exist but are not fully evidence-based.
- **Non-conformity:** access and activity are weak or unlogged.

---

### 6.5 Module 8 – Operational planning and control

**Requirement:** Operational processes shall be planned, controlled and monitored.

**Control objectives**
- Work is assigned.
- Status is visible.
- Quality outcomes are measured.
- Corrective action is managed.

| ID | Audit check | Evidence |
|---|---|---|
| C8.1 | Document tasks are assigned with due dates. | `documentTasks`, `taskAssignments` |
| C8.2 | Tasks progress through defined workflow states. | `taskRecords`, `workflowLogs` |
| C8.3 | Findings are tracked to closure. | `auditFindings` |
| C8.4 | Audit actions are assigned and monitored. | `certificationAudits`, `changeRequests` |

**Audit evidence questions**
- Is each task assigned, tracked and closed?
- Are due dates realistic and enforced?
- Are corrective actions visible and timely?

**Conclusion criteria**
- **Compliant:** activities are assigned, visible and controlled.
- **Observation:** tasks are delayed or not consistently closed.
- **Non-conformity:** workflow controls are not operating.

---

### 6.6 Module 9 – Performance evaluation and internal audit

**Requirement:** The organization shall evaluate performance and conduct internal audits.

**Control objectives**
- Performance metrics are active and reviewed.
- Audit findings are tracked.
- Review results are used for improvement.

| ID | Audit check | Evidence |
|---|---|---|
| C9.1 | Monthly performance reports are completed. | `monthlyPerformanceReports` |
| C9.2 | KPI targets are met or formally reviewed. | `monthlyPerformanceReports`, `buddyStatus` |
| C9.3 | Non-conformities are tracked. | `auditFindings`, `bugReports` |
| C9.4 | Internal review records exist in system history. | `auditLogs`, `userRecords` |
| C9.5 | Compliance risk triggers and alerts are monitored. | compliance alert logic, `auditLogs` |

**Audit evidence questions**
- Is the business measuring the right operational indicators?
- Are review results consistently used to drive action?
- Do system-generated alerts effectively trigger review?

**Conclusion criteria**
- **Compliant:** performance and audit review are active and acted upon.
- **Observation:** review is irregular or incomplete.
- **Non-conformity:** review and evaluation are absent or superficial.

---

### 6.7 Module 10 – Improvement

**Requirement:** The organization shall continually improve effectiveness.

**Control objectives**
- Issues are acted upon.
- Lessons learned are captured.
- Corrective actions are tracked.
- Improvement is formalized and evidenced.

| ID | Audit check | Evidence |
|---|---|---|
| C10.1 | Change requests exist and are tracked through to implementation. | `changeRequests` |
| C10.2 | Revision history is maintained with a recorded reason. | `revisionHistory` |
| C10.3 | Document comments and improvement reasons are recorded. | `documentComments` |
| C10.4 | Corrective actions are implemented and verified as effective. | `auditFindings`, `bugReports`, `workflowLogs` |

**Audit evidence questions**
- Is improvement based on evidence rather than assumptions?
- Are lessons learned recorded and acted upon?
- Is there evidence that corrective actions are effective?

**Conclusion criteria**
- **Compliant:** improvement is documented, measured and verified.
- **Observation:** improvement is ad hoc or undocumented.
- **Non-conformity:** no formal improvement loop exists.

---

## 7. Clause crosswalk to ISO/IEC 17021-1:2015

The seven audit modules above follow the common management-system structure (context, leadership, planning, support, operation, performance evaluation, improvement). ISO/IEC 17021-1:2015 is organized differently. For reporting to a certification body or accreditation body, map each module to the standard's own clauses.

The mapping below is **indicative**. Confirm each reference against the published standard before using it in a formal report.

| Audit module | Related ISO/IEC 17021-1:2015 clauses |
|---|---|
| 4 Organizational context | 4 Principles; 5 General requirements; 6.1 Organizational structure |
| 5 Leadership | 6.2 Top management and operational control; management review (10.2) |
| 6 Planning | 7.1 Competence of personnel; 7.2 Personnel involved in certification activities |
| 7 Support and resources | 7.5 Personnel records; 8.4 Confidentiality; document and record control (10.2) |
| 8 Operational planning and control | 8 Information requirements; 9 Process requirements |
| 9 Performance evaluation and internal audit | Management review and internal audits (10.2) |
| 10 Improvement | Corrective and preventive action (10.2) |

---

## 8. Sampling approach

Sample the following for each audit cycle:

| Population | Sample rule |
|---|---|
| Recent documents | 5–10% of recent documents, or at least 20 records, whichever is greater |
| Overdue reviews | All documents with overdue review dates |
| Missing review date | All approved documents with no `nextReviewDate` |
| Corrective actions | All open corrective actions |
| Compliance tasks | All overdue compliance tasks |
| Change requests | All major change requests accepted within the audit period |
| Audit findings | All open audit findings |
| Performance reports | Recent monthly performance reports |

Record the population size, sample size and selection method for each row in the audit report.

---

## 9. Risk-based review matrix

| Risk area | Key question | Primary evidence | Likelihood | Impact | Control status |
|---|---|---|---|---|---|
| Role ambiguity | Are responsibilities clearly assigned? | `users`, `employees`, `workflowLogs` | Medium | High | Active |
| Document control | Are approval and review steps followed? | `documents`, `workflowLogs` | Medium | High | Active |
| Competence | Are staff trained and assessed? | `trainingAssignments`, `trainingCompletions` | Medium | High | Active |
| Record integrity | Are changes auditable? | `auditLogs` | Low | High | Active |
| Performance management | Are KPIs reviewed and acted upon? | `monthlyPerformanceReports` | Medium | Medium | Active |
| Improvement | Are issues resolved and verified? | `changeRequests`, `revisionHistory` | Medium | High | Active |

Re-rate likelihood, impact and control status at the start of each audit cycle. The values above are starting points and should be updated from the previous cycle's results.

---

## 10. Corrective action model

Every finding rated observation (recommended) or non-conformity (required) maps to:

- requirement
- root cause
- corrective action
- owner
- due date
- effectiveness verification

**Worked example**

| Field | Value |
|---|---|
| Requirement | All approved documents must have a valid review date. |
| Finding | Document set contains approved records without `nextReviewDate`. |
| Root cause | The approval workflow did not enforce review scheduling. |
| Corrective action | Add a review-date validation rule before approval. |
| Owner | Quality Manager |
| Due date | 14 days |
| Verification | Report confirms no approved document lacks a review date. |

**Target closure guidance** (adjust to organizational policy)

| Rating | Suggested closure window |
|---|---|
| Major non-conformity | 14 days, with management escalation |
| Minor non-conformity | 30 days |
| Observation | Next audit cycle |

---

## 11. Findings record (data model)

```ts
export type Rating =
  | "not_assessed"
  | "compliant"
  | "observation"
  | "minor_nc"
  | "major_nc";

export interface CheckResponse {
  rating: Rating;
  evidenceRef: string;       // record IDs, document codes, report period
  details: string;           // what was found
  rootCause: string;
  correctiveAction: string;
  owner: string;
  dueDate: string;           // ISO date
  effectivenessVerified: boolean;
}
```

Suggested table if findings are persisted:

```sql
CREATE TABLE internal_audits (
  id              SERIAL PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  lead_auditor_id INTEGER REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'draft',   -- draft | in_progress | pending_signoff | closed
  signed_off_by   INTEGER REFERENCES users(id),
  signed_off_at   TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE internal_audit_checks (
  id                      SERIAL PRIMARY KEY,
  audit_id                INTEGER NOT NULL REFERENCES internal_audits(id) ON DELETE CASCADE,
  check_id                TEXT NOT NULL,           -- e.g. 'C4.1'
  rating                  TEXT NOT NULL DEFAULT 'not_assessed',
  evidence_ref            TEXT,
  details                 TEXT,
  root_cause              TEXT,
  corrective_action       TEXT,
  owner                   TEXT,
  due_date                DATE,
  effectiveness_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (audit_id, check_id)
);

CREATE TABLE internal_audit_sampling (
  audit_id     INTEGER NOT NULL REFERENCES internal_audits(id) ON DELETE CASCADE,
  sample_key   TEXT NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (audit_id, sample_key)
);
```

---

## 12. SQL evidence library

Run these read-only queries to pre-populate evidence references. Column names are assumptions; align them with the schema.

```sql
-- C4: Organizational context
SELECT COUNT(*) AS missing_roles
FROM users
WHERE role IS NULL OR role = '';

SELECT *
FROM employees
WHERE department IS NULL OR job_title IS NULL;

-- C5: Leadership review
SELECT *
FROM monthly_performance_reports
WHERE status = 'approved'
ORDER BY report_year DESC, report_month DESC;

-- C6: Planning / competence
SELECT e.name, e.department,
       COUNT(ta.id) AS assignments,
       COUNT(CASE WHEN ta.status = 'completed' THEN 1 END) AS completed
FROM employees e
LEFT JOIN training_assignments ta ON ta.employee_id = e.id
GROUP BY e.id, e.name, e.department
HAVING COUNT(CASE WHEN ta.status = 'completed' THEN 1 END) < COUNT(ta.id);

-- C6.3: Approved documents with no review date, and overdue reviews
SELECT id, document_code, title
FROM documents
WHERE status = 'approved' AND next_review_date IS NULL;

SELECT id, document_code, title, next_review_date
FROM documents
WHERE next_review_date < NOW();

-- C7: Support and access
SELECT d.id, d.document_code, d.title, COUNT(da.id) AS access_grants
FROM documents d
LEFT JOIN document_access da
       ON da.document_id = d.id AND da.is_revoked = false
GROUP BY d.id, d.document_code, d.title;

SELECT *
FROM audit_logs
WHERE previous_value IS NULL OR new_value IS NULL;

-- C8: Operational controls
SELECT *
FROM document_tasks
WHERE status != 'completed'
  AND target_date < NOW();

SELECT *
FROM audit_findings
WHERE status IN ('open', 'pending_verification');

-- C9: Performance evaluation
SELECT user_id,
       AVG(performance_score) AS avg_score,
       AVG(on_time_rate)      AS avg_on_time
FROM monthly_performance_reports
WHERE status = 'approved'
GROUP BY user_id;

-- C10: Improvement
SELECT *
FROM change_requests
WHERE status = 'accepted' AND implemented_at IS NULL;

SELECT *
FROM revision_history
WHERE reason IS NULL OR reason = '';
```

---

## 13. Completion criteria and sign-off

The audit is complete only when:

- all seven modules have been reviewed (every check has a rating other than "not assessed")
- all sampled records are checked
- corrective actions are assigned for every non-conformity (root cause, owner, due date)
- evidence is retained and referenced
- the final report is signed off by management

The in-app template enforces these rules before sign-off is allowed.

**Final audit declaration.** The audit concludes whether the control framework is effective, suitable, consistently implemented, supported by objective evidence and capable of continual improvement. Results are reported as:

- system-level effectiveness
- operational compliance
- risk exposure
- corrective action status

---

## 14. Audit report template

```md
# Internal Audit Report – [Reference]

**Audit period:** [start] to [end]
**Lead auditor:** [name]
**Audit team:** [names]
**Report date:** [date]

## 1. Summary
- Checks assessed: [n] of [total]
- Compliant: [n] | Observations: [n] | Minor NC: [n] | Major NC: [n]
- Overall conclusion: [effective / effective with observations / not effective]

## 2. Scope and method
[Brief scope statement. Sampling populations and sample sizes.]

## 3. Findings by module
| Check | Requirement | Evidence | Result | Risk | Details | Corrective action | Owner | Due |
|---|---|---|---|---|---|---|---|---|

## 4. Corrective action register
| Ref | Root cause | Action | Owner | Due | Verified |
|---|---|---|---|---|---|

## 5. Risk exposure
[Updated matrix.]

## 6. Management sign-off
Name: [ ] Role: [ ] Date: [ ]
```

---

## 15. In-app template integration

The Internal Audit section of the web app provides this framework as a working template. Files delivered alongside this document:

| File | Purpose |
|---|---|
| `auditTemplate.ts` | Typed modules, checks, ratings, sampling items, scoring, validation, Markdown report export. Framework-agnostic, so it can also run on the server. |
| `InternalAuditTemplate.tsx` | React component: audit details, module-by-module checks, sampling checklist, summary, sign-off, JSON and Markdown export. |
| `internal-audit.css` | Styles for the component (light and dark theme aware). |

**Wiring it in**

```tsx
import InternalAuditTemplate from "@/features/internal-audit/InternalAuditTemplate";

<InternalAuditTemplate
  initial={savedAudit}                 // optional, a previously saved AuditRecord
  onSave={(record) => saveAudit(record)} // persist via your API
/>
```

**Suggested next steps**

1. Add the three tables from section 11 and an API route that loads and saves an `AuditRecord`.
2. Pre-fill each check's evidence reference by running the section 12 queries and attaching counts and record IDs.
3. Restrict the section to Quality Manager and internal auditor roles, and write an `auditLogs` entry on every save and on sign-off.
