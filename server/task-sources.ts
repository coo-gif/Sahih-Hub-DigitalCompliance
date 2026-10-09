import { db } from "./db";
import {
  users, documents, documentComments, downloadRequests, documentAccessRequests, employees, employeeTasks,
  trainings, trainingAssignments, monthlyPerformanceReports, bugReports, leads, leadUpdateRequests,
  certificationApplications, certificationAudits, revisionHistory, docugenieForms, docugenieFormSubmissions,
  DocumentStatus, DocumentHubStatus, DocumentCommentStatus, EmployeeRecordStatus, TaskStatus,
  TrainingAssignmentStatus, MonthlyReportStatus, BugReportStatus, LeadStatus, CertificationApplicationStatus,
  AuditStatus, RevisionHistoryStatus, DocuGenieFormStatus, UserRole, taskAssignments, DEFAULT_TARGET_DAYS,
} from "@shared/schema";

const COO_EMAIL = 'coo@sahihcertify.com';
const CEO_EMAIL = 'ceo@sahihcertify.com';
const HOUR = 60 * 60 * 1000;

// Default time allowed for each kind of task when nobody set a target date and the source has
// no due date of its own (hours). Document steps follow DEFAULT_TARGET_DAYS.
export const TASK_SLA_HOURS: Record<string, number> = {
  prepare: DEFAULT_TARGET_DAYS.prepare * 24,
  review: DEFAULT_TARGET_DAYS.review * 24,
  approve: DEFAULT_TARGET_DAYS.approve * 24,
  hub_approval: DEFAULT_TARGET_DAYS.hub_approval * 24,
  revise: DEFAULT_TARGET_DAYS.revise * 24,
  comment: DEFAULT_TARGET_DAYS.comment * 24,
  download_approval: 24,
  access_approval: 24,
  employee_review: DEFAULT_TARGET_DAYS.employee_review * 24,
  employee_approve: DEFAULT_TARGET_DAYS.employee_approve * 24,
  employee_task: 7 * 24,
  training: 30 * 24,
  report_review: 72,
  report_approve: 72,
  bug_critical: 24,
  bug_high: 72,
  bug_medium: 7 * 24,
  bug_low: 14 * 24,
  bug_verify: 48,
  lead_update: 48,
  amendment_approval: 72,
  form_fill: 7 * 24,
  certification_audit: 7 * 24,
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  prepare: 'Prepare',
  review: 'Review',
  approve: 'Approve',
  hub_approval: 'Final Approval (Hub)',
  revise: 'Returned for Revision',
  comment: 'Comment Assigned',
  download_approval: 'Download Request',
  access_approval: 'Access Request',
  employee_review: 'Employee Review',
  employee_approve: 'Employee Approval',
  employee_task: 'Assigned Task',
  training: 'Training',
  report_review: 'Report Review',
  report_approve: 'Report Approval',
  bug: 'Bug Report',
  bug_verify: 'Verify Bug Fix',
  lead_update: 'Lead Update Request',
  lead_followup: 'Lead Follow-up',
  certification: 'Certification Application',
  certification_audit: 'Certification Audit',
  amendment_approval: 'Amendment Approval',
  form_fill: 'Form to Fill',
};

// Tasks offered to a group (any admin / QM). Whoever acts completes it; the others are "closed by a colleague".
export const POOLED_TASK_TYPES = new Set(['download_approval', 'comment']);

export interface OpenTask {
  key: string;            // identifies the piece of work, e.g. "review:12"; the same key can move between people
  userId: number;
  taskType: string;
  title: string;
  reference: string;      // short code shown on the card: document code, ticket number, employee name...
  description: string;
  link: string;           // page where the work is done
  assignedAt: Date;
  dueAt: Date | null;     // null = no deadline (not counted for on-time performance)
  entityType: string;     // audit-log entity, used to see who acted on pooled tasks
  entityId: number;
  documentId?: number;
  initiatorId?: number | null; // who assigned it; can reassign it or change its target date
  // where dueAt came from: a target date someone set, the source record's own date, or the default allowance
  dueSource?: 'target' | 'source' | 'default';
  extra?: Record<string, unknown>;
}

