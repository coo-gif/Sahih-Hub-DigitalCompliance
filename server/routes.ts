import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, verifyPassword } from "./storage";
import { api } from "@shared/routes";
import { 
  DocumentStatus, 
  AuditAction,
  UrgencyLevel,
  UserRole,
  InductionStatus,
  DownloadRequestStatus,
  DocumentTaskType,
  DocumentTaskStatus,
  DocumentImportance,
} from "@shared/schema";
import { z } from "zod";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

function getCurrentUserId(req: any): number {
  if (!req.session?.userId) {
    throw new Error('Not authenticated');
  }
  return req.session.userId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============================================
  // AUTHENTICATION ROUTES
  // ============================================
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is deactivated. Contact administrator.' });
      }

      req.session.userId = user.id;
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({ user });
  });

  // ============================================
  // DASHBOARD ROUTES
  // ============================================
  app.get(api.dashboard.stats.path, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get(api.dashboard.alerts.path, async (req, res) => {
    const alerts = await storage.getComplianceAlerts();
    res.json(alerts);
  });

  app.get(api.dashboard.recentActivity.path, async (req, res) => {
    const activity = await storage.getAuditLogs(10);
    res.json(activity);
  });

  // ============================================
  // USER ROUTES
  // ============================================
  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.get(api.users.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  });

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      
      // Check if email already exists
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: 'Email already exists', field: 'email' });
      }

      const user = await storage.createUser({
        name: input.name,
        email: input.email,
        passwordHash: input.password,
        role: input.role,
        inductionStatus: InductionStatus.PENDING,
        isActive: true,
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.CREATE,
        entityType: 'user',
        entityId: user.id,
        newValue: JSON.stringify({ name: input.name, email: input.email, role: input.role }),
      });

      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.users.update.path, async (req, res) => {
    try {
      const input = api.users.update.input.parse(req.body);
      const id = Number(req.params.id);
      
      const existing = await storage.getUser(id);
      if (!existing) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = await storage.updateUser(id, input);

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.UPDATE,
        entityType: 'user',
        entityId: id,
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(input),
      });

      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.users.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getUser(id);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    await storage.deleteUser(id);

    // Audit log
    await storage.createAuditLog({
      userId: getCurrentUserId(req),
      action: AuditAction.DELETE,
      entityType: 'user',
      entityId: id,
      previousValue: JSON.stringify(existing),
    });

    res.status(204).send();
  });

  app.put(api.users.updateSignature.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      const existing = await storage.getUser(id);
      if (!existing) {
        return res.status(404).json({ message: 'User not found' });
      }

      const input = api.users.updateSignature.input.parse(req.body);
      
      // Security: Validate signature data URL to prevent XSS via SVG
      if (input.signatureDataUrl) {
        const allowedMimeTypes = ['data:image/png', 'data:image/jpeg', 'data:image/jpg'];
        const isValidMimeType = allowedMimeTypes.some(mime => 
          input.signatureDataUrl!.toLowerCase().startsWith(mime)
        );
        
        if (!isValidMimeType) {
          return res.status(400).json({ 
            message: 'Only PNG and JPEG images are allowed for signatures. SVG and other formats are not permitted.',
            field: 'signatureDataUrl'
          });
        }
        
        // Additional validation: ensure it's a valid data URL format
        if (!input.signatureDataUrl.includes(';base64,')) {
          return res.status(400).json({ 
            message: 'Invalid image format. Please upload a valid PNG or JPEG image.',
            field: 'signatureDataUrl'
          });
        }
      }
      
      const user = await storage.updateUser(id, { signatureDataUrl: input.signatureDataUrl });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.UPDATE,
        entityType: 'user',
        entityId: id,
        previousValue: JSON.stringify({ signatureDataUrl: existing.signatureDataUrl }),
        newValue: JSON.stringify({ signatureDataUrl: input.signatureDataUrl ? '[SIGNATURE_DATA]' : null }),
      });

      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // ============================================
  // DOCUMENT ROUTES
  // ============================================
  app.get(api.documents.list.path, async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
    };
    const docs = await storage.getDocuments(filters);
    res.json(docs);
  });

  app.get(api.documents.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }
    const doc = await storage.getDocument(id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(doc);
  });

  app.post(api.documents.create.path, async (req, res) => {
    try {
      const input = api.documents.create.input.parse(req.body);
      
      const doc = await storage.createDocument({
        documentCode: input.documentCode,
        title: input.title,
        description: input.description || null,
        category: input.category,
        content: input.content || null,
        fileUrl: input.fileUrl || null,
        versionNumber: "1.0",
        status: DocumentStatus.DRAFT,
        createdById: getCurrentUserId(req),
        nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
        requiresPreparedBy: input.requiresPreparedBy ?? true,
        requiresReviewedBy: input.requiresReviewedBy ?? true,
        requiresApprovedBy: input.requiresApprovedBy ?? true,
        preparedById: input.preparedById || null,
        reviewerId: input.reviewedById || null,
        approverId: input.approvedById || null,
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.CREATE,
        entityType: 'document',
        entityId: doc.id,
        newValue: JSON.stringify(input),
      });

      // Workflow log
      await storage.createWorkflowLog({
        documentId: doc.id,
        fromStatus: null,
        toStatus: DocumentStatus.DRAFT,
        actionById: getCurrentUserId(req),
        comments: 'Document created',
      });

      res.status(201).json(doc);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      if (err?.code === '23505' && err?.constraint === 'documents_document_code_unique') {
        return res.status(400).json({
          message: 'A document with this code already exists. Please use a unique document code.',
          field: 'documentCode',
        });
      }
      throw err;
    }
  });

  app.put(api.documents.update.path, async (req, res) => {
    try {
      const input = api.documents.update.input.parse(req.body);
      const id = Number(req.params.id);
      
      const existing = await storage.getDocument(id);
      if (!existing) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const updateData: any = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.fileUrl !== undefined) updateData.fileUrl = input.fileUrl;
      if (input.nextReviewDate) {
        updateData.nextReviewDate = new Date(input.nextReviewDate);
      }
      if (input.requiresPreparedBy !== undefined) updateData.requiresPreparedBy = input.requiresPreparedBy;
      if (input.requiresReviewedBy !== undefined) updateData.requiresReviewedBy = input.requiresReviewedBy;
      if (input.requiresApprovedBy !== undefined) updateData.requiresApprovedBy = input.requiresApprovedBy;
      if (input.preparedById !== undefined) updateData.preparedById = input.preparedById;
      if (input.reviewedById !== undefined) updateData.reviewerId = input.reviewedById;
      if (input.approvedById !== undefined) updateData.approverId = input.approvedById;

      const doc = await storage.updateDocument(id, updateData);

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.UPDATE,
        entityType: 'document',
        entityId: id,
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(input),
      });

      res.json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.documents.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getDocument(id);
    if (!existing) {
      return res.status(404).json({ message: 'Document not found' });
    }

    await storage.deleteDocument(id);

    // Audit log
    await storage.createAuditLog({
      userId: getCurrentUserId(req),
      action: AuditAction.DELETE,
      entityType: 'document',
      entityId: id,
      previousValue: JSON.stringify(existing),
    });

    res.status(204).send();
  });

  // ============================================
  // DOCUMENT WORKFLOW ROUTES
  // ============================================
  
  // Helper function to calculate target hours based on importance
  function calculateTargetHours(importance: string): number {
    switch (importance) {
      case 'critical': return 4;
      case 'high': return 8;
      case 'medium': return 24;
      case 'low': return 48;
      default: return 24;
    }
  }

  // Submit for Review - Uses pre-assigned signatories from document
  app.post(api.documents.submitForReview.path, async (req, res) => {
    try {
      const input = api.documents.submitForReview.input.parse(req.body);
      const id = Number(req.params.id);
      const userId = getCurrentUserId(req);
      
      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (doc.status !== DocumentStatus.DRAFT) {
        return res.status(400).json({ message: 'Document must be in Draft status to submit for review' });
      }

      // Check if preparer has confirmed (if preparer confirmation is required)
      if (doc.requiresPreparedBy && doc.preparedById && !doc.preparerConfirmedAt) {
        return res.status(400).json({ 
          message: 'The preparer must confirm the document before submission. Please have the preparer click "Confirm Preparation".' 
        });
      }

      // Use pre-assigned signatories from document
      const reviewerId = doc.reviewerId;
      const approverId = doc.approverId;
      const requiresReview = doc.requiresReviewedBy;
      const requiresApproval = doc.requiresApprovedBy;

      // Validate that reviewer is assigned if review is required
      if (requiresReview && !reviewerId) {
        return res.status(400).json({ 
          message: 'A reviewer must be assigned before submission. Please edit the document and select a reviewer.' 
        });
      }

      // Validate that approver is assigned if approval is required
      if (requiresApproval && !approverId) {
        return res.status(400).json({ 
          message: 'An approver must be assigned before submission. Please edit the document and select an approver.' 
        });
      }

      // Calculate target hours based on document importance
      const importance = (doc as any).importance || 'medium';
      const targetHours = calculateTargetHours(importance);
      const now = new Date();

      // Use nextReviewDate as target if available, otherwise calculate from importance
      let targetDate: Date;
      if (doc.nextReviewDate) {
        targetDate = new Date(doc.nextReviewDate);
      } else {
        targetDate = new Date(now.getTime() + targetHours * 60 * 60 * 1000);
      }

      // Determine new status based on workflow requirements
      let newStatus: string;
      let taskNumber: string = '';
      
      if (requiresReview && reviewerId) {
        // Standard flow: Draft -> In Review
        newStatus = DocumentStatus.IN_REVIEW;
        
        const updated = await storage.updateDocument(id, {
          status: newStatus,
          reviewerId: reviewerId,
        });

        // Create review task (visible immediately)
        taskNumber = await storage.generateTaskNumber();
        
        await storage.createDocumentTask({
          documentId: id,
          taskNumber,
          taskType: DocumentTaskType.REVIEW,
          assignedToId: reviewerId,
          assignedById: userId,
          status: DocumentTaskStatus.ASSIGNED,
          targetDate,
          targetHours,
          isVisible: true,
        });

        // Create approve task (not visible until review is complete)
        if (requiresApproval && approverId) {
          const approveTaskNumber = await storage.generateTaskNumber();
          
          await storage.createDocumentTask({
            documentId: id,
            taskNumber: approveTaskNumber,
            taskType: DocumentTaskType.APPROVE,
            assignedToId: approverId,
            assignedById: userId,
            status: DocumentTaskStatus.PENDING,
            targetDate: null,
            targetHours: 24,
            isVisible: false,
          });
        }

        // Workflow log
        await storage.createWorkflowLog({
          documentId: id,
          fromStatus: DocumentStatus.DRAFT,
          toStatus: newStatus,
          assignedToId: reviewerId,
          actionById: userId,
          comments: input.comments || 'Submitted for review',
        });

        // Notification to reviewer
        await storage.createNotification({
          userId: reviewerId,
          title: 'New Task Assigned',
          message: `Task ${taskNumber}: Document "${doc.title}" (${doc.documentCode}) requires your review. Target: ${targetHours} hours.`,
          urgencyLevel: importance === 'critical' ? UrgencyLevel.CRITICAL : 
                        importance === 'high' ? UrgencyLevel.HIGH : UrgencyLevel.MEDIUM,
          relatedDocumentId: id,
        });

        // Audit log
        await storage.createAuditLog({
          userId,
          action: AuditAction.SUBMIT_FOR_REVIEW,
          entityType: 'document',
          entityId: id,
          previousValue: JSON.stringify({ status: doc.status }),
          newValue: JSON.stringify({ status: newStatus, reviewerId }),
        });

        res.json(updated);
      } else if (requiresApproval && approverId) {
        // Skip review, go directly to pending approval
        newStatus = DocumentStatus.PENDING_APPROVAL;
        
        const updated = await storage.updateDocument(id, {
          status: newStatus,
          approverId: approverId,
        });

        // Create approve task (visible immediately since no review step)
        taskNumber = await storage.generateTaskNumber();
        
        await storage.createDocumentTask({
          documentId: id,
          taskNumber,
          taskType: DocumentTaskType.APPROVE,
          assignedToId: approverId,
          assignedById: userId,
          status: DocumentTaskStatus.ASSIGNED,
          targetDate,
          targetHours,
          isVisible: true,
        });

        // Workflow log
        await storage.createWorkflowLog({
          documentId: id,
          fromStatus: DocumentStatus.DRAFT,
          toStatus: newStatus,
          assignedToId: approverId,
          actionById: userId,
          comments: input.comments || 'Submitted for approval',
        });

        // Notification to approver
        await storage.createNotification({
          userId: approverId,
          title: 'New Task Assigned',
          message: `Task ${taskNumber}: Document "${doc.title}" (${doc.documentCode}) requires your approval. Target: ${targetHours} hours.`,
          urgencyLevel: importance === 'critical' ? UrgencyLevel.CRITICAL : 
                        importance === 'high' ? UrgencyLevel.HIGH : UrgencyLevel.MEDIUM,
          relatedDocumentId: id,
        });

        // Audit log
        await storage.createAuditLog({
          userId,
          action: AuditAction.SUBMIT_FOR_REVIEW,
          entityType: 'document',
          entityId: id,
          previousValue: JSON.stringify({ status: doc.status }),
          newValue: JSON.stringify({ status: newStatus, approverId }),
        });

        res.json(updated);
      } else {
        // No review or approval required - go straight to approved
        newStatus = DocumentStatus.APPROVED;
        
        const updated = await storage.updateDocument(id, {
          status: newStatus,
        });

        // Workflow log
        await storage.createWorkflowLog({
          documentId: id,
          fromStatus: DocumentStatus.DRAFT,
          toStatus: newStatus,
          actionById: userId,
          comments: input.comments || 'Auto-approved (no review/approval required)',
        });

        // Audit log
        await storage.createAuditLog({
          userId,
          action: AuditAction.PUBLISH,
          entityType: 'document',
          entityId: id,
          previousValue: JSON.stringify({ status: doc.status }),
          newValue: JSON.stringify({ status: newStatus }),
        });

        res.json(updated);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Approve (Review stage -> Pending Approval or final approval)
  app.post(api.documents.approve.path, async (req, res) => {
    try {
      const input = api.documents.approve.input.parse(req.body);
      const id = Number(req.params.id);
      
      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      let newStatus: string;
      let actionType: string;

      if (doc.status === DocumentStatus.IN_REVIEW) {
        // Reviewer approves -> move to Pending Approval
        newStatus = DocumentStatus.PENDING_APPROVAL;
        actionType = AuditAction.APPROVE;
      } else if (doc.status === DocumentStatus.PENDING_APPROVAL) {
        // Quality Manager approves -> Published
        newStatus = DocumentStatus.APPROVED;
        actionType = AuditAction.PUBLISH;
      } else {
        return res.status(400).json({ message: 'Document cannot be approved in current status' });
      }

      const updateData: any = { status: newStatus };
      if (newStatus === DocumentStatus.APPROVED) {
        updateData.approverId = getCurrentUserId(req);
        updateData.approvedAt = new Date();
        
        // Increment revision number on approval
        const currentRevision = doc.revisionNumber || 0;
        const currentEdition = doc.editionNumber || 1;
        updateData.revisionNumber = currentRevision + 1;
        
        // Update version string to match edition.revision format
        updateData.versionNumber = `${currentEdition}.${currentRevision + 1}`;

        // Archive old version with edition/revision info
        await storage.createDocumentVersion({
          documentId: id,
          versionNumber: doc.versionNumber,
          editionNumber: currentEdition,
          revisionNumber: currentRevision,
          content: doc.content,
          fileUrl: doc.fileUrl,
          approvedById: doc.approverId,
        });
      }

      const updated = await storage.updateDocument(id, updateData);

      // Workflow log
      await storage.createWorkflowLog({
        documentId: id,
        fromStatus: doc.status,
        toStatus: newStatus,
        actionById: getCurrentUserId(req),
        comments: input.comments || 'Approved',
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: actionType,
        entityType: 'document',
        entityId: id,
        previousValue: JSON.stringify({ status: doc.status }),
        newValue: JSON.stringify({ status: newStatus }),
      });

      // Notification
      if (newStatus === DocumentStatus.PENDING_APPROVAL) {
        // Find quality managers and notify them
        const users = await storage.getUsers();
        const qms = users.filter(u => u.role === UserRole.QUALITY_MANAGER);
        for (const qm of qms) {
          await storage.createNotification({
            userId: qm.id,
            title: 'Document Approval Required',
            message: `Document "${doc.title}" (${doc.documentCode}) requires your final approval.`,
            urgencyLevel: UrgencyLevel.HIGH,
            relatedDocumentId: id,
          });
        }
      } else if (newStatus === DocumentStatus.APPROVED) {
        await storage.createNotification({
          userId: doc.createdById,
          title: 'Document Published',
          message: `Your document "${doc.title}" (${doc.documentCode}) has been approved and published.`,
          urgencyLevel: UrgencyLevel.LOW,
          relatedDocumentId: id,
        });
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Reject
  app.post(api.documents.reject.path, async (req, res) => {
    try {
      const input = api.documents.reject.input.parse(req.body);
      const id = Number(req.params.id);
      
      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (doc.status !== DocumentStatus.IN_REVIEW && doc.status !== DocumentStatus.PENDING_APPROVAL) {
        return res.status(400).json({ message: 'Document cannot be rejected in current status' });
      }

      const updated = await storage.updateDocument(id, {
        status: DocumentStatus.DRAFT,
        reviewerId: null,
      });

      // Workflow log
      await storage.createWorkflowLog({
        documentId: id,
        fromStatus: doc.status,
        toStatus: DocumentStatus.DRAFT,
        actionById: getCurrentUserId(req),
        comments: input.comments,
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.REJECT,
        entityType: 'document',
        entityId: id,
        previousValue: JSON.stringify({ status: doc.status }),
        newValue: JSON.stringify({ status: DocumentStatus.DRAFT, comments: input.comments }),
      });

      // Notification to creator
      await storage.createNotification({
        userId: doc.createdById,
        title: 'Document Rejected',
        message: `Your document "${doc.title}" (${doc.documentCode}) was rejected. Reason: ${input.comments}`,
        urgencyLevel: UrgencyLevel.HIGH,
        relatedDocumentId: id,
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Get workflow history
  app.get(api.documents.workflowHistory.path, async (req, res) => {
    const logs = await storage.getWorkflowLogs(Number(req.params.id));
    res.json(logs);
  });

  // ============================================
  // NOTIFICATION ROUTES
  // ============================================
  app.get(api.notifications.list.path, async (req, res) => {
    const notifications = await storage.getNotifications();
    res.json(notifications);
  });

  app.put(api.notifications.markRead.path, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const notification = await storage.markNotificationRead(id);
      res.json(notification);
    } catch {
      return res.status(404).json({ message: 'Notification not found' });
    }
  });

  app.put(api.notifications.markAllRead.path, async (req, res) => {
    const count = await storage.markAllNotificationsRead(getCurrentUserId(req));
    res.json({ count });
  });

  // ============================================
  // AUDIT LOG ROUTES
  // ============================================
  app.get(api.auditLogs.list.path, async (req, res) => {
    const logs = await storage.getAuditLogs(100);
    res.json(logs);
  });

  // ============================================
  // MY TASKS ROUTES
  // ============================================
  app.get(api.myTasks.list.path, async (req, res) => {
    const userId = getCurrentUserId(req);
    const tasks = await storage.getMyTasks(userId);
    res.json(tasks.map(t => ({
      ...t,
      createdAt: t.createdAt?.toISOString() || null,
      dueDate: t.dueDate?.toISOString() || null,
    })));
  });

  app.post(api.myTasks.complete.path, async (req, res) => {
    try {
      const input = api.myTasks.complete.input.parse(req.body);
      const documentId = Number(req.params.documentId);
      const userId = getCurrentUserId(req);

      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let updates: any = {};

      if (input.taskType === 'prepare') {
        if (doc.preparedById !== userId) {
          return res.status(403).json({ message: 'You are not assigned to prepare this document' });
        }
        updates = {
          preparedBySignedAt: new Date(),
        };
      } else if (input.taskType === 'review') {
        if (doc.reviewerId !== userId) {
          return res.status(403).json({ message: 'You are not assigned to review this document' });
        }
        updates = {
          reviewedById: userId,
          reviewedBySignedAt: new Date(),
          status: DocumentStatus.PENDING_APPROVAL,
        };

        // Notify quality managers for approval
        const qms = await storage.getUsers();
        for (const qm of qms.filter(u => u.role === UserRole.QUALITY_MANAGER || u.role === UserRole.ADMIN)) {
          await storage.createNotification({
            userId: qm.id,
            title: 'Document Approval Required',
            message: `Document "${doc.title}" (${doc.documentCode}) requires your final approval.`,
            urgencyLevel: UrgencyLevel.HIGH,
            relatedDocumentId: documentId,
          });
        }
      } else if (input.taskType === 'approve') {
        if (doc.approverId !== userId) {
          return res.status(403).json({ message: 'You are not assigned to approve this document' });
        }

        // Increment revision number on approval
        const newRevision = (doc.revisionNumber || 0) + 1;
        const newVersionNumber = `Ed.${doc.editionNumber || 1} Rev.${newRevision}`;

        updates = {
          approvedById: userId,
          approvedBySignedAt: new Date(),
          approvedAt: new Date(),
          status: DocumentStatus.APPROVED,
          revisionNumber: newRevision,
          versionNumber: newVersionNumber,
        };

        // Notify document creator
        await storage.createNotification({
          userId: doc.createdById,
          title: 'Document Published',
          message: `Your document "${doc.title}" (${doc.documentCode}) has been approved and published.`,
          urgencyLevel: UrgencyLevel.LOW,
          relatedDocumentId: documentId,
        });
      }

      const updated = await storage.updateDocument(documentId, updates);

      // Workflow log
      await storage.createWorkflowLog({
        documentId,
        fromStatus: doc.status,
        toStatus: updated.status,
        actionById: userId,
        comments: input.comments || `Task completed: ${input.taskType}`,
      });

      // Audit log
      await storage.createAuditLog({
        userId,
        action: input.taskType === 'approve' ? AuditAction.APPROVE : AuditAction.UPDATE,
        entityType: 'document',
        entityId: documentId,
        previousValue: JSON.stringify({ status: doc.status }),
        newValue: JSON.stringify({ status: updated.status, taskType: input.taskType }),
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // ============================================
  // EMPLOYEE ROUTES (HR)
  // ============================================
  app.get(api.employees.list.path, async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      department: req.query.department as string | undefined,
    };
    const employees = await storage.getEmployees(filters);
    res.json(employees);
  });

  app.get(api.employees.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }
    const employee = await storage.getEmployee(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  });

  app.post(api.employees.create.path, async (req, res) => {
    try {
      const input = api.employees.create.input.parse(req.body);
      
      // Check if employee number or email already exists
      const existingByNumber = await storage.getEmployeeByNumber(input.employeeNumber);
      if (existingByNumber) {
        return res.status(400).json({ message: 'Employee number already exists', field: 'employeeNumber' });
      }
      
      const existingByEmail = await storage.getEmployeeByEmail(input.email);
      if (existingByEmail) {
        return res.status(400).json({ message: 'Email already exists', field: 'email' });
      }

      const employee = await storage.createEmployee({
        employeeNumber: input.employeeNumber,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        jobTitle: input.jobTitle,
        department: input.department,
        employmentType: input.employmentType,
        supervisorId: input.supervisorId || null,
        hireDate: new Date(input.hireDate),
        status: input.status || 'active',
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.CREATE,
        entityType: 'employee',
        entityId: employee.id,
        newValue: JSON.stringify(input),
      });

      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.employees.update.path, async (req, res) => {
    try {
      const input = api.employees.update.input.parse(req.body);
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
      }
      
      const existing = await storage.getEmployee(id);
      if (!existing) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Check email uniqueness if email is being updated
      if (input.email && input.email !== existing.email) {
        const existingByEmail = await storage.getEmployeeByEmail(input.email);
        if (existingByEmail) {
          return res.status(400).json({ message: 'Email already exists', field: 'email' });
        }
      }

      const employee = await storage.updateEmployee(id, input);

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.UPDATE,
        entityType: 'employee',
        entityId: id,
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(input),
      });

      res.json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.employees.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }
    
    const existing = await storage.getEmployee(id);
    if (!existing) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await storage.deleteEmployee(id);

    // Audit log
    await storage.createAuditLog({
      userId: getCurrentUserId(req),
      action: AuditAction.DELETE,
      entityType: 'employee',
      entityId: id,
      previousValue: JSON.stringify(existing),
    });

    res.status(204).send();
  });

  // ============================================
  // EMPLOYEE TASK ROUTES (HR)
  // ============================================
  app.get(api.employeeTasks.list.path, async (req, res) => {
    const filters = {
      employeeId: req.query.employeeId ? Number(req.query.employeeId) : undefined,
      status: req.query.status as string | undefined,
      documentId: req.query.documentId ? Number(req.query.documentId) : undefined,
    };
    const tasks = await storage.getEmployeeTasks(filters);
    res.json(tasks);
  });

  app.get(api.employeeTasks.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }
    const task = await storage.getEmployeeTask(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  });

  app.post(api.employeeTasks.create.path, async (req, res) => {
    try {
      const input = api.employeeTasks.create.input.parse(req.body);
      
      // Verify employee exists
      const employee = await storage.getEmployee(input.employeeId);
      if (!employee) {
        return res.status(400).json({ message: 'Employee not found', field: 'employeeId' });
      }

      // Verify document exists if provided
      if (input.documentId) {
        const doc = await storage.getDocument(input.documentId);
        if (!doc) {
          return res.status(400).json({ message: 'Document not found', field: 'documentId' });
        }
      }

      const task = await storage.createEmployeeTask({
        employeeId: input.employeeId,
        documentId: input.documentId || null,
        title: input.title,
        description: input.description || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority || 'medium',
        notes: input.notes || null,
        assignedByUserId: getCurrentUserId(req),
        status: 'pending',
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.ASSIGN_TASK,
        entityType: 'employee_task',
        entityId: task.id,
        newValue: JSON.stringify({ ...input, employeeName: employee.name }),
      });

      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.employeeTasks.update.path, async (req, res) => {
    try {
      const input = api.employeeTasks.update.input.parse(req.body);
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid task ID' });
      }
      
      const existing = await storage.getEmployeeTask(id);
      if (!existing) {
        return res.status(404).json({ message: 'Task not found' });
      }

      const updateData: any = { ...input };
      if (input.dueDate) {
        updateData.dueDate = new Date(input.dueDate);
      }

      const task = await storage.updateEmployeeTask(id, updateData);

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.UPDATE,
        entityType: 'employee_task',
        entityId: id,
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(input),
      });

      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.employeeTasks.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }
    
    const existing = await storage.getEmployeeTask(id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await storage.deleteEmployeeTask(id);

    // Audit log
    await storage.createAuditLog({
      userId: getCurrentUserId(req),
      action: AuditAction.DELETE,
      entityType: 'employee_task',
      entityId: id,
      previousValue: JSON.stringify(existing),
    });

    res.status(204).send();
  });

  app.post(api.employeeTasks.complete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }
    
    const existing = await storage.getEmployeeTask(id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = await storage.completeEmployeeTask(id);

    // Audit log
    await storage.createAuditLog({
      userId: getCurrentUserId(req),
      action: AuditAction.COMPLETE_TASK,
      entityType: 'employee_task',
      entityId: id,
      previousValue: JSON.stringify({ status: existing.status }),
      newValue: JSON.stringify({ status: 'completed' }),
    });

    res.json(task);
  });

  // ============================================
  // PDF GENERATION
  // ============================================
  app.post('/api/documents/:id/generate-pdf', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const doc = await storage.getDocument(id);
    
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    try {
      const users = await storage.getUsers();
      const preparedBy = users.find(u => u.id === doc.preparedById);
      const reviewedBy = users.find(u => u.id === doc.reviewerId);
      const approvedBy = users.find(u => u.id === doc.approverId);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; margin: 0; padding: 0; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { font-weight: bold; font-size: 18px; }
            .doc-info { text-align: right; font-size: 10px; }
            .content { min-height: 600px; }
            .content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            .content table td, .content table th { border: 1px solid #000; padding: 8px; }
            .content img { max-width: 100%; }
            .signatures { margin-top: 40px; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 20px; }
            .signature-block { width: 30%; text-align: center; }
            .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">SAHIH CERTIFICATIONS</div>
            <div class="doc-info">
              <div><strong>${doc.documentCode}</strong></div>
              <div>Ed.${doc.editionNumber || 1} Rev.${doc.revisionNumber || 0}</div>
              <div>Status: ${doc.status}</div>
            </div>
          </div>
          <h1 style="text-align: center; margin-bottom: 30px;">${doc.title}</h1>
          <div class="content">${doc.content || ''}</div>
          <div class="signatures">
            <div class="signature-block">
              <div>Prepared By</div>
              <div class="signature-line">${preparedBy?.name || 'N/A'}</div>
            </div>
            <div class="signature-block">
              <div>Reviewed By</div>
              <div class="signature-line">${reviewedBy?.name || 'N/A'}</div>
            </div>
            <div class="signature-block">
              <div>Approved By</div>
              <div class="signature-line">${approvedBy?.name || 'N/A'}</div>
            </div>
          </div>
        </body>
        </html>
      `;

      const browser = await puppeteer.launch({ 
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true
      });
      
      await browser.close();

      const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      await storage.updateDocument(id, { 
        finalPdfUrl: pdfDataUrl,
        finalPdfGeneratedAt: new Date()
      });

      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.UPDATE,
        entityType: 'document',
        entityId: id,
        newValue: JSON.stringify({ action: 'PDF generated' }),
      });

      res.json({ success: true, pdfUrl: pdfDataUrl });
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  app.get('/api/documents/:id/pdf', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const doc = await storage.getDocument(id);
    
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    if (!doc.finalPdfUrl) {
      return res.status(404).json({ message: 'PDF not generated yet' });
    }

    res.json({ pdfUrl: doc.finalPdfUrl });
  });

  // ============================================
  // DOWNLOAD REQUESTS
  // ============================================
  app.get('/api/download-requests', requireAuth, async (req, res) => {
    const user = await storage.getUser(getCurrentUserId(req));
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    let requests;
    if (user.role === UserRole.ADMIN || user.role === UserRole.QUALITY_MANAGER) {
      requests = await storage.getDownloadRequests();
    } else {
      requests = await storage.getDownloadRequests({ requesterId: user.id });
    }

    res.json(requests);
  });

  app.post('/api/download-requests', requireAuth, async (req, res) => {
    try {
      const { documentId, reason } = req.body;
      
      if (!documentId) {
        return res.status(400).json({ message: 'Document ID is required' });
      }

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const request = await storage.createDownloadRequest({
        documentId,
        requesterId: getCurrentUserId(req),
        reason: reason || null,
        status: DownloadRequestStatus.PENDING,
      });

      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.CREATE,
        entityType: 'download_request',
        entityId: request.id,
        newValue: JSON.stringify({ documentId, reason }),
      });

      const admins = (await storage.getUsers()).filter(u => 
        u.role === UserRole.ADMIN || u.role === UserRole.QUALITY_MANAGER
      );
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          title: 'Download Request Pending',
          message: `A user has requested permission to download "${doc.title}" (${doc.documentCode}).`,
          urgencyLevel: UrgencyLevel.MEDIUM,
          relatedDocumentId: documentId,
        });
      }

      res.status(201).json(request);
    } catch (err) {
      console.error('Create download request error:', err);
      res.status(500).json({ message: 'Failed to create download request' });
    }
  });

  app.post('/api/download-requests/:id/approve', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await storage.getUser(getCurrentUserId(req));
    
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.QUALITY_MANAGER)) {
      return res.status(403).json({ message: 'Only Admin or Quality Manager can approve download requests' });
    }

    const request = await storage.getDownloadRequest(id);
    if (!request) {
      return res.status(404).json({ message: 'Download request not found' });
    }

    const updated = await storage.updateDownloadRequest(id, {
      status: DownloadRequestStatus.APPROVED,
      decidedById: user.id,
      decidedAt: new Date(),
    });

    await storage.createAuditLog({
      userId: user.id,
      action: AuditAction.APPROVE,
      entityType: 'download_request',
      entityId: id,
      previousValue: JSON.stringify({ status: request.status }),
      newValue: JSON.stringify({ status: DownloadRequestStatus.APPROVED }),
    });

    await storage.createNotification({
      userId: request.requesterId,
      title: 'Download Request Approved',
      message: `Your request to download document has been approved.`,
      urgencyLevel: UrgencyLevel.LOW,
    });

    res.json(updated);
  });

  app.post('/api/download-requests/:id/reject', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { reason } = req.body;
    const user = await storage.getUser(getCurrentUserId(req));
    
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.QUALITY_MANAGER)) {
      return res.status(403).json({ message: 'Only Admin or Quality Manager can reject download requests' });
    }

    const request = await storage.getDownloadRequest(id);
    if (!request) {
      return res.status(404).json({ message: 'Download request not found' });
    }

    const updated = await storage.updateDownloadRequest(id, {
      status: DownloadRequestStatus.REJECTED,
      decidedById: user.id,
      decidedAt: new Date(),
    });

    await storage.createAuditLog({
      userId: user.id,
      action: AuditAction.REJECT,
      entityType: 'download_request',
      entityId: id,
      previousValue: JSON.stringify({ status: request.status }),
      newValue: JSON.stringify({ status: DownloadRequestStatus.REJECTED, reason }),
    });

    await storage.createNotification({
      userId: request.requesterId,
      title: 'Download Request Rejected',
      message: `Your request to download document was rejected.${reason ? ' Reason: ' + reason : ''}`,
      urgencyLevel: UrgencyLevel.LOW,
    });

    res.json(updated);
  });

  // ============================================
  // DOCUMENT FEEDBACK (Review Comments & Corrections)
  // ============================================
  app.get('/api/documents/:id/feedback', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const doc = await storage.getDocument(id);
    
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const feedback = await storage.getDocumentFeedback(id);
    res.json(feedback);
  });

  app.post('/api/documents/:id/feedback', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { content, feedbackType, role } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: 'Content is required' });
      }
      
      if (!role || !['reviewer', 'approver'].includes(role)) {
        return res.status(400).json({ message: 'Role must be reviewer or approver' });
      }

      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      
      // Verify the user has permission to provide feedback
      if (role === 'reviewer' && doc.reviewerId !== userId) {
        return res.status(403).json({ message: 'Only the assigned reviewer can add reviewer feedback' });
      }
      if (role === 'approver' && doc.approverId !== userId) {
        return res.status(403).json({ message: 'Only the assigned approver can add approver feedback' });
      }

      const feedback = await storage.createDocumentFeedback({
        documentId: id,
        authorId: userId,
        content,
        feedbackType: feedbackType || 'comment',
        role,
        status: 'pending',
      });

      // Notify document author
      await storage.createNotification({
        userId: doc.createdById,
        title: `Feedback on ${doc.documentCode}`,
        message: `${user?.name || 'A reviewer'} has added ${feedbackType || 'a comment'}: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
        urgencyLevel: feedbackType === 'correction' ? UrgencyLevel.HIGH : UrgencyLevel.MEDIUM,
        relatedDocumentId: id,
      });

      // Audit log
      await storage.createAuditLog({
        userId,
        action: AuditAction.CREATE,
        entityType: 'document_feedback',
        entityId: feedback.id,
        newValue: JSON.stringify({ documentId: id, feedbackType, role }),
      });

      res.status(201).json(feedback);
    } catch (err) {
      console.error('Create feedback error:', err);
      res.status(500).json({ message: 'Failed to create feedback' });
    }
  });

  app.post('/api/feedback/:id/address', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    
    const feedback = await storage.updateDocumentFeedback(id, {
      status: 'addressed',
    });
    
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    await storage.createAuditLog({
      userId: getCurrentUserId(req),
      action: AuditAction.UPDATE,
      entityType: 'document_feedback',
      entityId: id,
      newValue: JSON.stringify({ status: 'addressed' }),
    });

    res.json(feedback);
  });

  // ============================================
  // SEED DATABASE
  // ============================================
  // ============================================
  // DOCUMENT TASKS (Sequential Workflow)
  // ============================================
  
  // Helper function to calculate target hours based on importance
  function getTargetHours(importance: string): number {
    switch (importance) {
      case DocumentImportance.CRITICAL: return 4;  // 4 hours for critical
      case DocumentImportance.HIGH: return 8;      // 8 hours for high
      case DocumentImportance.MEDIUM: return 24;   // 24 hours for medium
      case DocumentImportance.LOW: return 48;      // 48 hours for low
      default: return 24;
    }
  }

  // Get document tasks for current user (visible tasks only)
  app.get('/api/document-tasks', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const tasks = await storage.getDocumentTasks({ 
        assignedToId: userId, 
        isVisible: true 
      });
      
      // Enrich with document info
      const enrichedTasks = await Promise.all(tasks.map(async (task) => {
        const doc = await storage.getDocument(task.documentId);
        const now = new Date();
        const delayHours = task.targetDate && now > task.targetDate 
          ? Math.ceil((now.getTime() - task.targetDate.getTime()) / (1000 * 60 * 60))
          : 0;
        
        return {
          ...task,
          documentCode: doc?.documentCode,
          documentTitle: doc?.title,
          currentDelayHours: delayHours,
        };
      }));
      
      res.json(enrichedTasks);
    } catch (err) {
      console.error('Error fetching document tasks:', err);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Get all tasks for a document
  app.get('/api/documents/:id/tasks', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const tasks = await storage.getDocumentTasks({ documentId });
      res.json(tasks);
    } catch (err) {
      console.error('Error fetching document tasks:', err);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Get all visible document tasks system-wide (for managers to monitor and poke)
  app.get('/api/document-tasks/all', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const currentUser = await storage.getUser(userId);
      
      // Only Admin, Quality Manager, Department Head can view all tasks
      const allowedRoles = [UserRole.ADMIN, UserRole.QUALITY_MANAGER, UserRole.DEPARTMENT_HEAD];
      if (!currentUser || !allowedRoles.includes(currentUser.role as any)) {
        return res.status(403).json({ message: 'Access denied. Task monitoring is restricted.' });
      }
      
      // Get all visible tasks (tasks that are currently actionable or awaiting action)
      // The isVisible flag controls sequential visibility - hidden tasks stay hidden
      const allTasks = await storage.getDocumentTasks({ 
        isVisible: true 
      });
      
      // Filter out completed tasks - managers only need to see tasks needing action
      const activeTasks = allTasks.filter(t => t.status !== DocumentTaskStatus.COMPLETED);
      
      const enrichedTasks = await Promise.all(activeTasks.map(async (task) => {
        const doc = await storage.getDocument(task.documentId);
        const assignedUser = await storage.getUser(task.assignedToId);
        const now = new Date();
        const delayHours = task.targetDate && now > task.targetDate 
          ? Math.ceil((now.getTime() - task.targetDate.getTime()) / (1000 * 60 * 60))
          : 0;
        
        return {
          ...task,
          documentCode: doc?.documentCode,
          documentTitle: doc?.title,
          assignedToName: assignedUser?.name,
          currentDelayHours: delayHours,
        };
      }));
      
      res.json(enrichedTasks);
    } catch (err) {
      console.error('Error fetching all document tasks:', err);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Complete a document task
  app.post('/api/document-tasks/:id/complete', requireAuth, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const userId = getCurrentUserId(req);
      
      const task = await storage.getDocumentTask(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      if (task.assignedToId !== userId) {
        return res.status(403).json({ message: 'You are not assigned to this task' });
      }
      
      const completedTask = await storage.completeDocumentTask(taskId);
      
      // If this was a review task, make the approve task visible
      if (task.taskType === DocumentTaskType.REVIEW) {
        const approveTask = await storage.getDocumentTasks({ 
          documentId: task.documentId, 
          status: DocumentTaskStatus.PENDING 
        });
        const approverTask = approveTask.find(t => t.taskType === DocumentTaskType.APPROVE);
        if (approverTask) {
          // Set approval target date to 1 day (24 hours) from now (review completion time)
          const approvalTargetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          
          await storage.updateDocumentTask(approverTask.id, { 
            isVisible: true,
            status: DocumentTaskStatus.ASSIGNED,
            targetDate: approvalTargetDate,
          });
          
          // Notify approver
          await storage.createNotification({
            userId: approverTask.assignedToId,
            title: 'New Task Assigned',
            message: `Review completed. Task ${approverTask.taskNumber} is now awaiting your approval.`,
            urgencyLevel: UrgencyLevel.HIGH,
            relatedDocumentId: task.documentId,
          });
        }
      }
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: AuditAction.COMPLETE_TASK,
        entityType: 'document_task',
        entityId: taskId,
        newValue: JSON.stringify({ 
          status: completedTask.status,
          performancePoints: completedTask.performancePoints,
          earlyHours: completedTask.earlyHours,
          delayHours: completedTask.delayHours,
        }),
      });
      
      res.json(completedTask);
    } catch (err) {
      console.error('Error completing task:', err);
      res.status(500).json({ message: 'Failed to complete task' });
    }
  });

  // ============================================
  // TASK POKES (Buzz/Reminder)
  // ============================================
  
  // Get pokes for a task
  app.get('/api/document-tasks/:id/pokes', requireAuth, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const pokes = await storage.getTaskPokes(taskId);
      res.json(pokes);
    } catch (err) {
      console.error('Error fetching pokes:', err);
      res.status(500).json({ message: 'Failed to fetch pokes' });
    }
  });

  // Poke/Buzz a user about their pending task
  app.post('/api/document-tasks/:id/poke', requireAuth, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const userId = getCurrentUserId(req);
      const { message } = req.body;
      
      const task = await storage.getDocumentTask(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Create the poke record
      const poke = await storage.createTaskPoke({
        documentTaskId: taskId,
        pokedById: userId,
        pokedUserId: task.assignedToId,
        message: message || 'Please complete your pending task.',
      });
      
      // Get document info for notification
      const doc = await storage.getDocument(task.documentId);
      
      // Create notification for the poked user
      await storage.createNotification({
        userId: task.assignedToId,
        title: 'Task Reminder',
        message: `You have been reminded about task ${task.taskNumber} for document "${doc?.title || 'Unknown'}". ${message || ''}`,
        urgencyLevel: UrgencyLevel.HIGH,
        relatedDocumentId: task.documentId,
      });
      
      res.json(poke);
    } catch (err) {
      console.error('Error creating poke:', err);
      res.status(500).json({ message: 'Failed to send reminder' });
    }
  });

  // ============================================
  // PREPARER CONFIRMATION
  // ============================================
  
  // Confirm document as preparer (required before submission)
  app.post('/api/documents/:id/confirm-preparation', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const userId = getCurrentUserId(req);
      
      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      if (doc.status !== DocumentStatus.DRAFT) {
        return res.status(400).json({ message: 'Document must be in Draft status' });
      }
      
      if (doc.preparedById !== userId) {
        return res.status(403).json({ message: 'You are not assigned as the preparer for this document' });
      }
      
      const updated = await storage.updateDocument(documentId, {
        preparerConfirmedAt: new Date(),
        preparedBySignedAt: new Date(),
      });
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: AuditAction.COMPLETE_TASK,
        entityType: 'document',
        entityId: documentId,
        newValue: JSON.stringify({ preparerConfirmedAt: updated.preparerConfirmedAt }),
      });
      
      res.json(updated);
    } catch (err) {
      console.error('Error confirming preparation:', err);
      res.status(500).json({ message: 'Failed to confirm preparation' });
    }
  });

  // ============================================
  // USER PERFORMANCE STATS (COO/CEO/Admin only)
  // ============================================
  
  app.get('/api/users/:id/performance', requireAuth, async (req, res) => {
    try {
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Only COO, CEO, and Admin can view performance stats
      const allowedRoles = [UserRole.ADMIN, UserRole.QUALITY_MANAGER];
      if (!currentUser || !allowedRoles.includes(currentUser.role as any)) {
        return res.status(403).json({ message: 'Access denied. Performance data is restricted.' });
      }
      
      const targetUserId = Number(req.params.id);
      const stats = await storage.getUserPerformanceStats(targetUserId);
      res.json(stats);
    } catch (err) {
      console.error('Error fetching performance stats:', err);
      res.status(500).json({ message: 'Failed to fetch performance stats' });
    }
  });

  // Get all users' performance stats (for dashboard)
  app.get('/api/performance/all', requireAuth, async (req, res) => {
    try {
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Only COO, CEO, and Admin can view performance stats
      const allowedRoles = [UserRole.ADMIN, UserRole.QUALITY_MANAGER];
      if (!currentUser || !allowedRoles.includes(currentUser.role as any)) {
        return res.status(403).json({ message: 'Access denied. Performance data is restricted.' });
      }
      
      const users = await storage.getUsers();
      const performanceData = await Promise.all(
        users.map(async (user) => ({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          ...await storage.getUserPerformanceStats(user.id),
        }))
      );
      
      res.json(performanceData);
    } catch (err) {
      console.error('Error fetching all performance stats:', err);
      res.status(500).json({ message: 'Failed to fetch performance stats' });
    }
  });

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingUsers = await storage.getUsers();
  if (existingUsers.length === 0) {
    // Create Admin user
    await storage.createUser({
      name: "Admin User",
      email: "admin@sahihcert.qa",
      passwordHash: "admin123",
      role: UserRole.ADMIN,
      inductionStatus: InductionStatus.COMPLETED,
      isActive: true,
    });

    // Create Quality Manager
    await storage.createUser({
      name: "Fatima Al-Hassan",
      email: "fatima@sahihcert.qa",
      passwordHash: "password123",
      role: UserRole.QUALITY_MANAGER,
      inductionStatus: InductionStatus.COMPLETED,
      isActive: true,
    });

    // Create Department Head
    await storage.createUser({
      name: "Mohammed Al-Thani",
      email: "mohammed@sahihcert.qa",
      passwordHash: "password123",
      role: UserRole.DEPARTMENT_HEAD,
      inductionStatus: InductionStatus.COMPLETED,
      isActive: true,
    });

    // Create Staff member
    await storage.createUser({
      name: "Sara Ahmed",
      email: "sara@sahihcert.qa",
      passwordHash: "password123",
      role: UserRole.STAFF,
      inductionStatus: InductionStatus.PENDING,
      isActive: true,
    });

    // Create Auditor
    await storage.createUser({
      name: "Khalid Rahman",
      email: "khalid@sahihcert.qa",
      passwordHash: "password123",
      role: UserRole.AUDITOR,
      inductionStatus: InductionStatus.COMPLETED,
      isActive: true,
    });
  }

}
