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
  
  // Submit for Review
  app.post(api.documents.submitForReview.path, async (req, res) => {
    try {
      const input = api.documents.submitForReview.input.parse(req.body);
      const id = Number(req.params.id);
      
      const doc = await storage.getDocument(id);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (doc.status !== DocumentStatus.DRAFT) {
        return res.status(400).json({ message: 'Document must be in Draft status to submit for review' });
      }

      const updated = await storage.updateDocument(id, {
        status: DocumentStatus.IN_REVIEW,
        reviewerId: input.reviewerId,
      });

      // Workflow log
      await storage.createWorkflowLog({
        documentId: id,
        fromStatus: DocumentStatus.DRAFT,
        toStatus: DocumentStatus.IN_REVIEW,
        assignedToId: input.reviewerId,
        actionById: getCurrentUserId(req),
        comments: input.comments || 'Submitted for review',
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.SUBMIT_FOR_REVIEW,
        entityType: 'document',
        entityId: id,
        previousValue: JSON.stringify({ status: doc.status }),
        newValue: JSON.stringify({ status: DocumentStatus.IN_REVIEW, reviewerId: input.reviewerId }),
      });

      // Notification to reviewer
      await storage.createNotification({
        userId: input.reviewerId,
        title: 'Document Review Required',
        message: `Document "${doc.title}" (${doc.documentCode}) requires your review.`,
        urgencyLevel: UrgencyLevel.MEDIUM,
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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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
  // SEED DATABASE
  // ============================================
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
