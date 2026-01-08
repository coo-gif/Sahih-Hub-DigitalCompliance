import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { 
  DocumentStatus, 
  AuditAction,
  UrgencyLevel,
  UserRole,
  InductionStatus,
} from "@shared/schema";
import { z } from "zod";

// Simple user context for demo (in production, use JWT auth)
const DEMO_USER_ID = 1;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
        userId: DEMO_USER_ID,
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
        userId: DEMO_USER_ID,
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
      userId: DEMO_USER_ID,
      action: AuditAction.DELETE,
      entityType: 'user',
      entityId: id,
      previousValue: JSON.stringify(existing),
    });

    res.status(204).send();
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
        createdById: DEMO_USER_ID,
        nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
      });

      // Audit log
      await storage.createAuditLog({
        userId: DEMO_USER_ID,
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
        actionById: DEMO_USER_ID,
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

      const updateData: any = { ...input };
      if (input.nextReviewDate) {
        updateData.nextReviewDate = new Date(input.nextReviewDate);
      }

      const doc = await storage.updateDocument(id, updateData);

      // Audit log
      await storage.createAuditLog({
        userId: DEMO_USER_ID,
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
      userId: DEMO_USER_ID,
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
        actionById: DEMO_USER_ID,
        comments: input.comments || 'Submitted for review',
      });

      // Audit log
      await storage.createAuditLog({
        userId: DEMO_USER_ID,
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
        updateData.approverId = DEMO_USER_ID;
        updateData.approvedAt = new Date();
        
        // Increment version if republishing
        const versionParts = doc.versionNumber.split('.');
        const major = parseInt(versionParts[0]);
        updateData.versionNumber = `${major + 1}.0`;

        // Archive old version
        await storage.createDocumentVersion({
          documentId: id,
          versionNumber: doc.versionNumber,
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
        actionById: DEMO_USER_ID,
        comments: input.comments || 'Approved',
      });

      // Audit log
      await storage.createAuditLog({
        userId: DEMO_USER_ID,
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
        actionById: DEMO_USER_ID,
        comments: input.comments,
      });

      // Audit log
      await storage.createAuditLog({
        userId: DEMO_USER_ID,
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
    const count = await storage.markAllNotificationsRead(DEMO_USER_ID);
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
        userId: DEMO_USER_ID,
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
        userId: DEMO_USER_ID,
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
      userId: DEMO_USER_ID,
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
        assignedByUserId: DEMO_USER_ID,
        status: 'pending',
      });

      // Audit log
      await storage.createAuditLog({
        userId: DEMO_USER_ID,
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
        userId: DEMO_USER_ID,
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
      userId: DEMO_USER_ID,
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
      userId: DEMO_USER_ID,
      action: AuditAction.COMPLETE_TASK,
      entityType: 'employee_task',
      entityId: id,
      previousValue: JSON.stringify({ status: existing.status }),
      newValue: JSON.stringify({ status: 'completed' }),
    });

    res.json(task);
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

  const existingDocs = await storage.getDocuments();
  if (existingDocs.length === 0) {
    const now = new Date();

    // Create sample documents
    await storage.createDocument({
      documentCode: "POL-001",
      title: "Quality Policy",
      description: "Organization's commitment to quality and continuous improvement",
      category: "policy",
      content: "Sahih Certifications is committed to providing impartial, competent certification services...",
      versionNumber: "2.0",
      status: DocumentStatus.APPROVED,
      createdById: 1,
      approverId: 2,
      approvedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      nextReviewDate: new Date(now.getTime() + 275 * 24 * 60 * 60 * 1000), // 9 months away
    });

    await storage.createDocument({
      documentCode: "SOP-001",
      title: "Document Control Procedure",
      description: "Standard operating procedure for managing controlled documents",
      category: "sop",
      content: "This procedure defines the process for creating, reviewing, approving, and archiving documents...",
      versionNumber: "1.0",
      status: DocumentStatus.APPROVED,
      createdById: 1,
      approverId: 2,
      approvedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      nextReviewDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000), // 25 days - yellow alert
    });

    await storage.createDocument({
      documentCode: "SOP-002",
      title: "Internal Audit Procedure",
      description: "Procedure for conducting internal audits",
      category: "sop",
      content: "This procedure outlines the methodology for planning and conducting internal audits...",
      versionNumber: "1.0",
      status: DocumentStatus.APPROVED,
      createdById: 3,
      approverId: 2,
      approvedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      nextReviewDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue - red alert
    });

    await storage.createDocument({
      documentCode: "MAN-001",
      title: "Quality Manual",
      description: "Comprehensive quality management system manual",
      category: "manual",
      content: "This manual describes the Quality Management System of Sahih Certifications...",
      versionNumber: "3.0",
      status: DocumentStatus.IN_REVIEW,
      createdById: 1,
      reviewerId: 3,
      nextReviewDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    });

    await storage.createDocument({
      documentCode: "FRM-001",
      title: "Audit Checklist Template",
      description: "Standard format for conducting audits",
      category: "format",
      content: "",
      versionNumber: "1.0",
      status: DocumentStatus.DRAFT,
      createdById: 4,
      nextReviewDate: null,
    });

    await storage.createDocument({
      documentCode: "SOP-003",
      title: "Corrective Action Procedure",
      description: "Process for handling non-conformances and corrective actions",
      category: "sop",
      versionNumber: "1.0",
      status: DocumentStatus.PENDING_APPROVAL,
      createdById: 3,
      reviewerId: 3,
      nextReviewDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    });
  }
}
