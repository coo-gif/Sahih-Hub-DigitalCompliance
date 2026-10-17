import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  internalAudits, InternalAuditStatus, type InternalAudit, users, employees, documents, userRecords,
  monthlyPerformanceReports, trainings, trainingAssignments, trainingCompletions, documentAccess, documentAccessRequests,
  workflowLogs, auditLogs, userActivityLogs, taskAssignments, taskRecords, certificationApplications, certificationAudits,
  auditFindings, bugReports, changeRequests, revisionHistory, documentComments, AuditAction, UserRole, UrgencyLevel,
} from "@shared/schema";
import {
  ALL_CHECKS, SAMPLING_ITEMS, emptyAudit, emptyResponse, summarize, validateAudit, requiresAction,
  type AuditRecord, type CheckResponse,
} from "@shared/auditTemplate";

const COO_EMAIL = 'coo@sahihcertify.com';
const CEO_EMAIL = 'ceo@sahihcertify.com';
type AuthedUser = { id: number; email: string; role: string; name: string };
const userOf = (req: Request) => (req as any).user as AuthedUser;

// Management signs off internal audits; admins, the QM and management see and run all of them
const isManagement = (u: AuthedUser) => u.email === COO_EMAIL || u.email === CEO_EMAIL;
const isAuditAdmin = (u: AuthedUser) => isManagement(u) || u.role === UserRole.ADMIN || u.role === UserRole.QUALITY_MANAGER;
const canCreate = (u: AuthedUser) => isAuditAdmin(u) || u.role === UserRole.AUDITOR;

export const parseRecord = (audit: InternalAudit): AuditRecord => {
  const base = emptyAudit();
  const saved = JSON.parse(audit.record) as Partial<AuditRecord>;
  return {
    meta: { ...base.meta, ...saved.meta },
    responses: Object.fromEntries(ALL_CHECKS.map(c => [c.id, { ...emptyResponse(), ...saved.responses?.[c.id] }])),
    sampling: Object.fromEntries(SAMPLING_ITEMS.map(s => [s.key, { ...base.sampling[s.key], ...saved.sampling?.[s.key] }])),
    signOff: { ...base.signOff, ...saved.signOff },
  };
};

const isTeam = (audit: InternalAudit, userId: number) =>
  audit.leadAuditorId === userId || (audit.auditTeamIds ?? []).includes(userId);
const actionOwnerOf = (record: AuditRecord, userId: number) =>
  ALL_CHECKS.filter(c => requiresAction(record.responses[c.id].rating) && record.responses[c.id].ownerId === userId).map(c => c.id);

