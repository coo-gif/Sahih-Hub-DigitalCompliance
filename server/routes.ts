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
  DocumentAccessRequestStatus,
  EmployeeRecordStatus,
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
        status: input.status || DocumentStatus.DRAFT,
        createdById: getCurrentUserId(req),
        nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
        requiresPreparedBy: input.requiresPreparedBy ?? true,
        requiresReviewedBy: input.requiresReviewedBy ?? true,
        requiresApprovedBy: input.requiresApprovedBy ?? true,
        preparedById: input.preparedById || null,
        reviewerId: input.reviewerId || input.reviewedById || null,
        approverId: input.approvedById || null,
        assignedStaffIds: input.assignedStaffIds || null,
        assignedDepartments: input.assignedDepartments || null,
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

  // Document Submit for Review
  app.post(api.documents.submitForReview.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }

      const input = api.documents.submitForReview.input.parse(req.body);
      
      const existing = await storage.getDocument(id);
      if (!existing) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (existing.status !== DocumentStatus.DRAFT) {
        return res.status(400).json({ message: 'Document can only be submitted for review from Draft status' });
      }

      const reviewer = await storage.getUser(input.reviewerId);
      if (!reviewer) {
        return res.status(400).json({ message: 'Reviewer not found', field: 'reviewerId' });
      }

      // Update document status to in_review
      const updateData: any = {
        status: DocumentStatus.IN_REVIEW,
        reviewerId: input.reviewerId,
      };

      if (input.approverId) {
        const approver = await storage.getUser(input.approverId);
        if (!approver) {
          return res.status(400).json({ message: 'Approver not found', field: 'approverId' });
        }
        updateData.approverId = input.approverId;
      }

      const doc = await storage.updateDocument(id, updateData);

      // Create notification for reviewer
      await storage.createNotification({
        userId: input.reviewerId,
        title: 'Document Requires Review',
        message: `Document "${doc.title}" (${doc.documentCode}) requires your review.`,
        urgencyLevel: 'medium',
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.SUBMIT_FOR_REVIEW,
        entityType: 'document',
        entityId: id,
        previousValue: JSON.stringify({ status: existing.status }),
        newValue: JSON.stringify({ status: doc.status, reviewerId: input.reviewerId }),
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

  // ============================================
  // MY TASKS (Virtual task list based on document assignments)
  // ============================================
  app.get('/api/my-tasks', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const currentUser = await storage.getUser(userId);
      const allDocs = await storage.getDocuments();
      const tasks: any[] = [];

      for (const doc of allDocs) {
        // Review task: User is reviewer and document is in_review
        if (doc.reviewerId === userId && doc.status === DocumentStatus.IN_REVIEW) {
          tasks.push({
            id: doc.id * 1000 + 1,
            documentId: doc.id,
            documentCode: doc.documentCode,
            title: doc.title,
            taskType: 'review',
            status: 'pending',
            createdAt: doc.updatedAt || doc.createdAt,
            dueDate: doc.nextReviewDate,
          });
        }

        // Approve task: User is approver and document is pending_approval
        if (doc.approverId === userId && doc.status === DocumentStatus.PENDING_APPROVAL) {
          tasks.push({
            id: doc.id * 1000 + 2,
            documentId: doc.id,
            documentCode: doc.documentCode,
            title: doc.title,
            taskType: 'approve',
            status: 'pending',
            createdAt: doc.updatedAt || doc.createdAt,
            dueDate: doc.nextReviewDate,
          });
        }
      }

      // Add employee review/approval tasks
      const allEmployees = await storage.getEmployees();
      for (const emp of allEmployees) {
        // Get supervisor name if available
        let supervisorName: string | null = null;
        if (emp.supervisorId) {
          const supervisor = allEmployees.find(e => e.id === emp.supervisorId);
          supervisorName = supervisor?.name || null;
        }
        
        // Employee review task: User is reviewer and employee is in_review
        if (emp.reviewerId === userId && emp.workflowStatus === EmployeeRecordStatus.IN_REVIEW) {
          tasks.push({
            id: emp.id * 1000 + 5,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeEmail: emp.email,
            employeePhone: emp.phone || null,
            employeeJobTitle: emp.jobTitle,
            employeeDepartment: emp.department,
            employeeSupervisorName: supervisorName,
            title: `Review Employee Record: ${emp.name}`,
            taskType: 'employee_review',
            status: 'pending',
            createdAt: emp.submittedForReviewAt || emp.createdAt,
            dueDate: null,
          });
        }
        
        // Employee approval task: User is approver and employee is pending_approval
        if (emp.approverId === userId && emp.workflowStatus === EmployeeRecordStatus.PENDING_APPROVAL) {
          tasks.push({
            id: emp.id * 1000 + 6,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeEmail: emp.email,
            employeePhone: emp.phone || null,
            employeeJobTitle: emp.jobTitle,
            employeeDepartment: emp.department,
            employeeSupervisorName: supervisorName,
            title: `Approve Employee Record: ${emp.name}`,
            taskType: 'employee_approve',
            status: 'pending',
            createdAt: emp.submittedForApprovalAt || emp.createdAt,
            dueDate: null,
          });
        }
      }

      // Add pending download requests for Admin and Quality Manager
      if (currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.QUALITY_MANAGER)) {
        const pendingDownloadRequests = await storage.getDownloadRequests({ status: DownloadRequestStatus.PENDING });
        
        for (const request of pendingDownloadRequests) {
          const doc = await storage.getDocument(request.documentId);
          if (doc) {
            tasks.push({
              id: request.id * 1000 + 3, // Use different multiplier to avoid ID conflicts
              documentId: doc.id,
              documentCode: doc.documentCode,
              title: doc.title,
              taskType: 'download_approval',
              status: 'pending',
              createdAt: request.createdAt,
              dueDate: null,
              downloadRequestId: request.id,
              requesterId: request.requesterId,
              reason: request.reason,
            });
          }
        }
        
        // Add pending document access requests
        const pendingAccessRequests = await storage.getDocumentAccessRequests({ status: 'pending' });
        
        for (const request of pendingAccessRequests) {
          const doc = await storage.getDocument(request.documentId);
          const requester = await storage.getUser(request.requesterId);
          if (doc) {
            tasks.push({
              id: request.id * 1000 + 4, // Use different multiplier to avoid ID conflicts
              documentId: doc.id,
              documentCode: doc.documentCode,
              title: doc.title,
              taskType: 'access_approval',
              status: 'pending',
              createdAt: request.createdAt,
              dueDate: null,
              accessRequestId: request.id,
              requesterId: request.requesterId,
              requesterName: requester?.name || 'Unknown User',
              reason: request.requestReason,
            });
          }
        }
      }

      res.json(tasks);
    } catch (err) {
      console.error('Error fetching my tasks:', err);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Complete a task from my-tasks (transitions document workflow)
  app.post('/api/my-tasks/:documentId/complete', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.documentId);
      const userId = getCurrentUserId(req);
      const { taskType, comments, approverId } = req.body;

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (taskType === 'review') {
        if (doc.reviewerId !== userId) {
          return res.status(403).json({ message: 'You are not the assigned reviewer' });
        }
        if (doc.status !== DocumentStatus.IN_REVIEW) {
          return res.status(400).json({ message: 'Document is not in review status' });
        }

        // Move to pending approval and optionally set new approver
        const updateData: any = {
          status: DocumentStatus.PENDING_APPROVAL,
        };
        
        // If a new approver is selected, update the approver
        const finalApproverId = approverId || doc.approverId;
        if (approverId) {
          updateData.approverId = approverId;
        }

        const updated = await storage.updateDocument(documentId, updateData);

        // Notify approver if set
        if (finalApproverId) {
          await storage.createNotification({
            userId: finalApproverId,
            title: 'Document Requires Approval',
            message: `Document "${doc.title}" (${doc.documentCode}) has been reviewed and requires your approval.`,
            urgencyLevel: 'high',
          });
        }

        await storage.createAuditLog({
          userId,
          action: AuditAction.COMPLETE_TASK,
          entityType: 'document',
          entityId: documentId,
          previousValue: JSON.stringify({ status: doc.status }),
          newValue: JSON.stringify({ status: updated.status, taskType: 'review', comments }),
        });

        res.json(updated);
      } else if (taskType === 'approve') {
        if (doc.approverId !== userId) {
          return res.status(403).json({ message: 'You are not the assigned approver' });
        }
        if (doc.status !== DocumentStatus.PENDING_APPROVAL) {
          return res.status(400).json({ message: 'Document is not pending approval' });
        }

        // Approve the document
        const updated = await storage.updateDocument(documentId, {
          status: DocumentStatus.APPROVED,
        });

        await storage.createAuditLog({
          userId,
          action: AuditAction.APPROVE,
          entityType: 'document',
          entityId: documentId,
          previousValue: JSON.stringify({ status: doc.status }),
          newValue: JSON.stringify({ status: updated.status, comments }),
        });

        res.json(updated);
      } else {
        return res.status(400).json({ message: 'Invalid task type' });
      }
    } catch (err) {
      console.error('Error completing task:', err);
      res.status(500).json({ message: 'Failed to complete task' });
    }
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

      // Auto-link employee with user by email
      const matchingUser = await storage.getUserByEmail(input.email);
      const linkedUserId = matchingUser ? matchingUser.id : null;

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
        createdByUserId: getCurrentUserId(req),
        workflowStatus: 'draft',
        userId: linkedUserId,
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

      // Auto-link employee with user by email when email changes
      let updateData: any = { ...input };
      if (input.email) {
        const matchingUser = await storage.getUserByEmail(input.email);
        updateData.userId = matchingUser ? matchingUser.id : null;
      }

      const employee = await storage.updateEmployee(id, updateData);

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
  // EMPLOYEE WORKFLOW ROUTES
  // ============================================
  app.post(api.employees.submitForReview.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
      }

      const input = api.employees.submitForReview.input.parse(req.body);
      
      const existing = await storage.getEmployee(id);
      if (!existing) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      if (existing.workflowStatus !== 'draft' && existing.workflowStatus !== 'rejected') {
        return res.status(400).json({ message: 'Employee can only be submitted for review from Draft or Rejected status' });
      }

      const reviewer = await storage.getUser(input.reviewerId);
      if (!reviewer) {
        return res.status(400).json({ message: 'Reviewer not found', field: 'reviewerId' });
      }

      const employee = await storage.submitEmployeeForReview(id, input.reviewerId, input.notes);

      // Create notification for reviewer
      await storage.createNotification({
        userId: input.reviewerId,
        title: 'Employee Record Review Required',
        message: `Employee record for "${employee.name}" (${employee.employeeNumber}) requires your review.`,
        urgencyLevel: 'medium',
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.SUBMIT_FOR_REVIEW,
        entityType: 'employee',
        entityId: id,
        previousValue: JSON.stringify({ workflowStatus: existing.workflowStatus }),
        newValue: JSON.stringify({ workflowStatus: 'in_review', reviewerId: input.reviewerId }),
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

  app.post(api.employees.submitForApproval.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
      }

      const input = api.employees.submitForApproval.input.parse(req.body);
      
      const existing = await storage.getEmployee(id);
      if (!existing) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      if (existing.workflowStatus !== 'in_review') {
        return res.status(400).json({ message: 'Employee can only be submitted for approval from In-Review status' });
      }

      const approver = await storage.getUser(input.approverId);
      if (!approver) {
        return res.status(400).json({ message: 'Approver not found', field: 'approverId' });
      }

      const employee = await storage.submitEmployeeForApproval(id, input.approverId, input.notes);

      // Create notification for approver
      await storage.createNotification({
        userId: input.approverId,
        title: 'Employee Record Approval Required',
        message: `Employee record for "${employee.name}" (${employee.employeeNumber}) requires your approval.`,
        urgencyLevel: 'medium',
      });

      // Audit log
      await storage.createAuditLog({
        userId: getCurrentUserId(req),
        action: AuditAction.APPROVE,
        entityType: 'employee',
        entityId: id,
        previousValue: JSON.stringify({ workflowStatus: existing.workflowStatus }),
        newValue: JSON.stringify({ workflowStatus: 'pending_approval', approverId: input.approverId }),
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

  app.post(api.employees.approve.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
      }

      const input = api.employees.approve.input.parse(req.body);
      
      const existing = await storage.getEmployee(id);
      if (!existing) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      if (existing.workflowStatus !== 'pending_approval') {
        return res.status(400).json({ message: 'Employee can only be approved from Pending Approval status' });
      }

      const currentUserId = getCurrentUserId(req);
      const employee = await storage.approveEmployee(id, currentUserId, input.notes);

      // Create notification for creator
      if (existing.createdByUserId) {
        await storage.createNotification({
          userId: existing.createdByUserId,
          title: 'Employee Record Approved',
          message: `Employee record for "${employee.name}" (${employee.employeeNumber}) has been approved.`,
          urgencyLevel: 'low',
        });
      }

      // Audit log
      await storage.createAuditLog({
        userId: currentUserId,
        action: AuditAction.APPROVE,
        entityType: 'employee',
        entityId: id,
        previousValue: JSON.stringify({ workflowStatus: existing.workflowStatus }),
        newValue: JSON.stringify({ workflowStatus: 'approved' }),
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

  app.post(api.employees.reject.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
      }

      const input = api.employees.reject.input.parse(req.body);
      
      const existing = await storage.getEmployee(id);
      if (!existing) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      if (existing.workflowStatus !== 'in_review' && existing.workflowStatus !== 'pending_approval') {
        return res.status(400).json({ message: 'Employee can only be rejected from In-Review or Pending Approval status' });
      }

      const currentUserId = getCurrentUserId(req);
      const employee = await storage.rejectEmployee(id, currentUserId, input.notes);

      // Create notification for creator
      if (existing.createdByUserId) {
        await storage.createNotification({
          userId: existing.createdByUserId,
          title: 'Employee Record Rejected',
          message: `Employee record for "${employee.name}" (${employee.employeeNumber}) has been rejected. ${input.notes || ''}`,
          urgencyLevel: 'high',
        });
      }

      // Audit log
      await storage.createAuditLog({
        userId: currentUserId,
        action: AuditAction.REJECT,
        entityType: 'employee',
        entityId: id,
        previousValue: JSON.stringify({ workflowStatus: existing.workflowStatus }),
        newValue: JSON.stringify({ workflowStatus: 'rejected', notes: input.notes }),
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

      const companyLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAMAAABlApw1AAAAYFBMVEUAAAD///+qqqqampra2tpDQ0Pj4+Pd3d34+PhPT0/x8fFISEi/v79YWFgQEBCWlpY2NjYjIyPp6emAgICNjY1hYWEaGhotLS2hoaEoKCh1dXW1tbXFxcVqamrLy8vS0tIYlW4WAAAI+UlEQVR4nO2ciZKzKhCFaRdEXKK4a4zv/5a30SxmMyYBJ39dvpqaGMelj8CxQRxCDAaDwWAwGAwGg8FgMBgMBsNPk+ysD+j8xYMG3aN9Ii0CfA8+IEwW43ce7pT9joB9vHRI93H8PyQgXDxi9OyIPyPgRfxPrv/vCNh/GP+vCAjLpcO5C4f7DQFhunS0J/7zQwKW689i/JoEuMM78X/oPxOtFgGkeKMIPvUfCcv1xI8K6Nr4l+uP/0fx45UTK6//ov8EyyWppwEc8fmq+D/3H83xo4IVZfCN/+iOHxW8bAdf+Y/2+F970cf5A8J2+uN/5UXL1//FzZDVi61HFUvt4Cv/kQoW+w/KFDz1oq/8Z6TeQsDTMviq/myqIHrYDr7yn4uCTWrRIy/6xn+uFGzSku+9aPn6v2y/F1jdbKHgtiV/334vaEqnFxW88M+34uf9JgKuvEiF/5wQ2xQAmXvRN/2Xv4v/4kWq/EfCN4z/VAbK/Gfz+DE6rtZ/to4f2yf7bPz2V+JHFuNfmz/8YfyLvNd+AbpNsoj1vBv/q/a0NUvjt89YduRtec9/Thz+Ouwz7/nP75XB4z7PqjLQ1KMpF/PNu/g/vP6SsNIiINgtPjG9Znn89hW6HnAs5/xz3st/NhPwImubxf/V9df5iGmdQ3wbv85nZOEKh3gv/9lYAIQvRwy+8Z8NBLz0uM/mhGwo4Nvx278XsOhFX7ffLQQsKPju/rWZgKe16Hv/0SpgdnUft2QF/qNTwNVUg+6Bm6rwH50Ckv38HPd3NDXtd0RP377srk5y25IVxs80De7W16e5zovU1R8AujxV82Mydn2euRep8p/pwJoecNxd5O7sRcr8Z0Tbc7797ZlOXqQkfzijb3xux27PNbVkhe1XMujpEiPV/ePhvfr4wdIVPyHd/dlCpf4jEa4+AeVdHcIyeGsu4ArWdrw/wlIc7APYG4M371OumnL2FZrnSmS64xdvjf+9T3N3L1CM9mfcxcqZlx+ywVSV/IETKWPQaKFnNDqRKDaIn1Sqjf8M22DSpSTR5aWbTLocFeiJv9sqfvl4/t+On5BefS3S1Q17QqtawfIbfxro1daibuv4sRujUoH1FzMMEnVJxWb+eY2qxI792SSb1FJRjbxN8ocnZN9Xo1DTMNxKim9HJPJt7f8e98FIxXq2mqO7yBf3tM3vXo+pDp+1ZbpR9ryC/IO5QexHLv+E371bCI7GNyY/IW7fsiNWB38d8R1Vvj7+wd/kPZm3CdeF/xPe+Rj/8NpShf3XUS7S7pdbs2f9kvc8JAufS6D13yY+62j6J21B5P9C+JI0eJAgiUzboy8t1Hxek9jh93z/Je2BThq4s82reepx7b0nhu53bX8FUf/ztmkwGAyG/xFReLmtdndjynGZ3kwUaLup7xh1LX4Jt3gK/JAySosxl8xmczHAu9mqqMN9l8//0WOSd1PvN5OzmGr4s2HciLZ8HAZpATuE6TQcDs7NVp0ThgegsyitIZ+evWfsbwUkebDzA8ufBNh8LIY7AWnWNmkGw2VNn0VZWe9uBAR2152l5LuGRHVozfs6hRWQXWepzsBbyCYBBZO/7wUMnDkRcfhUicrMSjG8inBxI2APHNhJgaAuCXHFMFNgQ+EBA64qD2wO4zS87CSAVExOargVYIGVQUes44SBZg9J6lGfMH5bAg1pWVeeBAQkSeMdzEbqbOAHubmq8Qt3mkd4LgGsGnLNrYABUtcbSvsoIEUBpef5hKOAltXXbSAU1UnA2EgKZl3GunajPxRc1ew5F/aB6yb5UUDiugU/JOhClTsj6WDXUyewWJ7I7/4BoojzrGG8SnJmJYl1FhDlHuTjXpUQhfwshulzPFINGf7OuKr3WpsBqOM4AksZbTTuPMeT87MBBmcOBaDAHA5i/OoxwFWOcADkvnzAvxwF1EJ0DoxbDQDeuMDHczjHZTEeT9mrxW5uj/hoIFGcycWsIvbOvma3O/6cv9ptkE0r5K+dPbVKG9Bz/OmYeZ4ft58f7bj8c/8i4Ihgl+Xab/+9LrOAIK4mEypZJzadpaKEjAPwY3MISPpvjXeNFLXd/tS/XzAY3iFOj9VXfqarBj3jRnpOmjSkeTwz+slqZQRFX5wzw+hk45y7gYD5dm5RFI/+cX0LmOj0DPb9PNe+EN31jdTSYiJweS/Ep3xa8A6BS+cCxiet4nrfJEPlGbVL1JsHGb0z/R0qbqnWlx7kqYtc3i8Tv5ICBOZz+C2KiEsZSU5lUzC2a3OZFaeyK1JWJHUxeULDHPuj4OBO41Bv6Urrb3y57EJdYulU59W4WxyMiamrbFgYxFgvCocKz5YC9lRe0iFMXCpCSndTDT4cZ46VNW4XkdazHKfAvEyUBc0x2WaiTRy81LkjvNwNqaBW2lLgtHWH/biaWiWxnNqjToJnE0JVNmoBl6H1hzwDUfkU9rgmIkyggOMykp6qUw5dhJ2YHKvToUJVrWwDpACaJQFW9gz7c3UbhDbWuAw7DV2f+EBxNS0OmKxjd612II+paHtlU+lqACZ7fFXp8UhWobKDnjCayCoUd1OWfGrQMfei+ABNLvtYsSXfaBgbMTgNCbAT1ME0uNIkOyyyWm7lM4qrsUbCIQ1xhxy3pyxXeLN2QwASDZwyKYCT9CwA5PIooKQwemoMjFLqlbL/cy0gkQLSA5MCqo5RjsFbJwGhFMCdJIRWCpAvWnBV03FkFfegCfFcznMBWPjSYuKY076pEjIKKMde2FwARio3r3HjbC5AHnEqgUkASXMBim4PXWdbjOGZ654fBYRXAqaM3uUQ1laIsYVZbpNTCXRWMhPgYYfXyeseNyr2WIVsGOxobAMwtB3UeBkmAXXee6oEyEfvXkF6AQPlUYBtYAyaT23gXAIkkvNI91g7MFu2yNgGsDeP7b6/CBhIgy2K58kB6B63aPDvvdSV2oyxuiKnEsCTMlVvZJVVksgG1SRVU8VxVcm0ICb4eV6+bIgXLU7kRykXcYsEN5O74ycuNNOqEvdKxi3wS3xeHU9HK3F7/Ps/2FEwGAwGg8FgMBgMBoPBYDAYDAbDKv4DRtuGaiLoaoAAAAAASUVORK5CYII=';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; margin: 0; padding: 0; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .logo-container { display: flex; align-items: center; gap: 12px; }
            .logo-img { height: 50px; width: auto; }
            .company-name { font-weight: bold; font-size: 16px; }
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
            <div class="logo-container">
              <img src="${companyLogoBase64}" alt="Sahih Certifications" class="logo-img" />
              <div class="company-name">SAHIH CERTIFICATIONS</div>
            </div>
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

  // ============================================
  // DOCUMENT ACCESS REQUESTS
  // ============================================
  app.get(api.documentAccessRequests.list.path, async (req, res) => {
    const documentId = req.query.documentId ? Number(req.query.documentId) : undefined;
    const requesterId = req.query.requesterId ? Number(req.query.requesterId) : undefined;
    const status = req.query.status as string | undefined;
    
    const requests = await storage.getDocumentAccessRequests({ documentId, requesterId, status });
    res.json(requests);
  });

  app.get(api.documentAccessRequests.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await storage.getDocumentAccessRequest(id);
    if (!request) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    res.json(request);
  });

  app.post(api.documentAccessRequests.create.path, async (req, res) => {
    try {
      const input = api.documentAccessRequests.create.input.parse(req.body);
      const userId = getCurrentUserId(req);
      
      // Check if document exists
      const document = await storage.getDocument(input.documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Check if user already has access
      const hasAccess = await storage.hasDocumentAccess(input.documentId, userId);
      if (hasAccess) {
        return res.status(400).json({ message: 'You already have access to this document', field: 'documentId' });
      }
      
      // Check if there's already a pending request
      const existingRequests = await storage.getDocumentAccessRequests({
        documentId: input.documentId,
        requesterId: userId,
        status: DocumentAccessRequestStatus.PENDING,
      });
      if (existingRequests.length > 0) {
        return res.status(400).json({ message: 'You already have a pending access request for this document', field: 'documentId' });
      }
      
      const request = await storage.createDocumentAccessRequest({
        documentId: input.documentId,
        requesterId: userId,
        requestReason: input.requestReason || null,
        status: DocumentAccessRequestStatus.PENDING,
      });
      
      // Create notification for admins and quality managers
      const allUsers = await storage.getUsers();
      const adminsAndQMs = allUsers.filter(u => 
        u.role === UserRole.ADMIN || u.role === UserRole.QUALITY_MANAGER
      );
      
      for (const admin of adminsAndQMs) {
        await storage.createNotification({
          userId: admin.id,
          title: 'Document Access Request',
          message: `A user has requested access to document "${document.documentCode} - ${document.title}"`,
          urgencyLevel: UrgencyLevel.MEDIUM,
          relatedDocumentId: input.documentId,
        });
      }
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: AuditAction.CREATE,
        entityType: 'document_access_request',
        entityId: request.id,
        newValue: JSON.stringify(input),
      });
      
      res.status(201).json(request);
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

  app.post(api.documentAccessRequests.approve.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }
      
      const input = api.documentAccessRequests.approve.input.parse(req.body);
      const userId = getCurrentUserId(req);
      const currentUser = await storage.getUser(userId);
      
      // Only admin and quality manager can approve
      if (currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.QUALITY_MANAGER) {
        return res.status(403).json({ message: 'Only Admin or Quality Manager can approve access requests' });
      }
      
      const request = await storage.getDocumentAccessRequest(id);
      if (!request) {
        return res.status(404).json({ message: 'Access request not found' });
      }
      
      if (request.status !== DocumentAccessRequestStatus.PENDING) {
        return res.status(400).json({ message: 'This request has already been processed' });
      }
      
      // Update request status
      const updatedRequest = await storage.updateDocumentAccessRequest(id, {
        status: DocumentAccessRequestStatus.APPROVED,
        decidedById: userId,
        decidedAt: new Date(),
        decisionNote: input.decisionNote || null,
      });
      
      // Grant document access
      await storage.grantDocumentAccess({
        documentId: request.documentId,
        userId: request.requesterId,
        grantedById: userId,
      });
      
      // Notify the requester
      const document = await storage.getDocument(request.documentId);
      await storage.createNotification({
        userId: request.requesterId,
        title: 'Access Request Approved',
        message: `Your request to access document "${document?.documentCode} - ${document?.title}" has been approved`,
        urgencyLevel: UrgencyLevel.LOW,
        relatedDocumentId: request.documentId,
      });
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: AuditAction.APPROVE,
        entityType: 'document_access_request',
        entityId: id,
        newValue: JSON.stringify({ status: 'approved' }),
      });
      
      res.json(updatedRequest);
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

  app.post(api.documentAccessRequests.reject.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }
      
      const input = api.documentAccessRequests.reject.input.parse(req.body);
      const userId = getCurrentUserId(req);
      const currentUser = await storage.getUser(userId);
      
      // Only admin and quality manager can reject
      if (currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.QUALITY_MANAGER) {
        return res.status(403).json({ message: 'Only Admin or Quality Manager can reject access requests' });
      }
      
      const request = await storage.getDocumentAccessRequest(id);
      if (!request) {
        return res.status(404).json({ message: 'Access request not found' });
      }
      
      if (request.status !== DocumentAccessRequestStatus.PENDING) {
        return res.status(400).json({ message: 'This request has already been processed' });
      }
      
      // Update request status
      const updatedRequest = await storage.updateDocumentAccessRequest(id, {
        status: DocumentAccessRequestStatus.REJECTED,
        decidedById: userId,
        decidedAt: new Date(),
        decisionNote: input.decisionNote || null,
      });
      
      // Notify the requester
      const document = await storage.getDocument(request.documentId);
      await storage.createNotification({
        userId: request.requesterId,
        title: 'Access Request Rejected',
        message: `Your request to access document "${document?.documentCode} - ${document?.title}" has been rejected${input.decisionNote ? `: ${input.decisionNote}` : ''}`,
        urgencyLevel: UrgencyLevel.MEDIUM,
        relatedDocumentId: request.documentId,
      });
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: AuditAction.REJECT,
        entityType: 'document_access_request',
        entityId: id,
        newValue: JSON.stringify({ status: 'rejected', note: input.decisionNote }),
      });
      
      res.json(updatedRequest);
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
  // DOCUMENT ACCESS
  // ============================================
  app.get(api.documentAccess.list.path, async (req, res) => {
    const documentId = req.query.documentId ? Number(req.query.documentId) : undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    
    const accessList = await storage.getDocumentAccess({ documentId, userId });
    res.json(accessList);
  });

  app.get(api.documentAccess.check.path, async (req, res) => {
    const documentId = Number(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }
    
    const userId = getCurrentUserId(req);
    const currentUser = await storage.getUser(userId);
    
    // Admins and Quality Managers always have access
    if (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.QUALITY_MANAGER) {
      return res.json({ hasAccess: true });
    }
    
    // Check document status - only approved documents need access control
    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Documents not yet approved are accessible based on workflow roles
    if (document.status !== DocumentStatus.APPROVED) {
      // Creator, reviewer, approver have access
      if (document.createdById === userId || document.reviewerId === userId || document.approverId === userId) {
        return res.json({ hasAccess: true });
      }
    }
    
    // For approved documents, check explicit access grant
    const hasAccess = await storage.hasDocumentAccess(documentId, userId);
    res.json({ hasAccess });
  });

  app.post(api.documentAccess.grant.path, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }
      
      const input = api.documentAccess.grant.input.parse(req.body);
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Only admin and quality manager can grant access
      if (currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.QUALITY_MANAGER) {
        return res.status(403).json({ message: 'Only Admin or Quality Manager can grant document access' });
      }
      
      const access = await storage.grantDocumentAccess({
        documentId,
        userId: input.userId,
        grantedById: currentUserId,
      });
      
      // Notify the user
      const document = await storage.getDocument(documentId);
      await storage.createNotification({
        userId: input.userId,
        title: 'Document Access Granted',
        message: `You have been granted access to document "${document?.documentCode} - ${document?.title}"`,
        urgencyLevel: UrgencyLevel.LOW,
        relatedDocumentId: documentId,
      });
      
      // Audit log
      await storage.createAuditLog({
        userId: currentUserId,
        action: AuditAction.CREATE,
        entityType: 'document_access',
        entityId: access.id,
        newValue: JSON.stringify({ documentId, userId: input.userId }),
      });
      
      res.status(201).json(access);
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

  app.post(api.documentAccess.revoke.path, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }
      
      const input = api.documentAccess.revoke.input.parse(req.body);
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Only admin and quality manager can revoke access
      if (currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.QUALITY_MANAGER) {
        return res.status(403).json({ message: 'Only Admin or Quality Manager can revoke document access' });
      }
      
      const revoked = await storage.revokeDocumentAccess(documentId, input.userId, currentUserId);
      if (!revoked) {
        return res.status(404).json({ message: 'No active access found for this user and document' });
      }
      
      // Notify the user
      const document = await storage.getDocument(documentId);
      await storage.createNotification({
        userId: input.userId,
        title: 'Document Access Revoked',
        message: `Your access to document "${document?.documentCode} - ${document?.title}" has been revoked`,
        urgencyLevel: UrgencyLevel.MEDIUM,
        relatedDocumentId: documentId,
      });
      
      // Audit log
      await storage.createAuditLog({
        userId: currentUserId,
        action: AuditAction.DELETE,
        entityType: 'document_access',
        entityId: revoked.id,
        newValue: JSON.stringify({ documentId, userId: input.userId, revoked: true }),
      });
      
      res.json(revoked);
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
