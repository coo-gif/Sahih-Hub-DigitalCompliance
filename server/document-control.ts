import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  documents, documentVersions, documentComments, changeRequests, users,
  DocumentStatus, DocumentHubStatus, DocumentLifecycleStatus, DocumentVersionStatus, ChangeRequestStatus,
  CHANGE_REASON_LABELS, AuditAction, UrgencyLevel, UserRole,
  type Document, type DocumentVersion, type ChangeRequest,
} from "@shared/schema";
import { parseTargetDate, setTaskTarget, TargetDateError } from "./task-ledger";

const COO_EMAIL = 'coo@sahihcertify.com';

type AuthedUser = { id: number; name: string; email: string; role: string };

export interface DocumentControlHelpers {
  requireAuth: (req: Request, res: Response, next: NextFunction) => unknown;
  canViewDocument: (doc: Document, user: { id: number; email: string }) => Promise<boolean>;
}

const isManager = (u: AuthedUser) => u.email === COO_EMAIL || u.role === UserRole.ADMIN || u.role === UserRole.QUALITY_MANAGER;
const versionLabel = (ed: number, rev: number) => `Ed.${ed} Rev.${rev}`;
const reasonLabel = (category: string | null, other: string | null) =>
  category === 'other' ? (other || 'Other') : (CHANGE_REASON_LABELS[category || ''] || 'Not given');

// ============================================
// Version records: every approved version is kept; one is current
// ============================================
export async function getCurrentVersion(documentId: number): Promise<DocumentVersion | undefined> {
  const [current] = await db.select().from(documentVersions)
    .where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.status, DocumentVersionStatus.CURRENT)))
    .orderBy(desc(documentVersions.id)).limit(1);
  return current;
}

// Snapshot the document as it stands now as its current approved version (if not already recorded)
async function ensureCurrentVersionRecorded(doc: Document): Promise<DocumentVersion> {
  const existing = await getCurrentVersion(doc.id);
  if (existing) return existing;
  const [created] = await db.insert(documentVersions).values({
    documentId: doc.id,
    versionNumber: versionLabel(doc.editionNumber, doc.revisionNumber),
    editionNumber: doc.editionNumber,
    revisionNumber: doc.revisionNumber,
    title: doc.title,
    content: doc.content,
    fileUrl: doc.fileUrl,
    pdfUrl: doc.finalPdfUrl,
    classification: doc.classification,
    approvedById: doc.hubApprovedById ?? doc.approverId,
    approvedAt: doc.hubApprovedAt ?? doc.approvedAt ?? new Date(),
    status: DocumentVersionStatus.CURRENT,
  }).returning();
  return created;
}

/**
 * Called when the COO gives final approval in the Hub. Works out the new edition/revision numbers,
 * stamps the previous version obsolete (it is kept), records the new current version and closes the
 * change request that caused the revision. Returns the fields to set on the document.
 */