function permissions(audit: InternalAudit, record: AuditRecord, user: AuthedUser) {
  const team = isTeam(audit, user.id);
  const editable = audit.status === InternalAuditStatus.DRAFT || audit.status === InternalAuditStatus.IN_PROGRESS;
  return {
    canView: isAuditAdmin(user) || user.role === UserRole.AUDITOR || team || actionOwnerOf(record, user.id).length > 0,
    canEdit: editable && (team || isAuditAdmin(user)),
    canSubmit: editable && (audit.leadAuditorId === user.id || isAuditAdmin(user)),
    canSignOff: audit.status === InternalAuditStatus.PENDING_SIGNOFF && isManagement(user),
    canVerify: audit.status !== InternalAuditStatus.DRAFT && (audit.leadAuditorId === user.id || isAuditAdmin(user)),
    canDelete: audit.status === InternalAuditStatus.DRAFT && (audit.createdById === user.id || isAuditAdmin(user)),
    myActions: actionOwnerOf(record, user.id),
  };
}

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IA-${year}-`;
  const rows = await db.select({ reference: internalAudits.reference }).from(internalAudits);
  const max = rows
    .filter(r => r.reference.startsWith(prefix))
    .reduce((m, r) => Math.max(m, parseInt(r.reference.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date (yyyy-mm-dd)');

const responseSchema = z.object({
  rating: z.enum(["not_assessed", "compliant", "observation", "minor_nc", "major_nc"]),
  evidenceRef: z.string().max(4000).default(""),
  details: z.string().max(8000).default(""),
  rootCause: z.string().max(4000).default(""),
  correctiveAction: z.string().max(4000).default(""),
  owner: z.string().max(200).default(""),
  ownerId: z.number().int().positive().nullable().default(null),
  dueDate: z.union([dateString, z.literal("")]).default(""),
  actionTaken: z.string().max(4000).default(""),
  actionCompleted: z.boolean().default(false),
  effectivenessVerified: z.boolean().default(false),
}).partial();

const recordSchema = z.object({
  meta: z.object({
    periodStart: z.union([dateString, z.literal("")]),
    periodEnd: z.union([dateString, z.literal("")]),
    leadAuditorId: z.number().int().positive().nullable(),
    auditTeamIds: z.array(z.number().int().positive()).max(20),
    scopeNotes: z.string().max(8000),
  }).partial(),
  responses: z.record(responseSchema),
  sampling: z.record(z.object({
    completed: z.boolean(),
    populationSize: z.string().max(50),
    sampleSize: z.string().max(50),
  }).partial()),
}).partial();

/** Live figures from the system for each check and sampling population (framework section 12). */
async function collectEvidence(from?: string, to?: string) {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  const inPeriod = (d: Date | null | undefined) => !!d && (!start || d >= start) && (!end || d <= end);
  const now = new Date();
  const plural = (n: number, word: string) => `${n} ${n === 1 ? word : word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`}`;

  const [
    allUsers, allEmployees, allDocs, allRecords, reports, allTrainings, assignments, completions, access, accessRequests,
    wfLogs, aLogs, activity, targets, ledger, apps, certAudits, findings, bugs, crs, revisions, comments,
  ] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role, isActive: users.isActive, inductionStatus: users.inductionStatus }).from(users),
    db.select().from(employees),
    db.select().from(documents),
    db.select({ id: userRecords.id, reportType: userRecords.reportType, createdAt: userRecords.createdAt }).from(userRecords),
    db.select().from(monthlyPerformanceReports),
    db.select().from(trainings),
    db.select().from(trainingAssignments),
    db.select().from(trainingCompletions),
    db.select().from(documentAccess),
    db.select().from(documentAccessRequests),
    db.select().from(workflowLogs),
    db.select({ id: auditLogs.id, action: auditLogs.action, previousValue: auditLogs.previousValue, newValue: auditLogs.newValue, createdAt: auditLogs.createdAt }).from(auditLogs),
    db.select().from(userActivityLogs),
    db.select().from(taskAssignments),
    db.select().from(taskRecords),
    db.select().from(certificationApplications),
    db.select().from(certificationAudits),
    db.select().from(auditFindings),
    db.select().from(bugReports),
    db.select().from(changeRequests),
    db.select().from(revisionHistory),
    db.select().from(documentComments),
  ]);

  const activeUsers = allUsers.filter(u => u.isActive !== false);
  const approvedDocs = allDocs.filter(d => d.isLocked || d.status === 'approved');
  const liveDocs = approvedDocs.filter(d => !['obsolete', 'quarantine'].includes(d.lifecycleStatus ?? ''));
  const overdueReview = liveDocs.filter(d => d.nextReviewDate && d.nextReviewDate < now);
  const dueSoon = liveDocs.filter(d => d.nextReviewDate && d.nextReviewDate >= now && d.nextReviewDate.getTime() - now.getTime() < 30 * 86400000);
  const noReviewDate = liveDocs.filter(d => !d.nextReviewDate);
  const periodReports = reports.filter(r => {
    const d = new Date(r.reportYear, r.reportMonth - 1, 15);
    return inPeriod(d) || (!start && !end);
  });
  const reportsBy = (status: string) => periodReports.filter(r => r.status === status).length;
  const openFindings = findings.filter(f => f.status !== 'closed');
  const openNcs = openFindings.filter(f => f.findingType === 'major_nc' || f.findingType === 'minor_nc');
  const overdueFindings = openFindings.filter(f => f.targetClosureDate && f.targetClosureDate < now);
  const overdueAssignments = assignments.filter(a => a.status !== 'completed' && a.dueDate && a.dueDate < now);
  const openLedger = ledger.filter(t => t.status === 'open');
  const overdueTasks = openLedger.filter(t => t.dueAt && t.dueAt < now);
  const periodLedger = ledger.filter(t => inPeriod(t.assignedAt) || (!start && !end));
  const closedLedger = periodLedger.filter(t => t.status === 'completed');
  const onTime = closedLedger.filter(t => t.completedOnTime).length;
  const periodLogs = aLogs.filter(l => inPeriod(l.createdAt) || (!start && !end));
  const updateLogs = periodLogs.filter(l => l.action === AuditAction.UPDATE);
  const incompleteUpdates = updateLogs.filter(l => !l.previousValue || !l.newValue);
  const periodCrs = crs.filter(c => inPeriod(c.submittedAt ?? c.createdAt) || (!start && !end));
  const crOpen = crs.filter(c => c.status === 'submitted' || c.status === 'accepted');
  const crDone = periodCrs.filter(c => c.status === 'implemented');
  const approvedPeriodReports = periodReports.filter(r => r.status === 'approved');
  const avg = (vals: number[]) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
  const jobTitles = new Set(allEmployees.map(e => (e.jobTitle || '').trim().toLowerCase()).filter(Boolean));
  const jdDocs = allDocs.filter(d => d.category === 'job_description');
  const employeesMissing = allEmployees.filter(e => !e.jobTitle || !e.department || !e.supervisorId);
  const employeesNoTraining = allEmployees.filter(e => !assignments.some(a => a.employeeId === e.id));
  const workflowDocs = allDocs.filter(d => ['in_review', 'pending_approval'].includes(d.status));
  const docsNoOwner = workflowDocs.filter(d => !d.reviewerId || !d.approverId);
  const restrictedNoGrant = approvedDocs.filter(d => d.classification && d.classification !== 'public_information'
    && !access.some(a => a.documentId === d.id && !a.isRevoked));
  const activeMinutes = activity.filter(a => inPeriod(a.sessionStart) || (!start && !end)).reduce((s, a) => s + (a.totalActiveMinutes ?? 0), 0);
  const reasonless = revisions.filter(r => !r.reason || !r.reason.trim());
  const crPoints = comments.filter(c => c.kind === 'change_request');
  const openBugs = bugs.filter(b => b.status !== 'closed');
  const codes = (docs: { documentCode: string }[]) => docs.slice(0, 8).map(d => d.documentCode).join(', ') + (docs.length > 8 ? '…' : '');
  const names = (rows: { name: string }[]) => rows.slice(0, 6).map(r => r.name).join(', ') + (rows.length > 6 ? '…' : '');

  type Item = { summary: string; attention: boolean };
  const checks: Record<string, Item> = {
    'C4.1': { summary: `${plural(activeUsers.length, 'active user')}; ${activeUsers.filter(u => !u.role).length} without a role.`, attention: activeUsers.some(u => !u.role) },
    'C4.2': { summary: `${plural(allEmployees.length, 'employee record')}; ${employeesMissing.length} missing job title, department or supervisor${employeesMissing.length ? ` (${names(employeesMissing)})` : ''}.`, attention: employeesMissing.length > 0 },
    'C4.3': { summary: `${plural(jdDocs.length, 'job description document')} (${jdDocs.filter(d => d.isLocked).length} approved) for ${plural(jobTitles.size, 'distinct job title')}.`, attention: jdDocs.filter(d => d.isLocked).length < jobTitles.size },
    'C4.4': { summary: `${activeUsers.filter(u => u.inductionStatus !== 'completed').length} of ${activeUsers.length} active users with induction not completed; ${plural(completions.length, 'training completion')} on record.`, attention: activeUsers.some(u => u.inductionStatus !== 'completed') },
    'C4.5': { summary: `${plural(workflowDocs.length, 'document')} in review/approval, ${docsNoOwner.length} without a named reviewer or approver; ${wfLogs.filter(l => inPeriod(l.createdAt) || (!start && !end)).length} workflow log entries in the period.`, attention: docsNoOwner.length > 0 },
    'C5.1': { summary: `Monthly performance reports in the period: ${periodReports.length} (approved ${reportsBy('approved')}, awaiting CEO ${reportsBy('pending_approval')}, awaiting COO ${reportsBy('in_review')}, draft ${reportsBy('draft')}).`, attention: periodReports.length === 0 || reportsBy('approved') < periodReports.length },
    'C5.2': { summary: `${periodLogs.filter(l => l.action === AuditAction.APPROVE).length} approval entries in the audit log; ${approvedDocs.filter(d => d.hubApprovedAt && (inPeriod(d.hubApprovedAt) || (!start && !end))).length} documents given COO final approval in the period.`, attention: false },
    'C5.3': { summary: `Change requests in the period: ${periodCrs.length} (implemented ${crDone.length}); ${crOpen.length} currently open.`, attention: crOpen.length > 0 },
    'C5.4': { summary: `Certification audit findings: ${findings.length} total, ${openNcs.length} non-conformities open (${openNcs.filter(f => f.findingType === 'major_nc').length} major).`, attention: openNcs.length > 0 },
    'C6.1': { summary: `${plural(allTrainings.length, 'training')} defined; ${employeesNoTraining.length} of ${allEmployees.length} employees have no training assigned${employeesNoTraining.length ? ` (${names(employeesNoTraining)})` : ''}.`, attention: employeesNoTraining.length > 0 },
    'C6.2': { summary: `${plural(assignments.length, 'training assignment')}: ${assignments.filter(a => a.status === 'completed').length} completed, ${overdueAssignments.length} overdue.`, attention: overdueAssignments.length > 0 },
    'C6.3': { summary: `${plural(liveDocs.length, 'approved document')} in use: ${overdueReview.length} overdue for review${overdueReview.length ? ` (${codes(overdueReview)})` : ''}, ${noReviewDate.length} without a review date${noReviewDate.length ? ` (${codes(noReviewDate)})` : ''}.`, attention: overdueReview.length + noReviewDate.length > 0 },
    'C6.4': { summary: `${plural(apps.length, 'certification application')}; ${certAudits.filter(a => inPeriod(a.scheduledDate) || (!start && !end)).length} certification audits scheduled in the period.`, attention: false },
    'C7.1': { summary: `Access requests: ${accessRequests.filter(r => r.status === 'approved').length} approved, ${accessRequests.filter(r => r.status === 'rejected').length} rejected, ${accessRequests.filter(r => r.status === 'pending').length} pending; ${access.filter(a => !a.isRevoked).length} active grants.`, attention: accessRequests.some(r => r.status === 'pending') },
    'C7.2': { summary: `${access.filter(a => a.isRevoked).length} grants revoked (${access.filter(a => a.isRevoked && a.revokedAt).length} with a revocation date).`, attention: access.some(a => a.isRevoked && !a.revokedAt) },
    'C7.3': { summary: `${plural(periodLogs.length, 'audit log entry')} in the period; ${incompleteUpdates.length} of ${updateLogs.length} updates lack a previous or new value; ${activeMinutes} active minutes logged.`, attention: incompleteUpdates.length > 0 || activeMinutes === 0 },
    'C7.4': { summary: `${approvedDocs.length} controlled documents; ${restrictedNoGrant.length} restricted ones with no access granted beyond the COO and workflow${restrictedNoGrant.length ? ` (${codes(restrictedNoGrant)})` : ''}.`, attention: false },
    'C8.1': { summary: `${plural(targets.length, 'task')} with a target date and initiator recorded; ${periodLedger.filter(t => !t.dueAt).length} tasks in the period without a due date.`, attention: periodLedger.some(t => !t.dueAt) },
    'C8.2': { summary: `Tasks in the period: ${periodLedger.length} (completed ${closedLedger.length}, ${onTime} on time); ${overdueTasks.length} open tasks overdue now.`, attention: overdueTasks.length > 0 },
    'C8.3': { summary: `${openFindings.length} findings open, ${overdueFindings.length} past their target closure date.`, attention: overdueFindings.length > 0 },
    'C8.4': { summary: `Certification audits: ${certAudits.filter(a => a.status !== 'completed').length} open, ${certAudits.filter(a => a.status === 'completed').length} completed; ${crs.filter(c => c.status === 'accepted').length} accepted change requests awaiting implementation.`, attention: false },
    'C9.1': { summary: `${approvedPeriodReports.length} of ${periodReports.length} monthly reports in the period completed (approved).`, attention: approvedPeriodReports.length < periodReports.length },
    'C9.2': { summary: approvedPeriodReports.length ? `Approved reports: average performance score ${avg(approvedPeriodReports.map(r => r.performanceScore ?? 0))}, average on-time rate ${avg(approvedPeriodReports.map(r => r.onTimeRate ?? 0))}%.` : 'No approved monthly reports in the period.', attention: approvedPeriodReports.length === 0 },
    'C9.3': { summary: `${openNcs.length} open non-conformities from certification audits; ${openBugs.length} open bug reports.`, attention: openNcs.length + openBugs.length > 0 },
    'C9.4': { summary: `${plural(allRecords.length, 'user record')} (${allRecords.filter(r => inPeriod(r.createdAt) || (!start && !end)).length} in the period); ${aLogs.length} audit log entries in total.`, attention: allRecords.length === 0 },
    'C9.5': { summary: `Review alerts now: ${overdueReview.length} overdue (red), ${dueSoon.length} due within 30 days (yellow).`, attention: overdueReview.length > 0 },
    'C10.1': { summary: `${periodCrs.length} change requests in the period, ${crDone.length} implemented; ${crs.filter(c => c.status === 'accepted').length} accepted but not yet implemented.`, attention: crs.some(c => c.status === 'accepted') },
    'C10.2': { summary: `${plural(revisions.length, 'revision history entry')}; ${reasonless.length} without a recorded reason.`, attention: reasonless.length > 0 },
    'C10.3': { summary: `${plural(comments.length, 'document comment')}, of which ${crPoints.length} are change-request points with a reason.`, attention: false },
    'C10.4': { summary: `Findings closed with verification: ${findings.filter(f => f.status === 'closed' && f.verifiedAt).length} of ${findings.filter(f => f.status === 'closed').length}; bugs closed: ${bugs.filter(b => b.status === 'closed').length}.`, attention: findings.some(f => f.status === 'closed' && !f.verifiedAt) },
  };

  const periodDocs = allDocs.filter(d => inPeriod(d.createdAt) || (!start && !end));
  const sampleOf = (n: number) => String(Math.min(n, Math.max(20, Math.ceil(n * 0.1))));
  const otherAudits = await db.select().from(internalAudits);
  const openAuditActions = otherAudits.reduce((n, a) => {
    const r = parseRecord(a);
    return n + ALL_CHECKS.filter(c => requiresAction(r.responses[c.id].rating) && !r.responses[c.id].effectivenessVerified).length;
  }, 0);
  const sampling: Record<string, { populationSize: string; sampleSize: string }> = {
    recent_documents: { populationSize: String(periodDocs.length), sampleSize: sampleOf(periodDocs.length) },
    overdue_reviews: { populationSize: String(overdueReview.length), sampleSize: String(overdueReview.length) },
    missing_review_date: { populationSize: String(noReviewDate.length), sampleSize: String(noReviewDate.length) },
    open_corrective_actions: { populationSize: String(openFindings.filter(f => f.correctiveAction).length + openAuditActions), sampleSize: String(openFindings.filter(f => f.correctiveAction).length + openAuditActions) },
    overdue_tasks: { populationSize: String(overdueTasks.length), sampleSize: String(overdueTasks.length) },
    major_change_requests: { populationSize: String(periodCrs.filter(c => c.status === 'accepted' || c.status === 'implemented').length), sampleSize: String(periodCrs.filter(c => c.status === 'accepted' || c.status === 'implemented').length) },
    open_findings: { populationSize: String(openFindings.length), sampleSize: String(openFindings.length) },
    performance_reports: { populationSize: String(periodReports.length), sampleSize: String(periodReports.length) },
  };

  return { generatedAt: now.toISOString(), period: { from: from ?? null, to: to ?? null }, checks, sampling };
}