export interface TaskSnapshot {
  tasks: OpenTask[];
  existingEntities: Set<string>;  // "entityType:id" of every source that still exists
  cancelledKeys: Set<string>;     // tasks whose source was cancelled/withdrawn rather than done
}

const due = (from: Date, slaKey: string) => new Date(from.getTime() + (TASK_SLA_HOURS[slaKey] ?? 72) * HOUR);
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const at = (...dates: (Date | null | undefined)[]) => dates.find((d): d is Date => !!d) ?? new Date();

// Every open assignment in the system, for every user
export async function collectOpenTasks(): Promise<TaskSnapshot> {
  const tasks: OpenTask[] = [];
  const existingEntities = new Set<string>();
  const cancelledKeys = new Set<string>();
  const exists = (type: string, id: number) => existingEntities.add(`${type}:${id}`);

  const [
    allUsers, allDocs, openComments, pendingDownloads, pendingAccess, allEmployees, allEmployeeTasks,
    allTrainings, allTrainingAssignments, allReports, allBugs, allLeads, pendingLeadRequests,
    allCertApps, allCertAudits, pendingAmendments, allForms, allSubmissions,
  ] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive }).from(users),
    db.select().from(documents),
    db.select().from(documentComments),
    db.select().from(downloadRequests),
    db.select().from(documentAccessRequests),
    db.select().from(employees),
    db.select().from(employeeTasks),
    db.select().from(trainings),
    db.select().from(trainingAssignments),
    db.select().from(monthlyPerformanceReports),
    db.select().from(bugReports),
    db.select().from(leads),
    db.select().from(leadUpdateRequests),
    db.select().from(certificationApplications),
    db.select().from(certificationAudits),
    db.select().from(revisionHistory),
    db.select().from(docugenieForms),
    db.select().from(docugenieFormSubmissions),
  ]);

  const activeUsers = allUsers.filter(u => u.isActive !== false);
  const userName = new Map(allUsers.map(u => [u.id, u.name]));
  const coo = allUsers.find(u => u.email === COO_EMAIL);
  const ceo = allUsers.find(u => u.email === CEO_EMAIL);
  const approvers = activeUsers.filter(u => u.role === UserRole.ADMIN || u.role === UserRole.QUALITY_MANAGER);
  const docById = new Map(allDocs.map(d => [d.id, d]));

  // ---- Documents ----
  for (const doc of allDocs) {
    exists('document', doc.id);
    const base = {
      reference: doc.documentCode,
      link: `/documents/${doc.id}/edit`,
      entityType: 'document',
      entityId: doc.id,
      documentId: doc.id,
      extra: {
        documentCode: doc.documentCode,
        reviewerId: doc.reviewerId,
        reviewerName: doc.reviewerId ? userName.get(doc.reviewerId) : null,
        approverId: doc.approverId,
        approverName: doc.approverId ? userName.get(doc.approverId) : null,
      },
    };
    const since = at(doc.returnedAt, doc.updatedAt, doc.createdAt);

    if (doc.status === DocumentStatus.DRAFT) {
      const preparerId = doc.preparedById ?? doc.createdById;
      if (doc.returnedAt) {
        tasks.push({
          ...base, key: `revise:${doc.id}`, userId: preparerId, initiatorId: doc.returnedById, taskType: 'revise', title: doc.title,
          description: `${userName.get(doc.returnedById!) || 'Your reviewer'} returned this document for revision.${doc.returnNote ? ` Note: "${doc.returnNote}"` : ''} Address the comments and resubmit it.`,
          assignedAt: doc.returnedAt, dueAt: due(doc.returnedAt, 'revise'),
          extra: { ...base.extra, returnedByName: doc.returnedById ? userName.get(doc.returnedById) : null, returnNote: doc.returnNote },
        });
      } else if (doc.preparedById && !doc.preparerConfirmedAt) {
        const assigned = at(doc.createdAt);
        tasks.push({
          ...base, key: `prepare:${doc.id}`, userId: doc.preparedById, initiatorId: doc.createdById, taskType: 'prepare', title: doc.title,
          description: 'You are assigned to prepare this document. Write the content, confirm preparation and submit it for review.',
          assignedAt: assigned, dueAt: due(assigned, 'prepare'),
        });
      }
    }
    if (doc.status === DocumentStatus.IN_REVIEW && doc.reviewerId) {
      tasks.push({
        ...base, key: `review:${doc.id}`, userId: doc.reviewerId, initiatorId: doc.preparedById ?? doc.createdById, taskType: 'review', title: doc.title,
        description: 'This document requires your review before it can proceed to approval.',
        assignedAt: since, dueAt: due(since, 'review'),
        extra: { ...base.extra, reviewCompleted: false, approveCompleted: false },
      });
    }
    if (doc.status === DocumentStatus.PENDING_APPROVAL && doc.approverId) {
      tasks.push({
        ...base, key: `approve:${doc.id}`, userId: doc.approverId, initiatorId: doc.reviewerId, taskType: 'approve', title: doc.title,
        description: 'This document is awaiting your approval.',
        assignedAt: since, dueAt: due(since, 'approve'),
        extra: { ...base.extra, reviewCompleted: true, approveCompleted: false },
      });
    }
    if (doc.status === DocumentStatus.APPROVED && doc.hubStatus === DocumentHubStatus.PENDING_COO_APPROVAL && coo) {
      const assigned = at(doc.transferredToHubAt, doc.approvedAt, doc.updatedAt);
      tasks.push({
        ...base, key: `hub_approval:${doc.id}`, userId: coo.id, initiatorId: doc.approverId, taskType: 'hub_approval', title: doc.title,
        description: 'Approved and moved to the Document Hub. Give final approval and classify it, or return it to the approver.',
        link: '/document-hub', assignedAt: assigned, dueAt: due(assigned, 'hub_approval'),
      });
    }
  }

  // ---- Document comments (one task per comment per mentioned user) ----
  for (const c of openComments) {
    exists('document_comment', c.id);
    if (c.status !== DocumentCommentStatus.OPEN) continue;
    const doc = docById.get(c.documentId);
    if (!doc || doc.isLocked) { cancelledKeys.add(`comment:${c.id}`); continue; }
    for (const assigneeId of c.assigneeIds) {
      if (assigneeId === c.authorId) continue;
      tasks.push({
        key: `comment:${c.id}`, userId: assigneeId, initiatorId: c.authorId, taskType: 'comment', title: doc.title, reference: doc.documentCode,
        description: `${userName.get(c.authorId) || 'Someone'} mentioned you: "${c.content.slice(0, 120)}"`,
        link: `/documents/${doc.id}/edit`, assignedAt: at(c.createdAt), dueAt: due(at(c.createdAt), 'comment'),
        entityType: 'document_comment', entityId: c.id, documentId: doc.id,
        extra: { documentCode: doc.documentCode },
      });
    }
  }

  // ---- Download requests (any admin / QM) and access requests (COO only) ----
  for (const r of pendingDownloads) {
    exists('download_request', r.id);
    if (r.status !== 'pending') continue;
    const doc = docById.get(r.documentId);
    if (!doc) continue;
    for (const a of approvers) {
      tasks.push({
        key: `download_approval:${r.id}`, userId: a.id, taskType: 'download_approval', title: doc.title, reference: doc.documentCode,
        description: `${userName.get(r.requesterId) || 'A user'} asked to download this document.${r.reason ? ` Reason: "${r.reason}"` : ''}`,
        link: '/tasks', assignedAt: at(r.createdAt), dueAt: due(at(r.createdAt), 'download_approval'),
        entityType: 'download_request', entityId: r.id, documentId: doc.id,
        extra: { documentCode: doc.documentCode, downloadRequestId: r.id, requesterId: r.requesterId, reason: r.reason },
      });
    }
  }
  for (const r of pendingAccess) {
    exists('document_access_request', r.id);
    if (r.status !== 'pending' || !coo) continue;
    const doc = docById.get(r.documentId);
    if (!doc) continue;
    tasks.push({
      key: `access_approval:${r.id}`, userId: coo.id, taskType: 'access_approval', title: doc.title, reference: doc.documentCode,
      description: `${userName.get(r.requesterId) || 'A user'} has requested access to view this document.${r.requestReason ? ` Reason: "${r.requestReason}"` : ''}`,
      link: '/tasks', assignedAt: at(r.createdAt), dueAt: due(at(r.createdAt), 'access_approval'),
      entityType: 'document_access_request', entityId: r.id, documentId: doc.id,
      extra: {
        documentCode: doc.documentCode, accessRequestId: r.id, requesterId: r.requesterId,
        requesterName: userName.get(r.requesterId) || 'Unknown User', reason: r.requestReason,
      },
    });
  }

  // ---- HR: employee records ----
  const employeeById = new Map(allEmployees.map(e => [e.id, e]));
  for (const emp of allEmployees) {
    exists('employee', emp.id);
    const supervisorName = emp.supervisorId ? employeeById.get(emp.supervisorId)?.name ?? null : null;
    const extra = {
      employeeId: emp.id, employeeName: emp.name, employeeEmail: emp.email, employeePhone: emp.phone || null,
      employeeJobTitle: emp.jobTitle, employeeDepartment: emp.department, employeeSupervisorName: supervisorName,
    };
    if (emp.workflowStatus === EmployeeRecordStatus.IN_REVIEW && emp.reviewerId) {
      const assigned = at(emp.submittedForReviewAt, emp.createdAt);
      tasks.push({
        key: `employee_review:${emp.id}`, userId: emp.reviewerId, initiatorId: emp.createdByUserId, taskType: 'employee_review', title: `Review Employee Record: ${emp.name}`,
        reference: emp.employeeNumber, description: 'This employee record requires your review before it can proceed to approval.',
        link: '/hr', assignedAt: assigned, dueAt: due(assigned, 'employee_review'), entityType: 'employee', entityId: emp.id, extra,
      });
    }
    if (emp.workflowStatus === EmployeeRecordStatus.PENDING_APPROVAL && emp.approverId) {
      const assigned = at(emp.submittedForApprovalAt, emp.createdAt);
      tasks.push({
        key: `employee_approve:${emp.id}`, userId: emp.approverId, initiatorId: emp.reviewerId, taskType: 'employee_approve', title: `Approve Employee Record: ${emp.name}`,
        reference: emp.employeeNumber, description: 'This employee record is awaiting your approval.',
        link: '/hr', assignedAt: assigned, dueAt: due(assigned, 'employee_approve'), entityType: 'employee', entityId: emp.id, extra,
      });
    }
  }

  // An employee's login: the linked user, or else the user with the same email address
  const userByEmail = new Map(activeUsers.map(u => [u.email.toLowerCase(), u.id]));
  const employeeUserId = (emp: { userId: number | null; email: string }) => emp.userId ?? userByEmail.get(emp.email.toLowerCase());

  // ---- HR: tasks assigned to an employee (shown to the linked user) ----
  for (const t of allEmployeeTasks) {
    exists('employee_task', t.id);
    if (t.status === TaskStatus.CANCELLED) { cancelledKeys.add(`employee_task:${t.id}`); continue; }
    if (t.status === TaskStatus.COMPLETED) continue;
    const emp = employeeById.get(t.employeeId);
    const ownerId = emp && employeeUserId(emp);
    if (!ownerId) continue;
    const assigned = at(t.createdAt);
    tasks.push({
      key: `employee_task:${t.id}`, userId: ownerId, initiatorId: t.assignedByUserId, dueSource: t.dueDate ? 'source' : 'default', taskType: 'employee_task', title: t.title,
      reference: `Priority: ${t.priority}`, description: t.description || 'Task assigned to you by HR.',
      link: '/employees', assignedAt: assigned, dueAt: t.dueDate ? endOfDay(t.dueDate) : due(assigned, 'employee_task'),
      entityType: 'employee_task', entityId: t.id,
    });
  }

  // ---- Trainings assigned to an employee ----
  const trainingById = new Map(allTrainings.map(t => [t.id, t]));
  for (const a of allTrainingAssignments) {
    exists('training_assignment', a.id);
    if (a.status === TrainingAssignmentStatus.CANCELLED) { cancelledKeys.add(`training:${a.id}`); continue; }
    if (a.status === TrainingAssignmentStatus.COMPLETED) continue;
    const emp = employeeById.get(a.employeeId);
    const ownerId = emp && employeeUserId(emp);
    if (!ownerId) continue;
    const training = trainingById.get(a.trainingId);
    const assigned = at(a.createdAt);
    tasks.push({
      key: `training:${a.id}`, userId: ownerId, initiatorId: a.assignedById, dueSource: a.dueDate ? 'source' : 'default', taskType: 'training', title: training?.title || 'Training',
      reference: training?.type ? training.type.charAt(0).toUpperCase() + training.type.slice(1) : 'Training',
      description: training?.description || 'Complete this training assigned to you.',
      link: '/trainings', assignedAt: assigned, dueAt: a.dueDate ? endOfDay(a.dueDate) : due(assigned, 'training'),
      entityType: 'training_assignment', entityId: a.id,
    });
  }

  // ---- Monthly performance reports: COO reviews, CEO approves ----
  for (const r of allReports) {
    exists('performance_report', r.id);
    const who = userName.get(r.userId) || 'a user';
    const ref = `${String(r.reportMonth).padStart(2, '0')}/${r.reportYear}`;
    if (r.status === MonthlyReportStatus.IN_REVIEW && coo) {
      const assigned = at(r.updatedAt, r.createdAt);
      tasks.push({
        key: `report_review:${r.id}`, userId: coo.id, taskType: 'report_review', title: `Performance report: ${who}`,
        reference: ref, description: 'Review this monthly performance report and forward it to the CEO.',
        link: '/performance-reports', assignedAt: assigned, dueAt: due(assigned, 'report_review'),
        entityType: 'performance_report', entityId: r.id,
      });
    }
    if (r.status === MonthlyReportStatus.PENDING_APPROVAL && ceo) {
      const assigned = at(r.reviewedAt, r.updatedAt);
      tasks.push({
        key: `report_approve:${r.id}`, userId: ceo.id, taskType: 'report_approve', title: `Performance report: ${who}`,
        reference: ref, description: 'Approve this monthly performance report.',
        link: '/performance-reports', assignedAt: assigned, dueAt: due(assigned, 'report_approve'),
        entityType: 'performance_report', entityId: r.id,
      });
    }
  }

  // ---- Bug reports: assignee (or the COO when unassigned) fixes; the COO verifies and closes ----
  for (const b of allBugs) {
    exists('bug_report', b.id);
    if (b.status === BugReportStatus.OPEN || b.status === BugReportStatus.IN_PROGRESS) {
      const ownerId = b.assignedToId ?? coo?.id;
      if (!ownerId) continue;
      const assigned = at(b.createdAt);
      tasks.push({
        key: `bug:${b.id}`, userId: ownerId, taskType: 'bug', title: b.title, reference: b.ticketNumber,
        description: `${b.priority.charAt(0).toUpperCase() + b.priority.slice(1)} priority bug reported by ${userName.get(b.reportedById) || 'a user'}.`,
        link: '/bug-reports', assignedAt: assigned, dueAt: due(assigned, `bug_${b.priority}`),
        entityType: 'bug_report', entityId: b.id,
      });
    }
    if (b.status === BugReportStatus.RESOLVED && coo) {
      const assigned = at(b.resolvedAt, b.updatedAt);
      tasks.push({
        key: `bug_verify:${b.id}`, userId: coo.id, taskType: 'bug_verify', title: b.title, reference: b.ticketNumber,
        description: 'This bug has been resolved. Verify the fix and close the ticket.',
        link: '/bug-reports', assignedAt: assigned, dueAt: due(assigned, 'bug_verify'),
        entityType: 'bug_report', entityId: b.id,
      });
    }
  }

  // ---- CRM: lead follow-ups and update requests ----
  const closedLeadStatuses: string[] = [LeadStatus.APPROVED, LeadStatus.LOST, LeadStatus.NOT_INTERESTED, LeadStatus.NOT_RELEVANT];
  for (const lead of allLeads) {
    exists('lead', lead.id);
    if (!lead.assignedToId || !lead.nextFollowUpDate || closedLeadStatuses.includes(lead.leadStatus)) continue;
    const dueAt = endOfDay(lead.nextFollowUpDate);
    tasks.push({
      // a new follow-up date is a new piece of work
      key: `lead_followup:${lead.id}:${dueAt.toISOString().slice(0, 10)}`, userId: lead.assignedToId, initiatorId: lead.createdById, dueSource: 'source', taskType: 'lead_followup',
      title: `Follow up: ${lead.leadName}${lead.companyName ? ` (${lead.companyName})` : ''}`, reference: lead.interestedCourse || 'Lead',
      description: `Follow up with this lead by ${dueAt.toLocaleDateString('en-GB')}.`,
      link: '/crm/leads', assignedAt: at(lead.updatedAt, lead.createdAt), dueAt,
      entityType: 'lead', entityId: lead.id,
    });
  }
  const leadById = new Map(allLeads.map(l => [l.id, l]));
  for (const r of pendingLeadRequests) {
    exists('lead_update_request', r.id);
    if (r.isResolved) continue;
    const lead = leadById.get(r.leadId);
    const assigned = at(r.createdAt);
    tasks.push({
      key: `lead_update:${r.id}`, userId: r.requestedFromId, initiatorId: r.requestedById, taskType: 'lead_update',
      title: `Update requested: ${lead?.leadName || 'Lead'}`, reference: lead?.companyName || 'Lead',
      description: `${userName.get(r.requestedById) || 'Management'} asked for an update.${r.message ? ` "${r.message}"` : ''}`,
      link: '/crm/leads', assignedAt: assigned, dueAt: due(assigned, 'lead_update'),
      entityType: 'lead_update_request', entityId: r.id,
    });
  }

  // ---- Certification: assigned auditors (no fixed deadline), audits led ----
  const closedAppStatuses: string[] = [
    CertificationApplicationStatus.CERTIFICATE_ISSUED, CertificationApplicationStatus.REJECTED,
    CertificationApplicationStatus.SUSPENDED, CertificationApplicationStatus.WITHDRAWN,
  ];
  for (const app of allCertApps) {
    exists('certification_application', app.id);
    if (closedAppStatuses.includes(app.status)) {
      if (app.status !== CertificationApplicationStatus.CERTIFICATE_ISSUED) cancelledKeys.add(`certification:${app.id}`);
      continue;
    }
    for (const auditorId of Array.from(new Set([app.assignedAuditorId, app.leadAuditorId]))) {
      if (!auditorId) continue;
      tasks.push({
        key: `certification:${app.id}`, userId: auditorId, taskType: 'certification', title: `${app.clientName} - ${app.standardName}`,
        reference: app.applicationNumber, description: `Certification application in status "${app.status.replace(/_/g, ' ')}".`,
        link: '/certification', assignedAt: at(app.updatedAt, app.createdAt), dueAt: null,
        entityType: 'certification_application', entityId: app.id,
      });
    }
  }
  const appById = new Map(allCertApps.map(a => [a.id, a]));
  for (const audit of allCertAudits) {
    exists('certification_audit', audit.id);
    if (audit.status === AuditStatus.CANCELLED) { cancelledKeys.add(`certification_audit:${audit.id}`); continue; }
    if (audit.status === AuditStatus.COMPLETED || !audit.leadAuditorId) continue;
    const app = appById.get(audit.applicationId);
    const assigned = at(audit.createdAt);
    tasks.push({
      key: `certification_audit:${audit.id}`, userId: audit.leadAuditorId, dueSource: audit.scheduledDate ? 'source' : 'default', taskType: 'certification_audit',
      title: `${audit.auditType.replace(/_|\d/g, ' ').trim()} audit: ${app?.clientName || 'Client'}`, reference: app?.applicationNumber || 'Audit',
      description: audit.scheduledDate ? `Scheduled for ${audit.scheduledDate.toLocaleDateString('en-GB')}.` : 'Audit not yet scheduled.',
      link: '/certification', assignedAt: assigned,
      dueAt: audit.scheduledDate ? due(endOfDay(audit.scheduledDate), 'certification_audit') : null,
      entityType: 'certification_audit', entityId: audit.id,
    });
  }

  // ---- Document amendments waiting for the named approver ----
  for (const entry of pendingAmendments) {
    exists('revision_history', entry.id);
    if (entry.status !== RevisionHistoryStatus.PENDING || !entry.approvedById) continue;
    const doc = docById.get(entry.documentId);
    if (!doc) continue;
    const assigned = at(entry.createdAt);
    tasks.push({
      key: `amendment_approval:${entry.id}`, userId: entry.approvedById, initiatorId: entry.requestedById, taskType: 'amendment_approval', title: doc.title,
      reference: doc.documentCode, description: `Amendment request: ${entry.description}`,
      link: `/documents/${doc.id}/edit`, assignedAt: assigned, dueAt: due(assigned, 'amendment_approval'),
      entityType: 'revision_history', entityId: entry.id, documentId: doc.id,
      extra: { documentCode: doc.documentCode },
    });
  }

  // ---- DocuGenie forms assigned to someone who has not submitted yet ----
  for (const form of allForms) {
    exists('docugenie_form', form.id);
    if (!form.assignedToId) continue;
    if (form.status === DocuGenieFormStatus.ARCHIVED) { cancelledKeys.add(`form_fill:${form.id}`); continue; }
    if (form.status !== DocuGenieFormStatus.PUBLISHED) continue;
    if (allSubmissions.some(s => s.formId === form.id && s.submittedById === form.assignedToId)) continue;
    const assigned = at(form.updatedAt, form.createdAt);
    tasks.push({
      key: `form_fill:${form.id}`, userId: form.assignedToId, initiatorId: form.createdById, dueSource: form.expiresAt ? 'source' : 'default', taskType: 'form_fill', title: form.title, reference: 'DocuGenie',
      description: form.description || 'Fill in and submit this form.',
      link: form.shareToken ? `/form/${form.shareToken}` : '/docugenie', assignedAt: assigned,
      dueAt: form.expiresAt ?? due(assigned, 'form_fill'), entityType: 'docugenie_form', entityId: form.id,
    });
  }

  // A target date set when the task was assigned or forwarded overrides everything else
  const assignments = new Map((await db.select().from(taskAssignments)).map(a => [a.taskKey, a]));
  for (const t of tasks) {
    const assignment = assignments.get(t.key);
    if (assignment) {
      t.dueAt = assignment.targetDate;
      t.dueSource = 'target';
      t.initiatorId = assignment.initiatorId;
    } else {
      t.dueSource ??= 'default';
    }
  }

  return { tasks, existingEntities, cancelledKeys };
}