export async function recordApprovedVersion(doc: Document, cooId: number, versionChange: 'revision' | 'edition' | undefined, classification: string) {
  const previous = await getCurrentVersion(doc.id);
  let editionNumber = doc.editionNumber;
  let revisionNumber = doc.revisionNumber;
  if (previous) {
    if (versionChange === 'edition') {
      editionNumber = previous.editionNumber + 1;
      revisionNumber = 0;
    } else {
      editionNumber = previous.editionNumber;
      revisionNumber = previous.revisionNumber + 1;
    }
  }
  const now = new Date();
  const [created] = await db.insert(documentVersions).values({
    documentId: doc.id,
    versionNumber: versionLabel(editionNumber, revisionNumber),
    editionNumber,
    revisionNumber,
    title: doc.title,
    content: doc.content,
    fileUrl: doc.fileUrl,
    pdfUrl: doc.finalPdfUrl,
    classification,
    approvedById: cooId,
    approvedAt: now,
    status: DocumentVersionStatus.CURRENT,
    changeRequestId: doc.activeChangeRequestId,
  }).returning();
  if (previous) {
    await db.update(documentVersions).set({
      status: DocumentVersionStatus.OBSOLETE,
      obsoletedAt: now,
      supersededByVersionId: created.id,
    }).where(eq(documentVersions.id, previous.id));
  }

  if (doc.activeChangeRequestId) {
    const [cr] = await db.update(changeRequests).set({
      status: ChangeRequestStatus.IMPLEMENTED,
      implementedAt: now,
      newEditionNumber: editionNumber,
      newRevisionNumber: revisionNumber,
      updatedAt: now,
    }).where(eq(changeRequests.id, doc.activeChangeRequestId)).returning();
    if (cr) {
      await closeChangeRequestPoints(cr.id, cooId);
      const points = await db.select().from(documentComments).where(eq(documentComments.changeRequestId, cr.id));
      const reasons = Array.from(new Set(points.map(p => reasonLabel(p.reasonCategory, p.reasonOther))));
      // Keep the document's own revision history in step
      await storage.createRevisionHistory({
        documentId: doc.id,
        revisionNumber,
        description: `${cr.crNumber}: ${cr.summary || points.map(p => p.content).join('; ')}`.slice(0, 2000),
        reason: reasons.join(', '),
        preparedById: doc.preparedById,
        reviewedById: doc.reviewerId,
        approvedById: cooId,
        requestedById: cr.initiatorId,
        status: 'approved',
        amendmentDate: now,
      });
      await storage.createNotification({
        userId: cr.initiatorId,
        title: 'Your Change Request Is Implemented',
        message: `${cr.crNumber}: "${doc.documentCode} - ${doc.title}" is now ${versionLabel(editionNumber, revisionNumber)}. ${previous ? `${previous.versionNumber} is obsolete.` : ''}`,
        urgencyLevel: UrgencyLevel.LOW,
        relatedDocumentId: doc.id,
      });
    }
  }

  return {
    editionNumber,
    revisionNumber,
    versionNumber: versionLabel(editionNumber, revisionNumber),
    activeChangeRequestId: null,
    lifecycleStatus: DocumentLifecycleStatus.CURRENT,
    previousVersion: previous?.versionNumber ?? null,
  };
}

// ============================================
// What a reader sees while a document is under revision: the approved version still in force
// ============================================
export async function presentForReader<T extends Document>(doc: T, user: { id: number; email: string }): Promise<T> {
  if (!doc.activeChangeRequestId || user.email === COO_EMAIL) return doc;
  if ([doc.createdById, doc.preparedById, doc.reviewerId, doc.approverId].includes(user.id)) return doc;
  const current = await getCurrentVersion(doc.id);
  if (!current) return doc;
  return {
    ...doc,
    title: current.title ?? doc.title,
    content: current.content,
    fileUrl: current.fileUrl,
    finalPdfUrl: current.pdfUrl,
    editionNumber: current.editionNumber,
    revisionNumber: current.revisionNumber,
    classification: current.classification ?? doc.classification,
    status: DocumentStatus.APPROVED,
    isLocked: true,
    hubStatus: DocumentHubStatus.STORED,
    lifecycleStatus: DocumentLifecycleStatus.UNDER_REVISION,
    approvedAt: current.approvedAt,
  };
}

// A decided change request's points stay on record but are no longer open highlights
async function closeChangeRequestPoints(changeRequestId: number, userId: number) {
  await db.update(documentComments)
    .set({ status: 'resolved', resolvedById: userId, resolvedAt: new Date() })
    .where(and(eq(documentComments.changeRequestId, changeRequestId), eq(documentComments.status, 'open')));
}

async function nextCrNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ crNumber: changeRequests.crNumber }).from(changeRequests);
  const thisYear = rows.map(r => r.crNumber).filter(n => n.startsWith(`CR-${year}-`)).map(n => Number(n.split('-')[2]) || 0);
  return `CR-${year}-${String((thisYear.length ? Math.max(...thisYear) : 0) + 1).padStart(3, '0')}`;
}

async function changeRequestDetail(cr: ChangeRequest) {
  const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
  const nameOf = (id: number | null) => (id ? allUsers.find(u => u.id === id)?.name ?? 'Unknown' : null);
  const points = await db.select().from(documentComments).where(eq(documentComments.changeRequestId, cr.id)).orderBy(documentComments.id);
  return {
    ...cr,
    initiatorName: nameOf(cr.initiatorId),
    decidedByName: nameOf(cr.decidedById),
    revisionPreparerName: nameOf(cr.revisionPreparerId),
    reasons: Array.from(new Set(points.map(p => reasonLabel(p.reasonCategory, p.reasonOther)))),
    points: points.map(p => ({
      id: p.id,
      quotedText: p.quotedText,
      content: p.content,
      reason: reasonLabel(p.reasonCategory, p.reasonOther),
      createdAt: p.createdAt,
    })),
  };
}