export function registerInternalAuditRoutes(app: Express, helpers: { requireAuth: (req: Request, res: Response, next: NextFunction) => unknown }) {
  const { requireAuth } = helpers;

  app.use('/api/internal-audits/:id', (req, res, next) => {
    if (req.params.id === 'evidence') return next();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid ID' });
    next();
  });

  const userNames = async () => new Map((await db.select({ id: users.id, name: users.name }).from(users)).map(u => [u.id, u.name]));

  const load = async (req: Request, res: Response) => {
    const [audit] = await db.select().from(internalAudits).where(eq(internalAudits.id, Number(req.params.id)));
    if (!audit) {
      res.status(404).json({ message: 'Internal audit not found' });
      return null;
    }
    const record = parseRecord(audit);
    const perms = permissions(audit, record, userOf(req));
    if (!perms.canView) {
      res.status(404).json({ message: 'Internal audit not found' });
      return null;
    }
    return { audit, record, perms };
  };

  const saveRecord = async (audit: InternalAudit, record: AuditRecord, extra: Partial<InternalAudit> = {}) => {
    const [updated] = await db.update(internalAudits).set({
      record: JSON.stringify(record),
      periodStart: record.meta.periodStart || null,
      periodEnd: record.meta.periodEnd || null,
      leadAuditorId: record.meta.leadAuditorId,
      auditTeamIds: record.meta.auditTeamIds,
      updatedAt: new Date(),
      ...extra,
    }).where(eq(internalAudits.id, audit.id)).returning();
    return updated;
  };

  const notify = async (userIds: (number | null | undefined)[], title: string, message: string, actorId: number) => {
    for (const userId of Array.from(new Set(userIds.filter((u): u is number => !!u && u !== actorId)))) {
      await storage.createNotification({ userId, title, message, urgencyLevel: UrgencyLevel.MEDIUM });
    }
  };
  const management = async () => (await db.select({ id: users.id, email: users.email }).from(users))
    .filter(u => u.email === COO_EMAIL || u.email === CEO_EMAIL).map(u => u.id);

  const view = (audit: InternalAudit, record: AuditRecord, perms: ReturnType<typeof permissions>, names: Map<number, string>) => ({
    ...audit,
    record,
    summary: summarize(record),
    issues: validateAudit(record),
    leadAuditorName: audit.leadAuditorId ? names.get(audit.leadAuditorId) ?? null : null,
    submittedByName: audit.submittedById ? names.get(audit.submittedById) ?? null : null,
    signedOffByName: audit.signedOffById ? names.get(audit.signedOffById) ?? null : null,
    permissions: perms,
  });

  // ---- Live evidence from the system for every check (framework section 12) ----
  app.get('/api/internal-audits/evidence', requireAuth, async (req, res) => {
    const user = userOf(req);
    if (!canCreate(user)) return res.status(403).json({ message: 'Only auditors, the QM, admins and management can run evidence queries' });
    const from = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : undefined;
    res.json(await collectEvidence(from, to));
  });

  app.get('/api/internal-audits', requireAuth, async (req, res) => {
    const user = userOf(req);
    const names = await userNames();
    const rows = await db.select().from(internalAudits).orderBy(desc(internalAudits.createdAt));
    res.json(rows.flatMap(audit => {
      const record = parseRecord(audit);
      const perms = permissions(audit, record, user);
      if (!perms.canView) return [];
      const { record: _r, ...rest } = view(audit, record, perms, names);
      return [rest];
    }));
  });

  app.post('/api/internal-audits', requireAuth, async (req, res) => {
    const user = userOf(req);
    if (!canCreate(user)) return res.status(403).json({ message: 'Only auditors, the QM, admins and management can start an internal audit' });
    const parsed = z.object({
      periodStart: dateString,
      periodEnd: dateString,
      leadAuditorId: z.number().int().positive(),
      auditTeamIds: z.array(z.number().int().positive()).max(20).default([]),
      scopeNotes: z.string().max(8000).default(''),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message, field: parsed.error.errors[0].path.join('.') });
    const input = parsed.data;
    if (input.periodEnd < input.periodStart) return res.status(400).json({ message: 'The audit period ends before it starts', field: 'periodEnd' });
    const names = await userNames();
    if (!names.has(input.leadAuditorId) || input.auditTeamIds.some(id => !names.has(id))) {
      return res.status(400).json({ message: 'Choose existing users for the audit team' });
    }

    const record = emptyAudit();
    record.meta = {
      ...record.meta,
      reference: await nextReference(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      leadAuditor: names.get(input.leadAuditorId)!,
      leadAuditorId: input.leadAuditorId,
      auditTeam: input.auditTeamIds.map(id => names.get(id)).join(', '),
      auditTeamIds: input.auditTeamIds,
      scopeNotes: input.scopeNotes,
    };
    const [audit] = await db.insert(internalAudits).values({
      reference: record.meta.reference,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      leadAuditorId: input.leadAuditorId,
      auditTeamIds: input.auditTeamIds,
      status: InternalAuditStatus.DRAFT,
      record: JSON.stringify(record),
      createdById: user.id,
    }).returning();
    await storage.createAuditLog({
      userId: user.id, action: AuditAction.CREATE, entityType: 'internal_audit', entityId: audit.id,
      newValue: JSON.stringify({ reference: audit.reference, periodStart: input.periodStart, periodEnd: input.periodEnd, leadAuditorId: input.leadAuditorId, auditTeamIds: input.auditTeamIds }),
    });
    await notify([input.leadAuditorId, ...input.auditTeamIds], 'Internal Audit Assigned',
      `You are on the audit team for internal audit ${audit.reference} (${input.periodStart} to ${input.periodEnd}).`, user.id);
    res.status(201).json(audit);
  });

  app.get('/api/internal-audits/:id', requireAuth, async (req, res) => {
    const loaded = await load(req, res);
    if (!loaded) return;
    res.json(view(loaded.audit, loaded.record, loaded.perms, await userNames()));
  });

  // Save the audit team's work (ratings, evidence, findings, sampling, details)
  app.put('/api/internal-audits/:id', requireAuth, async (req, res) => {
    const user = userOf(req);
    const loaded = await load(req, res);
    if (!loaded) return;
    const { audit, record, perms } = loaded;
    if (!perms.canEdit) {
      return res.status(403).json({ message: audit.status === InternalAuditStatus.DRAFT || audit.status === InternalAuditStatus.IN_PROGRESS
        ? 'Only the audit team, the QM and admins can edit this audit'
        : 'This audit has been submitted for sign-off and can no longer be edited' });
    }
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message, field: parsed.error.errors[0].path.join('.') });
    const input = parsed.data;
    const names = await userNames();
    const before = summarize(record);

    if (input.meta) {
      const m = input.meta;
      if (m.leadAuditorId !== undefined || m.auditTeamIds !== undefined) {
        // Only the QM / admins / management change who is on the team
        if (!isAuditAdmin(user) && (m.leadAuditorId !== record.meta.leadAuditorId
          || JSON.stringify(m.auditTeamIds ?? record.meta.auditTeamIds) !== JSON.stringify(record.meta.auditTeamIds))) {
          return res.status(403).json({ message: 'Only the QM, admins or management can change the audit team' });
        }
        if ((m.leadAuditorId && !names.has(m.leadAuditorId)) || (m.auditTeamIds ?? []).some(id => !names.has(id))) {
          return res.status(400).json({ message: 'Choose existing users for the audit team' });
        }
      }
      record.meta = {
        ...record.meta,
        ...(m.periodStart !== undefined ? { periodStart: m.periodStart } : {}),
        ...(m.periodEnd !== undefined ? { periodEnd: m.periodEnd } : {}),
        ...(m.scopeNotes !== undefined ? { scopeNotes: m.scopeNotes } : {}),
        ...(m.leadAuditorId !== undefined && m.leadAuditorId ? { leadAuditorId: m.leadAuditorId, leadAuditor: names.get(m.leadAuditorId)! } : {}),
        ...(m.auditTeamIds !== undefined ? { auditTeamIds: m.auditTeamIds, auditTeam: m.auditTeamIds.map(id => names.get(id)).join(', ') } : {}),
      };
      if (record.meta.periodStart && record.meta.periodEnd && record.meta.periodEnd < record.meta.periodStart) {
        return res.status(400).json({ message: 'The audit period ends before it starts', field: 'meta.periodEnd' });
      }
    }
    for (const [checkId, change] of Object.entries(input.responses ?? {})) {
      if (!record.responses[checkId]) return res.status(400).json({ message: `Unknown check ${checkId}` });
      const next: CheckResponse = { ...record.responses[checkId], ...change };
      if (next.ownerId) {
        if (!names.has(next.ownerId)) return res.status(400).json({ message: `${checkId}: choose an existing user as owner` });
        next.owner = names.get(next.ownerId)!;
      } else if (change.ownerId === null) {
        next.owner = '';
      }
      // Owner progress and verification have their own steps
      next.actionCompleted = record.responses[checkId].actionCompleted;
      next.actionTaken = record.responses[checkId].actionTaken;
      next.effectivenessVerified = record.responses[checkId].effectivenessVerified;
      if (!requiresAction(next.rating)) { next.actionCompleted = false; next.effectivenessVerified = false; }
      record.responses[checkId] = next;
    }
    for (const [key, change] of Object.entries(input.sampling ?? {})) {
      if (!record.sampling[key]) return res.status(400).json({ message: `Unknown sampling item ${key}` });
      record.sampling[key] = { ...record.sampling[key], ...change };
    }

    const after = summarize(record);
    const status = audit.status === InternalAuditStatus.DRAFT && after.assessed > 0 ? InternalAuditStatus.IN_PROGRESS : audit.status;
    const updated = await saveRecord(audit, record, { status });
    await storage.createAuditLog({
      userId: user.id, action: AuditAction.UPDATE, entityType: 'internal_audit', entityId: audit.id,
      previousValue: JSON.stringify({ status: audit.status, assessed: before.assessed, counts: before.counts }),
      newValue: JSON.stringify({ status, assessed: after.assessed, counts: after.counts, changedChecks: Object.keys(input.responses ?? {}) }),
    });
    const newlyOwned = Object.entries(input.responses ?? {})
      .filter(([checkId, change]) => change.ownerId && requiresAction(record.responses[checkId].rating))
      .map(([checkId]) => record.responses[checkId]);
    for (const r of newlyOwned) {
      await notify([r.ownerId], 'Internal Audit Corrective Action',
        `You own a corrective action from internal audit ${audit.reference}${r.dueDate ? `, due ${r.dueDate}` : ''}: ${r.correctiveAction || 'see the audit'}.`, user.id);
    }
    res.json(view(updated, record, permissions(updated, record, user), names));
  });

  // Lead auditor submits the completed audit to management for sign-off
  app.post('/api/internal-audits/:id/submit', requireAuth, async (req, res) => {
    const user = userOf(req);
    const loaded = await load(req, res);
    if (!loaded) return;
    const { audit, record, perms } = loaded;
    if (!perms.canSubmit) return res.status(403).json({ message: 'Only the lead auditor, the QM or admins can submit this audit' });
    const issues = validateAudit(record);
    if (issues.length) return res.status(400).json({ message: 'The audit is not complete yet', issues });
    const updated = await saveRecord(audit, record, {
      status: InternalAuditStatus.PENDING_SIGNOFF, submittedAt: new Date(), submittedById: user.id, returnNote: null,
    });
    await storage.createAuditLog({
      userId: user.id, action: AuditAction.SUBMIT_FOR_REVIEW, entityType: 'internal_audit', entityId: audit.id,
      previousValue: JSON.stringify({ status: audit.status }), newValue: JSON.stringify({ status: InternalAuditStatus.PENDING_SIGNOFF, summary: summarize(record) }),
    });
    await notify(await management(), 'Internal Audit Awaiting Sign-off',
      `Internal audit ${audit.reference} is complete and waiting for management sign-off.`, user.id);
    res.json(view(updated, record, permissions(updated, record, user), await userNames()));
  });

  // Management sends it back to the audit team with a reason
  app.post('/api/internal-audits/:id/return', requireAuth, async (req, res) => {
    const user = userOf(req);
    const loaded = await load(req, res);
    if (!loaded) return;
    const { audit, record, perms } = loaded;
    if (!perms.canSignOff) return res.status(403).json({ message: 'Only the COO or CEO can return an audit awaiting sign-off' });
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note) return res.status(400).json({ message: 'Say what needs to change' });
    const updated = await saveRecord(audit, record, { status: InternalAuditStatus.IN_PROGRESS, returnNote: note });
    await storage.createAuditLog({
      userId: user.id, action: AuditAction.RETURN_FOR_REVISION, entityType: 'internal_audit', entityId: audit.id,
      previousValue: JSON.stringify({ status: audit.status }), newValue: JSON.stringify({ status: InternalAuditStatus.IN_PROGRESS, note }),
    });
    await notify([audit.leadAuditorId, ...(audit.auditTeamIds ?? [])], 'Internal Audit Returned',
      `Internal audit ${audit.reference} was returned by ${user.name}: ${note}`, user.id);
    res.json(view(updated, record, permissions(updated, record, user), await userNames()));
  });

  // Management sign-off closes the audit (corrective actions are still followed up afterwards)
  app.post('/api/internal-audits/:id/sign-off', requireAuth, async (req, res) => {
    const user = userOf(req);
    const loaded = await load(req, res);
    if (!loaded) return;
    const { audit, record, perms } = loaded;
    if (!perms.canSignOff) return res.status(403).json({ message: 'Only the COO or CEO can sign off an audit awaiting sign-off' });
    const issues = validateAudit(record);
    if (issues.length) return res.status(400).json({ message: 'The audit is not complete yet', issues });
    const now = new Date();
    record.signOff = {
      name: user.name,
      role: user.email === CEO_EMAIL ? 'Chief Executive Officer' : 'Chief Operating Officer',
      date: now.toISOString().slice(0, 10),
    };
    const updated = await saveRecord(audit, record, { status: InternalAuditStatus.CLOSED, signedOffById: user.id, signedOffAt: now });
    const summary = summarize(record);
    await storage.createAuditLog({
      userId: user.id, action: AuditAction.APPROVE, entityType: 'internal_audit', entityId: audit.id,
      previousValue: JSON.stringify({ status: audit.status }),
      newValue: JSON.stringify({ status: InternalAuditStatus.CLOSED, signOff: record.signOff, overall: summary.overall, counts: summary.counts, openActions: summary.openActions }),
    });
    const owners = ALL_CHECKS.map(c => record.responses[c.id]).filter(r => requiresAction(r.rating) && !r.effectivenessVerified).map(r => r.ownerId);
    await notify([audit.leadAuditorId, ...(audit.auditTeamIds ?? []), ...owners], 'Internal Audit Signed Off',
      `Internal audit ${audit.reference} was signed off by ${user.name}.${summary.openActions ? ` ${summary.openActions} corrective action(s) remain open.` : ''}`, user.id);
    res.json(view(updated, record, permissions(updated, record, user), await userNames()));
  });

  // The owner records the corrective action taken
  app.post('/api/internal-audits/:id/actions/:checkId/complete', requireAuth, async (req, res) => {
    const user = userOf(req);
    const loaded = await load(req, res);
    if (!loaded) return;
    const { audit, record } = loaded;
    const response = record.responses[req.params.checkId];
    if (!response || !requiresAction(response.rating)) return res.status(404).json({ message: 'No corrective action for this check' });
    if (audit.status === InternalAuditStatus.DRAFT) return res.status(400).json({ message: 'The audit has not started yet' });
    if (response.ownerId !== user.id && !isAuditAdmin(user)) return res.status(403).json({ message: 'Only the action owner can record what was done' });
    if (response.effectivenessVerified) return res.status(400).json({ message: 'This action has already been verified' });
    const actionTaken = typeof req.body?.actionTaken === 'string' ? req.body.actionTaken.trim() : '';
    if (!actionTaken) return res.status(400).json({ message: 'Describe the action taken' });
    record.responses[req.params.checkId] = { ...response, actionTaken, actionCompleted: true };
    const updated = await saveRecord(audit, record);
    await storage.createAuditLog({
      userId: user.id, action: AuditAction.COMPLETE_TASK, entityType: 'internal_audit', entityId: audit.id,
      previousValue: JSON.stringify({ checkId: req.params.checkId, actionCompleted: response.actionCompleted }),
      newValue: JSON.stringify({ checkId: req.params.checkId, actionCompleted: true, actionTaken }),
    });
    await notify([audit.leadAuditorId], 'Corrective Action Ready to Verify',
      `${user.name} completed the corrective action for ${req.params.checkId} in internal audit ${audit.reference}. Verify its effectiveness.`, user.id);
    res.json(view(updated, record, permissions(updated, record, user), await userNames()));
  });

  // The lead auditor (or QM) verifies effectiveness, or sends it back to the owner
  app.post('/api/internal-audits/:id/actions/:checkId/verify', requireAuth, async (req, res) => {
    const user = userOf(req);
    const loaded = await load(req, res);
    if (!loaded) return;
    const { audit, record, perms } = loaded;
    if (!perms.canVerify) return res.status(403).json({ message: 'Only the lead auditor, the QM or admins can verify corrective actions' });
    const response = record.responses[req.params.checkId];
    if (!response || !requiresAction(response.rating)) return res.status(404).json({ message: 'No corrective action for this check' });
    const parsed = z.object({ effective: z.boolean(), note: z.string().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Say whether the action was effective' });
    if (!response.actionCompleted) return res.status(400).json({ message: 'The owner has not recorded the action yet' });
    const { effective, note } = parsed.data;
    if (!effective && !note?.trim()) return res.status(400).json({ message: 'Say why the action is not effective' });
    record.responses[req.params.checkId] = effective
      ? { ...response, effectivenessVerified: true }
      : { ...response, actionCompleted: false, details: `${response.details}${response.details ? '\n' : ''}[Not effective, ${new Date().toISOString().slice(0, 10)}] ${note!.trim()}` };
    const updated = await saveRecord(audit, record);
    await storage.createAuditLog({
      userId: user.id, action: effective ? AuditAction.APPROVE : AuditAction.REJECT, entityType: 'internal_audit', entityId: audit.id,
      previousValue: JSON.stringify({ checkId: req.params.checkId, effectivenessVerified: false }),
      newValue: JSON.stringify({ checkId: req.params.checkId, effectivenessVerified: effective, note }),
    });
    await notify([response.ownerId], effective ? 'Corrective Action Verified' : 'Corrective Action Not Effective',
      effective
        ? `Your corrective action for ${req.params.checkId} in internal audit ${audit.reference} was verified as effective.`
        : `Your corrective action for ${req.params.checkId} in internal audit ${audit.reference} was not effective: ${note}`, user.id);
    res.json(view(updated, record, permissions(updated, record, user), await userNames()));
  });

  app.delete('/api/internal-audits/:id', requireAuth, async (req, res) => {
    const user = userOf(req);
    const loaded = await load(req, res);
    if (!loaded) return;
    if (!loaded.perms.canDelete) return res.status(403).json({ message: 'Only a draft audit can be deleted, by its creator, the QM or admins' });
    await db.delete(internalAudits).where(eq(internalAudits.id, loaded.audit.id));
    await storage.createAuditLog({
      userId: user.id, action: AuditAction.DELETE, entityType: 'internal_audit', entityId: loaded.audit.id,
      previousValue: JSON.stringify({ reference: loaded.audit.reference }),
    });
    res.status(204).end();
  });
}