// The document a change request may be raised against: approved, stored, in force, not already being revised
async function changeableDocument(documentId: number, user: AuthedUser, helpers: DocumentControlHelpers): Promise<{ error: readonly [number, string]; doc?: undefined } | { doc: Document; error?: undefined }> {
  const doc = await storage.getDocument(documentId);
  if (!doc) return { error: [404, 'Document not found'] as const };
  if (!doc.isLocked || doc.hubStatus !== DocumentHubStatus.STORED) {
    return { error: [400, 'Change requests can only be raised on approved documents stored in the Document Hub'] as const };
  }
  if (doc.activeChangeRequestId) return { error: [400, 'This document is already under revision'] as const };
  if (doc.lifecycleStatus === DocumentLifecycleStatus.OBSOLETE || doc.lifecycleStatus === DocumentLifecycleStatus.QUARANTINE) {
    return { error: [400, 'This document is withdrawn from use'] as const };
  }
  if (!(await helpers.canViewDocument(doc, user))) return { error: [403, 'You do not have access to this document. Request access first.'] as const };
  return { doc };
}

export function registerDocumentControlRoutes(app: Express, helpers: DocumentControlHelpers) {
  const { requireAuth } = helpers;
  const userOf = (req: Request) => (req as any).user as AuthedUser;

  // ---- Change request: my draft for a document ----
  app.get('/api/documents/:id/change-requests/mine', requireAuth, async (req, res) => {
    const user = userOf(req);
    const [draft] = await db.select().from(changeRequests).where(and(
      eq(changeRequests.documentId, Number(req.params.id)),
      eq(changeRequests.initiatorId, user.id),
      eq(changeRequests.status, ChangeRequestStatus.DRAFT),
    ));
    res.json(draft ? await changeRequestDetail(draft) : null);
  });

  // ---- Add a highlighted point to my draft change request (creates the draft if needed) ----
  app.post('/api/documents/:id/change-requests/items', requireAuth, async (req, res) => {
    try {
      const user = userOf(req);
      const parsed = z.object({
        content: z.string().trim().min(1, 'Explain what should change'),
        quotedText: z.string().min(1, 'Highlight the text the change is about'),
        anchorFrom: z.number().int().nonnegative(),
        anchorTo: z.number().int().positive(),
        reasonCategory: z.enum(Object.keys(CHANGE_REASON_LABELS) as [string, ...string[]]),
        reasonOther: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const input = parsed.data;
      if (input.reasonCategory === 'other' && !input.reasonOther?.trim()) {
        return res.status(400).json({ message: 'Please specify the reason' });
      }
      const result = await changeableDocument(Number(req.params.id), user, helpers);
      if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });
      const doc = result.doc!;

      let [draft] = await db.select().from(changeRequests).where(and(
        eq(changeRequests.documentId, doc.id),
        eq(changeRequests.initiatorId, user.id),
        eq(changeRequests.status, ChangeRequestStatus.DRAFT),
      ));
      if (!draft) {
        [draft] = await db.insert(changeRequests).values({
          crNumber: await nextCrNumber(),
          documentId: doc.id,
          documentCode: doc.documentCode,
          documentTitle: doc.title,
          editionNumber: doc.editionNumber,
          revisionNumber: doc.revisionNumber,
          initiatorId: user.id,
          status: ChangeRequestStatus.DRAFT,
        }).returning();
      }
      const point = await storage.createDocumentComment({
        documentId: doc.id,
        authorId: user.id,
        content: input.content,
        quotedText: input.quotedText,
        anchorFrom: input.anchorFrom,
        anchorTo: input.anchorTo,
        kind: 'change_request',
        changeRequestId: draft.id,
        reasonCategory: input.reasonCategory,
        reasonOther: input.reasonOther?.trim() || null,
        documentStatus: doc.status,
      });
      res.status(201).json({ changeRequest: draft, point });
    } catch (err) {
      console.error('Error adding change request point:', err);
      res.status(500).json({ message: 'Failed to add to change request' });
    }
  });

  // ---- Submit a draft change request to the COO ----
  app.post('/api/change-requests/:id/submit', requireAuth, async (req, res) => {
    try {
      const user = userOf(req);
      const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, Number(req.params.id)));
      if (!cr) return res.status(404).json({ message: 'Change request not found' });
      if (cr.initiatorId !== user.id) return res.status(403).json({ message: 'Only the person who raised it can submit it' });
      if (cr.status !== ChangeRequestStatus.DRAFT) return res.status(400).json({ message: 'This change request was already submitted' });
      const points = await db.select().from(documentComments).where(eq(documentComments.changeRequestId, cr.id));
      if (points.length === 0) return res.status(400).json({ message: 'Highlight at least one part of the document and explain the change' });
      const result = await changeableDocument(cr.documentId, user, helpers);
      if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });

      const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
      const [updated] = await db.update(changeRequests).set({
        status: ChangeRequestStatus.SUBMITTED,
        summary: summary || null,
        submittedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(changeRequests.id, cr.id)).returning();

      const coo = await storage.getUserByEmail(COO_EMAIL);
      if (coo) {
        await setTaskTarget(`change_request:${cr.id}`, { assigneeId: coo.id, initiatorId: user.id, targetDate: parseTargetDate(undefined, 'change_request') });
        await storage.createNotification({
          userId: coo.id,
          title: 'Change Request Submitted',
          message: `${user.name} raised ${cr.crNumber} on "${cr.documentCode} - ${cr.documentTitle}" (${points.length} point${points.length > 1 ? 's' : ''}). Accept or reject it in the Document Hub.`,
          urgencyLevel: UrgencyLevel.HIGH,
          relatedDocumentId: cr.documentId,
        });
      }
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.SUBMIT_FOR_REVIEW,
        entityType: 'change_request',
        entityId: cr.id,
        newValue: JSON.stringify({ crNumber: cr.crNumber, documentId: cr.documentId, points: points.length, summary }),
      });
      res.json(updated);
    } catch (err) {
      console.error('Error submitting change request:', err);
      res.status(500).json({ message: 'Failed to submit change request' });
    }
  });

  // ---- Discard a draft ----
  app.delete('/api/change-requests/:id', requireAuth, async (req, res) => {
    const user = userOf(req);
    const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, Number(req.params.id)));
    if (!cr) return res.status(404).json({ message: 'Change request not found' });
    if (cr.initiatorId !== user.id || cr.status !== ChangeRequestStatus.DRAFT) {
      return res.status(403).json({ message: 'Only your own unsubmitted drafts can be discarded' });
    }
    await db.delete(documentComments).where(eq(documentComments.changeRequestId, cr.id));
    await db.delete(changeRequests).where(eq(changeRequests.id, cr.id));
    res.status(204).send();
  });

  // ---- List: managers see all, others their own ----
  app.get('/api/change-requests', requireAuth, async (req, res) => {
    const user = userOf(req);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    let rows = await db.select().from(changeRequests).orderBy(desc(changeRequests.id));
    rows = rows.filter(r => r.status !== ChangeRequestStatus.DRAFT || r.initiatorId === user.id);
    if (!isManager(user)) rows = rows.filter(r => r.initiatorId === user.id);
    if (status) rows = rows.filter(r => r.status === status);
    res.json(await Promise.all(rows.map(changeRequestDetail)));
  });

  app.get('/api/change-requests/:id', requireAuth, async (req, res) => {
    const user = userOf(req);
    const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, Number(req.params.id)));
    if (!cr) return res.status(404).json({ message: 'Change request not found' });
    if (!isManager(user) && cr.initiatorId !== user.id) return res.status(403).json({ message: 'Access denied' });
    res.json(await changeRequestDetail(cr));
  });

  // ---- COO decision ----
  app.post('/api/change-requests/:id/decide', requireAuth, async (req, res) => {
    try {
      const user = userOf(req);
      if (user.email !== COO_EMAIL) return res.status(403).json({ message: 'Only the COO can accept or reject change requests' });
      const parsed = z.object({
        decision: z.enum(['accept', 'reject']),
        note: z.string().optional(),
        preparerId: z.number().int().positive().optional(),
        targetDate: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid decision' });
      const { decision, note, preparerId } = parsed.data;

      const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, Number(req.params.id)));
      if (!cr) return res.status(404).json({ message: 'Change request not found' });
      if (cr.status !== ChangeRequestStatus.SUBMITTED) return res.status(400).json({ message: 'This change request has already been decided' });
      const doc = await storage.getDocument(cr.documentId);
      if (!doc) return res.status(404).json({ message: 'Document not found' });
      const now = new Date();

      if (decision === 'reject') {
        const [updated] = await db.update(changeRequests).set({
          status: ChangeRequestStatus.REJECTED, decidedById: user.id, decidedAt: now, decisionNote: note || null, updatedAt: now,
        }).where(eq(changeRequests.id, cr.id)).returning();
        await closeChangeRequestPoints(cr.id, user.id);
        await storage.createNotification({
          userId: cr.initiatorId,
          title: 'Change Request Rejected',
          message: `${cr.crNumber} on "${cr.documentCode}" was not accepted. The approved version remains valid.${note ? ` Note: ${note}` : ''}`,
          urgencyLevel: UrgencyLevel.MEDIUM,
          relatedDocumentId: cr.documentId,
        });
        await storage.createAuditLog({
          userId: user.id, action: AuditAction.REJECT, entityType: 'change_request', entityId: cr.id,
          newValue: JSON.stringify({ crNumber: cr.crNumber, note }),
        });
        return res.json(updated);
      }

      // Accept: the approved version is recorded and stays in force for readers; the document goes back for revision
      if (doc.activeChangeRequestId) return res.status(400).json({ message: 'This document is already under revision for another change request' });
      const revisionPreparerId = preparerId ?? doc.preparedById ?? doc.createdById;
      if (!(await storage.getUser(revisionPreparerId))) return res.status(400).json({ message: 'Preparer not found' });
      const targetDate = parseTargetDate(parsed.data.targetDate, 'prepare');

      await ensureCurrentVersionRecorded(doc);
      await storage.updateDocument(doc.id, {
        activeChangeRequestId: cr.id,
        lifecycleStatus: DocumentLifecycleStatus.UNDER_REVISION,
        isLocked: false,
        status: DocumentStatus.DRAFT,
        hubStatus: null,
        preparedById: revisionPreparerId,
        preparerConfirmedAt: null,
        preparedBySignedAt: null,
        reviewedBySignedAt: null,
        approvedBySignedAt: null,
        transferredToHubAt: null,
        returnedAt: null,
        returnedById: null,
        returnNote: null,
      } as any);
      await setTaskTarget(`prepare:${doc.id}`, { assigneeId: revisionPreparerId, initiatorId: user.id, targetDate, note: `${cr.crNumber}` });
      const [updated] = await db.update(changeRequests).set({
        status: ChangeRequestStatus.ACCEPTED, decidedById: user.id, decidedAt: now, decisionNote: note || null,
        revisionPreparerId, updatedAt: now,
      }).where(eq(changeRequests.id, cr.id)).returning();

      await storage.createWorkflowLog({
        documentId: doc.id,
        fromStatus: doc.status,
        toStatus: DocumentStatus.DRAFT,
        assignedToId: revisionPreparerId,
        actionById: user.id,
        comments: `${cr.crNumber} accepted: document under revision (current version stays in force)${note ? `. ${note}` : ''}`,
      });
      for (const [userId, title, message] of [
        [cr.initiatorId, 'Change Request Accepted', `${cr.crNumber} on "${cr.documentCode}" was accepted. The document is now under revision.`],
        [revisionPreparerId, 'Document Revision Assigned', `Revise "${cr.documentCode} - ${cr.documentTitle}" for ${cr.crNumber} by ${targetDate.toLocaleDateString('en-GB')}. The change request points are highlighted in the document.`],
      ] as Array<[number, string, string]>) {
        if (userId === user.id) continue;
        await storage.createNotification({ userId, title, message, urgencyLevel: UrgencyLevel.HIGH, relatedDocumentId: doc.id });
      }
      await storage.createAuditLog({
        userId: user.id, action: AuditAction.APPROVE, entityType: 'change_request', entityId: cr.id,
        newValue: JSON.stringify({ crNumber: cr.crNumber, revisionPreparerId, targetDate, note }),
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'targetDate' });
      console.error('Error deciding change request:', err);
      res.status(500).json({ message: 'Failed to record the decision' });
    }
  });

  // ---- All versions of a document (current and obsolete) ----
  app.get('/api/documents/:id/versions', requireAuth, async (req, res) => {
    const user = userOf(req);
    const doc = await storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const versions = await storage.getDocumentVersions(doc.id);
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    // Content of past versions is for the COO, admins and the QM (records control)
    const full = isManager(user);
    res.json(versions.map(v => ({
      ...v,
      content: full ? v.content : null,
      approvedByName: allUsers.find(u => u.id === v.approvedById)?.name ?? null,
    })));
  });

  // ============================================
  // RECORDS & DATA HIVE
  // ============================================
  const recordsGuard = (req: Request, res: Response) => {
    const user = userOf(req);
    if (!isManager(user)) {
      res.status(403).json({ message: 'Records are available to the COO, admins and the Quality Manager' });
      return false;
    }
    return true;
  };

  app.get('/api/records/change-requests', requireAuth, async (req, res) => {
    if (!recordsGuard(req, res)) return;
    const rows = await db.select().from(changeRequests).orderBy(desc(changeRequests.id));
    res.json(await Promise.all(rows.filter(r => r.status !== ChangeRequestStatus.DRAFT).map(changeRequestDetail)));
  });

  app.get('/api/records/obsolete', requireAuth, async (req, res) => {
    if (!recordsGuard(req, res)) return;
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const nameOf = (id: number | null) => (id ? allUsers.find(u => u.id === id)?.name ?? null : null);
    const obsoleteVersions = await db.select().from(documentVersions)
      .where(eq(documentVersions.status, DocumentVersionStatus.OBSOLETE)).orderBy(desc(documentVersions.obsoletedAt));
    const docIds = Array.from(new Set(obsoleteVersions.map(v => v.documentId)));
    const docs = docIds.length ? await db.select().from(documents).where(inArray(documents.id, docIds)) : [];
    const versionById = new Map((await db.select().from(documentVersions)).map(v => [v.id, v]));
    const crs = await db.select().from(changeRequests);
    const rows = obsoleteVersions.map(v => {
      const doc = docs.find(d => d.id === v.documentId);
      const successor = v.supersededByVersionId ? versionById.get(v.supersededByVersionId) : undefined;
      return {
        kind: 'superseded_version',
        documentId: v.documentId,
        versionId: v.id,
        documentCode: doc?.documentCode ?? '',
        title: v.title ?? doc?.title ?? '',
        version: v.versionNumber,
        approvedAt: v.approvedAt,
        approvedByName: nameOf(v.approvedById),
        obsoletedAt: v.obsoletedAt,
        supersededBy: successor?.versionNumber ?? null,
        changeRequest: successor?.changeRequestId ? crs.find(c => c.id === successor.changeRequestId)?.crNumber ?? null : null,
      };
    });
    // Whole documents the COO withdrew (status Obsolete in the Hub)
    const withdrawn = await db.select().from(documents).where(eq(documents.lifecycleStatus, DocumentLifecycleStatus.OBSOLETE));
    for (const doc of withdrawn) {
      rows.push({
        kind: 'withdrawn_document',
        documentId: doc.id,
        versionId: 0,
        documentCode: doc.documentCode,
        title: doc.title,
        version: versionLabel(doc.editionNumber, doc.revisionNumber),
        approvedAt: doc.hubApprovedAt ?? doc.approvedAt,
        approvedByName: nameOf(doc.hubApprovedById),
        obsoletedAt: doc.updatedAt,
        supersededBy: null,
        changeRequest: null,
      });
    }
    res.json(rows);
  });

  // Document Master List: every document with an approved version, as of now
  app.get('/api/records/master-list', requireAuth, async (req, res) => {
    if (!recordsGuard(req, res)) return;
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const nameOf = (id: number | null) => (id ? allUsers.find(u => u.id === id)?.name ?? null : null);
    const docs = await db.select().from(documents);
    const currentVersions = await db.select().from(documentVersions).where(eq(documentVersions.status, DocumentVersionStatus.CURRENT));
    const allVersions = await db.select({ documentId: documentVersions.documentId }).from(documentVersions);
    const rows = docs
      .filter(d => d.isLocked || d.activeChangeRequestId || currentVersions.some(v => v.documentId === d.id))
      .map(d => {
        const current = currentVersions.find(v => v.documentId === d.id);
        return {
          documentId: d.id,
          documentCode: d.documentCode,
          title: current?.title ?? d.title,
          category: d.category,
          version: current?.versionNumber ?? versionLabel(d.editionNumber, d.revisionNumber),
          approvedAt: current?.approvedAt ?? d.hubApprovedAt ?? d.approvedAt,
          approvedByName: nameOf(current?.approvedById ?? d.hubApprovedById),
          classification: current?.classification ?? d.classification,
          status: d.activeChangeRequestId ? 'under_revision' : (d.lifecycleStatus ?? 'current'),
          nextReviewDate: d.nextReviewDate,
          versionsKept: allVersions.filter(v => v.documentId === d.id).length,
        };
      })
      .sort((a, b) => a.documentCode.localeCompare(b.documentCode));
    const lastApproval = rows.reduce<Date | null>((latest, r) => (r.approvedAt && (!latest || r.approvedAt > latest) ? r.approvedAt : latest), null);
    res.json({ updatedAt: lastApproval, documents: rows });
  });
}
