import { db } from "./db";
import {
  users, documents, documentVersions, workflowLogs, notifications, auditLogs,
  employees, employeeTasks, downloadRequests, documentFeedback, documentTasks, taskPokes,
  documentAccessRequests, documentAccess, userRecords, buddyStatus, pushSubscriptions, buddyDialogues,
  userActivityLogs, monthlyPerformanceReports, bugReports,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type DocumentVersion, type InsertDocumentVersion,
  type WorkflowLog, type InsertWorkflowLog,
  type Notification, type InsertNotification,
  type AuditLog, type InsertAuditLog,
  type Employee, type InsertEmployee,
  type EmployeeTask, type InsertEmployeeTask,
  type DownloadRequest, type InsertDownloadRequest,
  type DocumentFeedback, type InsertDocumentFeedback,
  type DocumentTask, type InsertDocumentTask,
  type TaskPoke, type InsertTaskPoke,
  type DocumentAccessRequest, type InsertDocumentAccessRequest,
  type DocumentAccess, type InsertDocumentAccess,
  type UserRecord, type InsertUserRecord,
  type BuddyStatus, type InsertBuddyStatus,
  type PushSubscription, type InsertPushSubscription,
  type BuddyDialogue, type InsertBuddyDialogue,
  type UserActivityLog, type InsertUserActivityLog,
  type MonthlyPerformanceReport, type InsertMonthlyPerformanceReport,
  type BugReport, type InsertBugReport,
  DocumentStatus, InductionStatus, TaskStatus, FeedbackStatus, DocumentTaskStatus,
  EmployeeRecordStatus, DocumentAccessRequestStatus, BuddyState, MonthlyReportStatus,
  BugReportStatus,
} from "@shared/schema";
import { eq, desc, and, lt, gt, or, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface IStorage {
  // Users
  getUsers(): Promise<Omit<User, 'passwordHash'>[]>;
  getUser(id: number): Promise<Omit<User, 'passwordHash'> | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<Omit<User, 'passwordHash'>>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<Omit<User, 'passwordHash'>>;
  deleteUser(id: number): Promise<void>;
  updateUserActivity(userId: number): Promise<void>;
  getActiveUsers(): Promise<Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    lastActivity: Date | null;
    isOnline: boolean;
  }>>;

  // Documents
  getDocuments(filters?: { status?: string; category?: string }): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, doc: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  // Document Versions
  createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion>;
  getDocumentVersions(documentId: number): Promise<DocumentVersion[]>;

  // Workflow Logs
  createWorkflowLog(log: InsertWorkflowLog): Promise<WorkflowLog>;
  getWorkflowLogs(documentId: number): Promise<WorkflowLog[]>;

  // Notifications
  getNotifications(userId?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<Notification>;
  markAllNotificationsRead(userId: number): Promise<number>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<(AuditLog & { userName?: string })[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Dashboard
  getDashboardStats(): Promise<{
    totalDocuments: number;
    approvedDocuments: number;
    pendingApprovals: number;
    expiringDocuments: number;
    nonCompliantDocuments: number;
    totalUsers: number;
    pendingInductions: number;
  }>;
  getComplianceAlerts(): Promise<Array<{
    id: number;
    documentCode: string;
    title: string;
    nextReviewDate: Date | null;
    daysUntilExpiry: number;
    alertLevel: 'yellow' | 'red';
  }>>;

  // Employees
  getEmployees(filters?: { status?: string; department?: string; workflowStatus?: string }): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByNumber(employeeNumber: string): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;
  
  // Employee Workflow
  submitEmployeeForReview(id: number, reviewerId: number, notes?: string): Promise<Employee>;
  submitEmployeeForApproval(id: number, approverId: number, notes?: string): Promise<Employee>;
  approveEmployee(id: number, approverId: number, notes?: string): Promise<Employee>;
  rejectEmployee(id: number, rejectedById: number, notes?: string): Promise<Employee>;

  // Employee Tasks
  getEmployeeTasks(filters?: { employeeId?: number; status?: string; documentId?: number }): Promise<EmployeeTask[]>;
  getEmployeeTask(id: number): Promise<EmployeeTask | undefined>;
  createEmployeeTask(task: InsertEmployeeTask): Promise<EmployeeTask>;
  updateEmployeeTask(id: number, task: Partial<InsertEmployeeTask>): Promise<EmployeeTask>;
  deleteEmployeeTask(id: number): Promise<void>;
  completeEmployeeTask(id: number): Promise<EmployeeTask>;

  // Download Requests
  getDownloadRequests(filters?: { documentId?: number; requesterId?: number; status?: string }): Promise<DownloadRequest[]>;
  getDownloadRequest(id: number): Promise<DownloadRequest | undefined>;
  createDownloadRequest(request: InsertDownloadRequest): Promise<DownloadRequest>;
  updateDownloadRequest(id: number, request: Partial<DownloadRequest>): Promise<DownloadRequest>;

  // My Tasks (pending document workflow tasks for a user)
  getMyTasks(userId: number): Promise<Array<{
    id: number;
    documentId: number;
    documentCode: string;
    title: string;
    taskType: 'prepare' | 'review' | 'approve';
    status: string;
    createdAt: Date | null;
    dueDate: Date | null;
  }>>;

  // Document Feedback
  getDocumentFeedback(documentId: number): Promise<DocumentFeedback[]>;
  createDocumentFeedback(feedback: InsertDocumentFeedback): Promise<DocumentFeedback>;
  updateDocumentFeedback(id: number, updates: Partial<InsertDocumentFeedback>): Promise<DocumentFeedback>;
  markFeedbackAddressed(id: number): Promise<DocumentFeedback>;

  // Document Tasks (Sequential Workflow)
  getDocumentTasks(filters?: { documentId?: number; assignedToId?: number; status?: string; isVisible?: boolean }): Promise<DocumentTask[]>;
  getDocumentTask(id: number): Promise<DocumentTask | undefined>;
  createDocumentTask(task: InsertDocumentTask): Promise<DocumentTask>;
  updateDocumentTask(id: number, updates: Partial<DocumentTask>): Promise<DocumentTask>;
  completeDocumentTask(id: number): Promise<DocumentTask>;
  generateTaskNumber(): Promise<string>;

  // Task Pokes (Buzz/Reminder)
  getTaskPokes(documentTaskId: number): Promise<TaskPoke[]>;
  createTaskPoke(poke: InsertTaskPoke): Promise<TaskPoke>;

  // User Performance Stats (for COO/CEO/Admin)
  getUserPerformanceStats(userId: number): Promise<{
    totalTasks: number;
    completedTasks: number;
    onTimeTasks: number;
    earlyTasks: number;
    delayedTasks: number;
    totalPoints: number;
    averageCompletionHours: number;
  }>;

  // Document Access Requests
  getDocumentAccessRequests(filters?: { documentId?: number; requesterId?: number; status?: string }): Promise<DocumentAccessRequest[]>;
  getDocumentAccessRequest(id: number): Promise<DocumentAccessRequest | undefined>;
  createDocumentAccessRequest(request: InsertDocumentAccessRequest): Promise<DocumentAccessRequest>;
  updateDocumentAccessRequest(id: number, updates: Partial<DocumentAccessRequest>): Promise<DocumentAccessRequest>;

  // Document Access (granted permissions)
  getDocumentAccess(filters?: { documentId?: number; userId?: number }): Promise<DocumentAccess[]>;
  hasDocumentAccess(documentId: number, userId: number): Promise<boolean>;
  grantDocumentAccess(access: InsertDocumentAccess): Promise<DocumentAccess>;
  revokeDocumentAccess(documentId: number, userId: number, revokedById: number): Promise<DocumentAccess | undefined>;

  // User Records (Completion Reports)
  getUserRecords(userId: number): Promise<UserRecord[]>;
  getUserRecord(id: number): Promise<UserRecord | undefined>;
  createUserRecord(record: InsertUserRecord): Promise<UserRecord>;
  generateReportNumber(reportType: string): Promise<string>;

  // Buddy Status System
  getBuddyStatus(userId: number): Promise<BuddyStatus | undefined>;
  getOrCreateBuddyStatus(userId: number): Promise<BuddyStatus>;
  updateBuddyStatus(userId: number, updates: Partial<InsertBuddyStatus>): Promise<BuddyStatus>;
  calculateUserCompliance(userId: number): Promise<{ score: number; state: string }>;

  // Push Subscriptions
  getPushSubscriptions(userId: number): Promise<PushSubscription[]>;
  savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  removePushSubscription(userId: number, endpoint: string): Promise<void>;

  // Buddy Dialogues
  getBuddyDialogues(userId: number, unacknowledgedOnly?: boolean): Promise<BuddyDialogue[]>;
  createBuddyDialogue(dialogue: InsertBuddyDialogue): Promise<BuddyDialogue>;
  acknowledgeBuddyDialogue(id: number): Promise<BuddyDialogue>;

  // User Activity Logs
  startUserSession(userId: number): Promise<UserActivityLog>;
  updateUserHeartbeat(userId: number): Promise<void>;
  endUserSession(userId: number): Promise<void>;
  getUserActivityLogs(userId: number, month: number, year: number): Promise<UserActivityLog[]>;

  // Monthly Performance Reports
  getMonthlyPerformanceReports(filters?: { userId?: number; month?: number; year?: number; status?: string }): Promise<MonthlyPerformanceReport[]>;
  getMonthlyPerformanceReport(id: number): Promise<MonthlyPerformanceReport | undefined>;
  createMonthlyPerformanceReport(report: InsertMonthlyPerformanceReport): Promise<MonthlyPerformanceReport>;
  updateMonthlyPerformanceReport(id: number, report: Partial<InsertMonthlyPerformanceReport>): Promise<MonthlyPerformanceReport>;
  generateMonthlyReport(userId: number, month: number, year: number): Promise<MonthlyPerformanceReport>;
  submitReportForReview(id: number): Promise<MonthlyPerformanceReport>;
  reviewReport(id: number, reviewerId: number, comments?: string): Promise<MonthlyPerformanceReport>;
  approveReport(id: number, approverId: number, comments?: string): Promise<MonthlyPerformanceReport>;
  rejectReport(id: number, comments: string): Promise<MonthlyPerformanceReport>;
}

export class DatabaseStorage implements IStorage {
  // ============================================
  // USERS
  // ============================================
  async getUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const result = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      inductionStatus: users.inductionStatus,
      isActive: users.isActive,
      signatureDataUrl: users.signatureDataUrl,
      dateJoined: users.dateJoined,
      lastLogin: users.lastLogin,
      lastActivity: users.lastActivity,
    }).from(users).orderBy(desc(users.dateJoined));
    return result;
  }

  async getUser(id: number): Promise<Omit<User, 'passwordHash'> | undefined> {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      inductionStatus: users.inductionStatus,
      isActive: users.isActive,
      signatureDataUrl: users.signatureDataUrl,
      dateJoined: users.dateJoined,
      lastLogin: users.lastLogin,
      lastActivity: users.lastActivity,
    }).from(users).where(eq(users.id, id));
    return user;
  }

  async updateUserActivity(userId: number): Promise<void> {
    await db.update(users)
      .set({ lastActivity: new Date() })
      .where(eq(users.id, userId));
  }

  async getActiveUsers(): Promise<Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    lastActivity: Date | null;
    isOnline: boolean;
  }>> {
    const result = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      lastActivity: users.lastActivity,
    }).from(users).where(eq(users.isActive, true)).orderBy(desc(users.lastActivity));
    
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    return result.map(user => ({
      ...user,
      isOnline: user.lastActivity ? user.lastActivity > fifteenMinutesAgo : false,
    }));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      sql`LOWER(${users.email}) = LOWER(${email})`
    );
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<Omit<User, 'passwordHash'>> {
    const hashedPassword = await hashPassword(insertUser.passwordHash);
    const [user] = await db.insert(users).values({
      ...insertUser,
      passwordHash: hashedPassword,
    }).returning();
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<Omit<User, 'passwordHash'>> {
    const updateData: Partial<InsertUser> = { ...updates };
    if (updates.passwordHash) {
      updateData.passwordHash = await hashPassword(updates.passwordHash);
    }
    const [user] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ============================================
  // DOCUMENTS
  // ============================================
  async getDocuments(filters?: { status?: string; category?: string }): Promise<Document[]> {
    let query = db.select().from(documents);
    
    if (filters?.status && filters?.category) {
      return await db.select().from(documents)
        .where(and(eq(documents.status, filters.status), eq(documents.category, filters.category)))
        .orderBy(desc(documents.updatedAt));
    } else if (filters?.status) {
      return await db.select().from(documents)
        .where(eq(documents.status, filters.status))
        .orderBy(desc(documents.updatedAt));
    } else if (filters?.category) {
      return await db.select().from(documents)
        .where(eq(documents.category, filters.category))
        .orderBy(desc(documents.updatedAt));
    }
    
    return await db.select().from(documents).orderBy(desc(documents.updatedAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(insertDoc).returning();
    return doc;
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document> {
    const [updated] = await db.update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // ============================================
  // DOCUMENT VERSIONS
  // ============================================
  async createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion> {
    const [created] = await db.insert(documentVersions).values(version).returning();
    return created;
  }

  async getDocumentVersions(documentId: number): Promise<DocumentVersion[]> {
    return await db.select().from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.archivedAt));
  }

  // ============================================
  // WORKFLOW LOGS
  // ============================================
  async createWorkflowLog(log: InsertWorkflowLog): Promise<WorkflowLog> {
    const [created] = await db.insert(workflowLogs).values(log).returning();
    return created;
  }

  async getWorkflowLogs(documentId: number): Promise<WorkflowLog[]> {
    return await db.select().from(workflowLogs)
      .where(eq(workflowLogs.documentId, documentId))
      .orderBy(desc(workflowLogs.createdAt));
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================
  async getNotifications(userId?: number): Promise<Notification[]> {
    if (userId) {
      return await db.select().from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
    }
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: number): Promise<Notification> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return 0; // Drizzle doesn't return count easily, return 0 as placeholder
  }

  // ============================================
  // AUDIT LOGS
  // ============================================
  async getAuditLogs(limit: number = 50): Promise<(AuditLog & { userName?: string; documentTitle?: string; documentCode?: string })[]> {
    const logs = await db.select()
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    
    const allDocs = await db.select().from(documents);
    const docMap = new Map(allDocs.map(d => [d.id, { title: d.title, code: d.documentCode }]));
    
    return logs.map(row => {
      const log = row.audit_logs;
      let documentTitle: string | undefined;
      let documentCode: string | undefined;
      
      if (log.entityType === 'document' && log.entityId) {
        const doc = docMap.get(log.entityId);
        documentTitle = doc?.title;
        documentCode = doc?.code;
      }
      
      return {
        ...log,
        userName: row.users?.name || undefined,
        documentTitle,
        documentCode,
      };
    });
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // ============================================
  // DASHBOARD
  // ============================================
  async getDashboardStats() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const allDocs = await db.select().from(documents);
    const allUsers = await db.select().from(users);

    const totalDocuments = allDocs.length;
    const approvedDocuments = allDocs.filter(d => d.status === DocumentStatus.APPROVED).length;
    const pendingApprovals = allDocs.filter(d => 
      d.status === DocumentStatus.IN_REVIEW || d.status === DocumentStatus.PENDING_APPROVAL
    ).length;
    
    const expiringDocuments = allDocs.filter(d => 
      d.nextReviewDate && 
      d.nextReviewDate > now && 
      d.nextReviewDate <= thirtyDaysFromNow &&
      d.status === DocumentStatus.APPROVED
    ).length;

    const nonCompliantDocuments = allDocs.filter(d => 
      d.nextReviewDate && 
      d.nextReviewDate < now &&
      d.status === DocumentStatus.APPROVED
    ).length;

    const totalUsers = allUsers.length;
    const pendingInductions = allUsers.filter(u => u.inductionStatus === InductionStatus.PENDING).length;

    return {
      totalDocuments,
      approvedDocuments,
      pendingApprovals,
      expiringDocuments,
      nonCompliantDocuments,
      totalUsers,
      pendingInductions,
    };
  }

  async getComplianceAlerts() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const docs = await db.select().from(documents)
      .where(eq(documents.status, DocumentStatus.APPROVED));

    const alerts: Array<{
      id: number;
      documentCode: string;
      title: string;
      nextReviewDate: Date | null;
      daysUntilExpiry: number;
      alertLevel: 'yellow' | 'red';
    }> = [];

    for (const doc of docs) {
      if (!doc.nextReviewDate) continue;

      const daysUntilExpiry = Math.ceil((doc.nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        alerts.push({
          id: doc.id,
          documentCode: doc.documentCode,
          title: doc.title,
          nextReviewDate: doc.nextReviewDate,
          daysUntilExpiry,
          alertLevel: 'red',
        });
      } else if (daysUntilExpiry <= 30) {
        alerts.push({
          id: doc.id,
          documentCode: doc.documentCode,
          title: doc.title,
          nextReviewDate: doc.nextReviewDate,
          daysUntilExpiry,
          alertLevel: 'yellow',
        });
      }
    }

    return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  // ============================================
  // EMPLOYEES
  // ============================================
  async getEmployees(filters?: { status?: string; department?: string; workflowStatus?: string }): Promise<Employee[]> {
    const conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(employees.status, filters.status));
    }
    if (filters?.department) {
      conditions.push(eq(employees.department, filters.department));
    }
    if (filters?.workflowStatus) {
      conditions.push(eq(employees.workflowStatus, filters.workflowStatus));
    }

    if (conditions.length > 0) {
      return await db.select().from(employees)
        .where(and(...conditions))
        .orderBy(desc(employees.createdAt));
    }
    return await db.select().from(employees).orderBy(desc(employees.createdAt));
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async getEmployeeByNumber(employeeNumber: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.employeeNumber, employeeNumber));
    return employee;
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.email, email));
    return employee;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  async updateEmployee(id: number, updates: Partial<InsertEmployee>): Promise<Employee> {
    const [updated] = await db.update(employees)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async deleteEmployee(id: number): Promise<void> {
    // First delete associated tasks
    await db.delete(employeeTasks).where(eq(employeeTasks.employeeId, id));
    await db.delete(employees).where(eq(employees.id, id));
  }

  // ============================================
  // EMPLOYEE WORKFLOW
  // ============================================
  async submitEmployeeForReview(id: number, reviewerId: number, notes?: string): Promise<Employee> {
    const [updated] = await db.update(employees)
      .set({
        workflowStatus: EmployeeRecordStatus.IN_REVIEW,
        reviewerId,
        submittedForReviewAt: new Date(),
        workflowNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async submitEmployeeForApproval(id: number, approverId: number, notes?: string): Promise<Employee> {
    const [updated] = await db.update(employees)
      .set({
        workflowStatus: EmployeeRecordStatus.PENDING_APPROVAL,
        approverId,
        reviewedAt: new Date(),
        submittedForApprovalAt: new Date(),
        workflowNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async approveEmployee(id: number, approverId: number, notes?: string): Promise<Employee> {
    const [updated] = await db.update(employees)
      .set({
        workflowStatus: EmployeeRecordStatus.APPROVED,
        approverId,
        approvedAt: new Date(),
        workflowNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async rejectEmployee(id: number, rejectedById: number, notes?: string): Promise<Employee> {
    const [updated] = await db.update(employees)
      .set({
        workflowStatus: EmployeeRecordStatus.REJECTED,
        rejectedById,
        rejectedAt: new Date(),
        workflowNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // EMPLOYEE TASKS
  // ============================================
  async getEmployeeTasks(filters?: { employeeId?: number; status?: string; documentId?: number }): Promise<EmployeeTask[]> {
    const conditions: any[] = [];
    
    if (filters?.employeeId) {
      conditions.push(eq(employeeTasks.employeeId, filters.employeeId));
    }
    if (filters?.status) {
      conditions.push(eq(employeeTasks.status, filters.status));
    }
    if (filters?.documentId) {
      conditions.push(eq(employeeTasks.documentId, filters.documentId));
    }

    if (conditions.length > 0) {
      return await db.select().from(employeeTasks)
        .where(and(...conditions))
        .orderBy(desc(employeeTasks.createdAt));
    }
    return await db.select().from(employeeTasks).orderBy(desc(employeeTasks.createdAt));
  }

  async getEmployeeTask(id: number): Promise<EmployeeTask | undefined> {
    const [task] = await db.select().from(employeeTasks).where(eq(employeeTasks.id, id));
    return task;
  }

  async createEmployeeTask(task: InsertEmployeeTask): Promise<EmployeeTask> {
    const [created] = await db.insert(employeeTasks).values(task).returning();
    return created;
  }

  async updateEmployeeTask(id: number, updates: Partial<InsertEmployeeTask>): Promise<EmployeeTask> {
    const [updated] = await db.update(employeeTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(employeeTasks.id, id))
      .returning();
    return updated;
  }

  async deleteEmployeeTask(id: number): Promise<void> {
    await db.delete(employeeTasks).where(eq(employeeTasks.id, id));
  }

  async completeEmployeeTask(id: number): Promise<EmployeeTask> {
    const [updated] = await db.update(employeeTasks)
      .set({ 
        status: TaskStatus.COMPLETED, 
        completedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(employeeTasks.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // DOWNLOAD REQUESTS
  // ============================================
  async getDownloadRequests(filters?: { documentId?: number; requesterId?: number; status?: string }): Promise<DownloadRequest[]> {
    const conditions = [];
    if (filters?.documentId) {
      conditions.push(eq(downloadRequests.documentId, filters.documentId));
    }
    if (filters?.requesterId) {
      conditions.push(eq(downloadRequests.requesterId, filters.requesterId));
    }
    if (filters?.status) {
      conditions.push(eq(downloadRequests.status, filters.status));
    }

    if (conditions.length > 0) {
      return await db.select().from(downloadRequests)
        .where(and(...conditions))
        .orderBy(desc(downloadRequests.createdAt));
    }
    return await db.select().from(downloadRequests).orderBy(desc(downloadRequests.createdAt));
  }

  async getDownloadRequest(id: number): Promise<DownloadRequest | undefined> {
    const [request] = await db.select().from(downloadRequests).where(eq(downloadRequests.id, id));
    return request;
  }

  async createDownloadRequest(request: InsertDownloadRequest): Promise<DownloadRequest> {
    const [created] = await db.insert(downloadRequests).values(request).returning();
    return created;
  }

  async updateDownloadRequest(id: number, updates: Partial<DownloadRequest>): Promise<DownloadRequest> {
    const [updated] = await db.update(downloadRequests)
      .set(updates)
      .where(eq(downloadRequests.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // MY TASKS
  // ============================================
  async getMyTasks(userId: number): Promise<Array<{
    id: number;
    documentId: number;
    documentCode: string;
    title: string;
    taskType: 'prepare' | 'review' | 'approve';
    status: string;
    createdAt: Date | null;
    dueDate: Date | null;
  }>> {
    const tasks: Array<{
      id: number;
      documentId: number;
      documentCode: string;
      title: string;
      taskType: 'prepare' | 'review' | 'approve';
      status: string;
      createdAt: Date | null;
      dueDate: Date | null;
    }> = [];

    const allDocs = await db.select().from(documents);

    for (const doc of allDocs) {
      // Check if user needs to prepare this document (draft status, preparedById matches, not yet signed)
      if (doc.requiresPreparedBy && 
          doc.preparedById === userId && 
          !doc.preparedBySignedAt && 
          doc.status === DocumentStatus.DRAFT) {
        tasks.push({
          id: doc.id,
          documentId: doc.id,
          documentCode: doc.documentCode,
          title: doc.title,
          taskType: 'prepare',
          status: doc.status,
          createdAt: doc.createdAt,
          dueDate: doc.nextReviewDate,
        });
      }

      // Check if user needs to review this document (in_review status, reviewerId matches)
      if (doc.requiresReviewedBy &&
          doc.reviewerId === userId && 
          !doc.reviewedBySignedAt && 
          doc.status === DocumentStatus.IN_REVIEW) {
        tasks.push({
          id: doc.id,
          documentId: doc.id,
          documentCode: doc.documentCode,
          title: doc.title,
          taskType: 'review',
          status: doc.status,
          createdAt: doc.createdAt,
          dueDate: doc.nextReviewDate,
        });
      }

      // Check if user needs to approve this document (pending_approval status, approverId matches)
      if (doc.requiresApprovedBy &&
          doc.approverId === userId && 
          !doc.approvedBySignedAt && 
          doc.status === DocumentStatus.PENDING_APPROVAL) {
        tasks.push({
          id: doc.id,
          documentId: doc.id,
          documentCode: doc.documentCode,
          title: doc.title,
          taskType: 'approve',
          status: doc.status,
          createdAt: doc.createdAt,
          dueDate: doc.nextReviewDate,
        });
      }
    }

    return tasks;
  }

  // ============================================
  // DOCUMENT FEEDBACK
  // ============================================
  async getDocumentFeedback(documentId: number): Promise<DocumentFeedback[]> {
    return await db.select().from(documentFeedback)
      .where(eq(documentFeedback.documentId, documentId))
      .orderBy(desc(documentFeedback.createdAt));
  }

  async createDocumentFeedback(feedback: InsertDocumentFeedback): Promise<DocumentFeedback> {
    const [created] = await db.insert(documentFeedback).values(feedback).returning();
    return created;
  }

  async updateDocumentFeedback(id: number, updates: Partial<InsertDocumentFeedback>): Promise<DocumentFeedback> {
    const [updated] = await db.update(documentFeedback)
      .set(updates)
      .where(eq(documentFeedback.id, id))
      .returning();
    return updated;
  }

  async markFeedbackAddressed(id: number): Promise<DocumentFeedback> {
    const [updated] = await db.update(documentFeedback)
      .set({ 
        status: FeedbackStatus.ADDRESSED, 
        addressedAt: new Date() 
      })
      .where(eq(documentFeedback.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // DOCUMENT TASKS (Sequential Workflow)
  // ============================================
  async getDocumentTasks(filters?: { documentId?: number; assignedToId?: number; status?: string; isVisible?: boolean }): Promise<DocumentTask[]> {
    const conditions: any[] = [];
    
    if (filters?.documentId) {
      conditions.push(eq(documentTasks.documentId, filters.documentId));
    }
    if (filters?.assignedToId) {
      conditions.push(eq(documentTasks.assignedToId, filters.assignedToId));
    }
    if (filters?.status) {
      conditions.push(eq(documentTasks.status, filters.status));
    }
    if (filters?.isVisible !== undefined) {
      conditions.push(eq(documentTasks.isVisible, filters.isVisible));
    }

    if (conditions.length > 0) {
      return await db.select().from(documentTasks)
        .where(and(...conditions))
        .orderBy(desc(documentTasks.createdAt));
    }
    return await db.select().from(documentTasks).orderBy(desc(documentTasks.createdAt));
  }

  async getDocumentTask(id: number): Promise<DocumentTask | undefined> {
    const [task] = await db.select().from(documentTasks).where(eq(documentTasks.id, id));
    return task;
  }

  async createDocumentTask(task: InsertDocumentTask): Promise<DocumentTask> {
    const [created] = await db.insert(documentTasks).values({
      ...task,
      assignedAt: new Date(),
    }).returning();
    return created;
  }

  async updateDocumentTask(id: number, updates: Partial<DocumentTask>): Promise<DocumentTask> {
    const [updated] = await db.update(documentTasks)
      .set(updates)
      .where(eq(documentTasks.id, id))
      .returning();
    return updated;
  }

  async completeDocumentTask(id: number): Promise<DocumentTask> {
    const task = await this.getDocumentTask(id);
    if (!task) throw new Error('Task not found');

    const now = new Date();
    const assignedAt = task.assignedAt || task.createdAt || now;
    const targetDate = task.targetDate;
    
    // Calculate actual hours worked
    const actualHours = Math.ceil((now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60));
    
    // Calculate early or delay hours
    let earlyHours = 0;
    let delayHours = 0;
    let performancePoints = 1; // Base point for completion
    
    if (targetDate) {
      if (now < targetDate) {
        // Completed early
        earlyHours = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60));
        performancePoints += earlyHours; // +1 point per hour early
      } else if (now > targetDate) {
        // Completed late
        delayHours = Math.ceil((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60));
        performancePoints -= delayHours; // -1 point per hour late
      }
    }

    const [updated] = await db.update(documentTasks)
      .set({ 
        status: DocumentTaskStatus.COMPLETED,
        completedAt: now,
        actualHours,
        earlyHours,
        delayHours,
        performancePoints,
      })
      .where(eq(documentTasks.id, id))
      .returning();
    return updated;
  }

  async generateTaskNumber(): Promise<string> {
    const allTasks = await db.select().from(documentTasks);
    const nextNumber = allTasks.length + 1;
    return `TASK-${String(nextNumber).padStart(4, '0')}`;
  }

  // ============================================
  // TASK POKES (Buzz/Reminder)
  // ============================================
  async getTaskPokes(documentTaskId: number): Promise<TaskPoke[]> {
    return await db.select().from(taskPokes)
      .where(eq(taskPokes.documentTaskId, documentTaskId))
      .orderBy(desc(taskPokes.createdAt));
  }

  async createTaskPoke(poke: InsertTaskPoke): Promise<TaskPoke> {
    const [created] = await db.insert(taskPokes).values(poke).returning();
    return created;
  }

  // ============================================
  // USER PERFORMANCE STATS
  // ============================================
  async getUserPerformanceStats(userId: number): Promise<{
    totalTasks: number;
    completedTasks: number;
    onTimeTasks: number;
    earlyTasks: number;
    delayedTasks: number;
    totalPoints: number;
    averageCompletionHours: number;
  }> {
    const userTasks = await db.select().from(documentTasks)
      .where(eq(documentTasks.assignedToId, userId));

    const completedTasks = userTasks.filter(t => t.status === DocumentTaskStatus.COMPLETED);
    const earlyTasks = completedTasks.filter(t => (t.earlyHours || 0) > 0);
    const delayedTasks = completedTasks.filter(t => (t.delayHours || 0) > 0);
    const onTimeTasks = completedTasks.filter(t => (t.earlyHours || 0) === 0 && (t.delayHours || 0) === 0);

    const totalPoints = completedTasks.reduce((sum, t) => sum + (t.performancePoints || 0), 0);
    const totalHours = completedTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    const averageCompletionHours = completedTasks.length > 0 ? Math.round(totalHours / completedTasks.length) : 0;

    return {
      totalTasks: userTasks.length,
      completedTasks: completedTasks.length,
      onTimeTasks: onTimeTasks.length,
      earlyTasks: earlyTasks.length,
      delayedTasks: delayedTasks.length,
      totalPoints,
      averageCompletionHours,
    };
  }

  // ============================================
  // DOCUMENT ACCESS REQUESTS
  // ============================================
  async getDocumentAccessRequests(filters?: { documentId?: number; requesterId?: number; status?: string }): Promise<DocumentAccessRequest[]> {
    let query = db.select().from(documentAccessRequests);
    const conditions = [];
    
    if (filters?.documentId) {
      conditions.push(eq(documentAccessRequests.documentId, filters.documentId));
    }
    if (filters?.requesterId) {
      conditions.push(eq(documentAccessRequests.requesterId, filters.requesterId));
    }
    if (filters?.status) {
      conditions.push(eq(documentAccessRequests.status, filters.status));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(documentAccessRequests)
        .where(and(...conditions))
        .orderBy(desc(documentAccessRequests.createdAt));
    }
    
    return await db.select().from(documentAccessRequests)
      .orderBy(desc(documentAccessRequests.createdAt));
  }

  async getDocumentAccessRequest(id: number): Promise<DocumentAccessRequest | undefined> {
    const [request] = await db.select().from(documentAccessRequests)
      .where(eq(documentAccessRequests.id, id));
    return request;
  }

  async createDocumentAccessRequest(request: InsertDocumentAccessRequest): Promise<DocumentAccessRequest> {
    const [created] = await db.insert(documentAccessRequests).values(request).returning();
    return created;
  }

  async updateDocumentAccessRequest(id: number, updates: Partial<DocumentAccessRequest>): Promise<DocumentAccessRequest> {
    const [updated] = await db.update(documentAccessRequests)
      .set(updates)
      .where(eq(documentAccessRequests.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // DOCUMENT ACCESS (Granted Permissions)
  // ============================================
  async getDocumentAccess(filters?: { documentId?: number; userId?: number }): Promise<DocumentAccess[]> {
    const conditions = [];
    
    if (filters?.documentId) {
      conditions.push(eq(documentAccess.documentId, filters.documentId));
    }
    if (filters?.userId) {
      conditions.push(eq(documentAccess.userId, filters.userId));
    }
    // Only return non-revoked access
    conditions.push(eq(documentAccess.isRevoked, false));
    
    return await db.select().from(documentAccess)
      .where(and(...conditions))
      .orderBy(desc(documentAccess.grantedAt));
  }

  async hasDocumentAccess(documentId: number, userId: number): Promise<boolean> {
    const [access] = await db.select().from(documentAccess)
      .where(and(
        eq(documentAccess.documentId, documentId),
        eq(documentAccess.userId, userId),
        eq(documentAccess.isRevoked, false)
      ));
    return !!access;
  }

  async grantDocumentAccess(access: InsertDocumentAccess): Promise<DocumentAccess> {
    // Check if access already exists
    const existing = await db.select().from(documentAccess)
      .where(and(
        eq(documentAccess.documentId, access.documentId),
        eq(documentAccess.userId, access.userId),
        eq(documentAccess.isRevoked, false)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [created] = await db.insert(documentAccess).values(access).returning();
    return created;
  }

  async revokeDocumentAccess(documentId: number, userId: number, revokedById: number): Promise<DocumentAccess | undefined> {
    const [revoked] = await db.update(documentAccess)
      .set({ 
        isRevoked: true, 
        revokedAt: new Date() 
      })
      .where(and(
        eq(documentAccess.documentId, documentId),
        eq(documentAccess.userId, userId),
        eq(documentAccess.isRevoked, false)
      ))
      .returning();
    return revoked;
  }

  // ============================================
  // USER RECORDS (Completion Reports)
  // ============================================
  async getUserRecords(userId: number): Promise<UserRecord[]> {
    return await db.select().from(userRecords)
      .where(eq(userRecords.userId, userId))
      .orderBy(desc(userRecords.createdAt));
  }

  async getUserRecord(id: number): Promise<UserRecord | undefined> {
    const [record] = await db.select().from(userRecords)
      .where(eq(userRecords.id, id));
    return record;
  }

  async createUserRecord(record: InsertUserRecord): Promise<UserRecord> {
    const [created] = await db.insert(userRecords).values(record).returning();
    return created;
  }

  async generateReportNumber(reportType: string): Promise<string> {
    const prefix = reportType === 'document_approval' ? 'DAR' : 'SCR';
    const year = new Date().getFullYear();
    const existingRecords = await db.select().from(userRecords)
      .where(sql`${userRecords.reportNumber} LIKE ${prefix + '-' + year + '-%'}`);
    const nextNumber = existingRecords.length + 1;
    return `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
  }

  // ============================================
  // BUDDY STATUS SYSTEM
  // ============================================
  async getBuddyStatus(userId: number): Promise<BuddyStatus | undefined> {
    const [status] = await db.select().from(buddyStatus)
      .where(eq(buddyStatus.userId, userId));
    return status;
  }

  async getOrCreateBuddyStatus(userId: number): Promise<BuddyStatus> {
    const existing = await this.getBuddyStatus(userId);
    if (existing) return existing;

    const [created] = await db.insert(buddyStatus).values({
      userId,
      complianceScore: 100,
      currentState: BuddyState.FLEXING,
    }).returning();
    return created;
  }

  async updateBuddyStatus(userId: number, updates: Partial<InsertBuddyStatus>): Promise<BuddyStatus> {
    const [updated] = await db.update(buddyStatus)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(buddyStatus.userId, userId))
      .returning();
    return updated;
  }

  async calculateUserCompliance(userId: number): Promise<{ score: number; state: string }> {
    const tasks = await db.select().from(documentTasks)
      .where(eq(documentTasks.assignedToId, userId));

    const totalTasks = tasks.length;
    if (totalTasks === 0) {
      return { score: 100, state: BuddyState.FLEXING };
    }

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed') return false;
      if (!t.targetDate) return false;
      return new Date(t.targetDate) < new Date();
    }).length;

    // Calculate compliance score
    // Base score from completion rate
    const completionRate = (completedTasks / totalTasks) * 100;
    // Penalty for overdue tasks
    const overduePenalty = (overdueTasks / totalTasks) * 30;
    const score = Math.max(0, Math.min(100, Math.round(completionRate - overduePenalty)));

    // Determine state based on score
    let state: string;
    if (score >= 90) state = BuddyState.FLEXING;
    else if (score >= 80) state = BuddyState.HEALTHY;
    else if (score >= 70) state = BuddyState.TIRED;
    else if (score >= 60) state = BuddyState.WEAK;
    else state = BuddyState.CRITICAL;

    // Update buddy status
    await this.getOrCreateBuddyStatus(userId);
    await this.updateBuddyStatus(userId, {
      complianceScore: score,
      currentState: state,
      totalTasksAssigned: totalTasks,
      tasksCompleted: completedTasks,
      tasksOverdue: overdueTasks,
    });

    return { score, state };
  }

  // ============================================
  // PUSH SUBSCRIPTIONS
  // ============================================
  async getPushSubscriptions(userId: number): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      ));
  }

  async savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    // Check if subscription already exists
    const existing = await db.select().from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, subscription.userId),
        eq(pushSubscriptions.endpoint, subscription.endpoint)
      ));

    if (existing.length > 0) {
      const [updated] = await db.update(pushSubscriptions)
        .set({ ...subscription, isActive: true, updatedAt: new Date() })
        .where(eq(pushSubscriptions.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(pushSubscriptions).values(subscription).returning();
    return created;
  }

  async removePushSubscription(userId: number, endpoint: string): Promise<void> {
    await db.update(pushSubscriptions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ));
  }

  // ============================================
  // BUDDY DIALOGUES
  // ============================================
  async getBuddyDialogues(userId: number, unacknowledgedOnly?: boolean): Promise<BuddyDialogue[]> {
    const conditions = [eq(buddyDialogues.userId, userId)];
    if (unacknowledgedOnly) {
      conditions.push(eq(buddyDialogues.isAcknowledged, false));
    }
    return await db.select().from(buddyDialogues)
      .where(and(...conditions))
      .orderBy(desc(buddyDialogues.createdAt));
  }

  async createBuddyDialogue(dialogue: InsertBuddyDialogue): Promise<BuddyDialogue> {
    const [created] = await db.insert(buddyDialogues).values(dialogue).returning();
    return created;
  }

  async acknowledgeBuddyDialogue(id: number): Promise<BuddyDialogue> {
    const [updated] = await db.update(buddyDialogues)
      .set({ isAcknowledged: true, acknowledgedAt: new Date() })
      .where(eq(buddyDialogues.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // USER ACTIVITY LOGS
  // ============================================
  async startUserSession(userId: number): Promise<UserActivityLog> {
    // End any existing active sessions for this user
    await db.update(userActivityLogs)
      .set({ isActive: false, sessionEnd: new Date() })
      .where(and(eq(userActivityLogs.userId, userId), eq(userActivityLogs.isActive, true)));
    
    const now = new Date();
    const [created] = await db.insert(userActivityLogs).values({
      userId,
      activityDate: now,
      sessionStart: now,
      lastHeartbeat: now,
      isActive: true,
      totalActiveMinutes: 0,
    }).returning();
    return created;
  }

  async updateUserHeartbeat(userId: number): Promise<void> {
    const now = new Date();
    
    // Find active session
    const activeSessions = await db.select().from(userActivityLogs)
      .where(and(eq(userActivityLogs.userId, userId), eq(userActivityLogs.isActive, true)))
      .orderBy(desc(userActivityLogs.sessionStart))
      .limit(1);
    
    if (activeSessions.length > 0) {
      const session = activeSessions[0];
      const lastHeartbeat = session.lastHeartbeat || session.sessionStart;
      const minutesSinceLastHeartbeat = Math.floor((now.getTime() - lastHeartbeat.getTime()) / (1000 * 60));
      
      // Only count up to 10 minutes per heartbeat interval (to avoid counting inactive time)
      const activeMinutesToAdd = Math.min(minutesSinceLastHeartbeat, 10);
      
      await db.update(userActivityLogs)
        .set({ 
          lastHeartbeat: now,
          totalActiveMinutes: (session.totalActiveMinutes || 0) + activeMinutesToAdd
        })
        .where(eq(userActivityLogs.id, session.id));
    } else {
      // No active session, start a new one
      await this.startUserSession(userId);
    }
  }

  async endUserSession(userId: number): Promise<void> {
    const now = new Date();
    await db.update(userActivityLogs)
      .set({ isActive: false, sessionEnd: now })
      .where(and(eq(userActivityLogs.userId, userId), eq(userActivityLogs.isActive, true)));
  }

  async getUserActivityLogs(userId: number, month: number, year: number): Promise<UserActivityLog[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    return await db.select().from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gt(userActivityLogs.activityDate, startDate),
        lt(userActivityLogs.activityDate, endDate)
      ))
      .orderBy(desc(userActivityLogs.activityDate));
  }

  // ============================================
  // MONTHLY PERFORMANCE REPORTS
  // ============================================
  async getMonthlyPerformanceReports(filters?: { userId?: number; month?: number; year?: number; status?: string }): Promise<MonthlyPerformanceReport[]> {
    let query = db.select().from(monthlyPerformanceReports);
    const conditions = [];
    
    if (filters?.userId) conditions.push(eq(monthlyPerformanceReports.userId, filters.userId));
    if (filters?.month) conditions.push(eq(monthlyPerformanceReports.reportMonth, filters.month));
    if (filters?.year) conditions.push(eq(monthlyPerformanceReports.reportYear, filters.year));
    if (filters?.status) conditions.push(eq(monthlyPerformanceReports.status, filters.status));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return await query.orderBy(desc(monthlyPerformanceReports.reportYear), desc(monthlyPerformanceReports.reportMonth));
  }

  async getMonthlyPerformanceReport(id: number): Promise<MonthlyPerformanceReport | undefined> {
    const [report] = await db.select().from(monthlyPerformanceReports)
      .where(eq(monthlyPerformanceReports.id, id));
    return report;
  }

  async createMonthlyPerformanceReport(report: InsertMonthlyPerformanceReport): Promise<MonthlyPerformanceReport> {
    const [created] = await db.insert(monthlyPerformanceReports).values(report).returning();
    return created;
  }

  async updateMonthlyPerformanceReport(id: number, report: Partial<InsertMonthlyPerformanceReport>): Promise<MonthlyPerformanceReport> {
    const [updated] = await db.update(monthlyPerformanceReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(monthlyPerformanceReports.id, id))
      .returning();
    return updated;
  }

  async generateMonthlyReport(userId: number, month: number, year: number): Promise<MonthlyPerformanceReport> {
    // Check if report already exists
    const existing = await db.select().from(monthlyPerformanceReports)
      .where(and(
        eq(monthlyPerformanceReports.userId, userId),
        eq(monthlyPerformanceReports.reportMonth, month),
        eq(monthlyPerformanceReports.reportYear, year)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Calculate activity metrics
    const activityLogs = await this.getUserActivityLogs(userId, month, year);
    const totalActiveMinutes = activityLogs.reduce((sum, log) => sum + (log.totalActiveMinutes || 0), 0);
    const totalActiveHours = Math.round(totalActiveMinutes / 60);
    
    // Calculate online hours (from session start to end)
    let totalOnlineMinutes = 0;
    for (const log of activityLogs) {
      if (log.sessionStart && log.sessionEnd) {
        totalOnlineMinutes += Math.floor((log.sessionEnd.getTime() - log.sessionStart.getTime()) / (1000 * 60));
      } else if (log.sessionStart && log.lastHeartbeat) {
        totalOnlineMinutes += Math.floor((log.lastHeartbeat.getTime() - log.sessionStart.getTime()) / (1000 * 60));
      }
    }
    const totalOnlineHours = Math.round(totalOnlineMinutes / 60);
    
    // Count unique active days
    const uniqueDays = new Set(activityLogs.map(log => 
      log.activityDate ? log.activityDate.toISOString().split('T')[0] : ''
    )).size;

    // Get document metrics from audit logs
    const allAuditLogs = await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.userId, userId),
        gt(auditLogs.createdAt, startDate),
        lt(auditLogs.createdAt, endDate)
      ));

    const documentsCreated = allAuditLogs.filter(log => 
      log.entityType === 'document' && log.action === 'create'
    ).length;
    
    const documentsReviewed = allAuditLogs.filter(log => 
      log.entityType === 'document' && log.action === 'complete_task' && 
      log.newValue?.includes('"taskType":"review"')
    ).length;
    
    const documentsApproved = allAuditLogs.filter(log => 
      log.entityType === 'document' && log.action === 'approve'
    ).length;

    // Get task metrics
    const allTasks = await db.select().from(documentTasks)
      .where(eq(documentTasks.assignedToId, userId));

    const tasksCompleted = allTasks.filter(task => 
      task.status === 'completed' && 
      task.completedAt && 
      task.completedAt >= startDate && 
      task.completedAt <= endDate
    ).length;
    
    const tasksOverdue = allTasks.filter(task => 
      task.status === 'overdue' || 
      (task.targetDate && new Date(task.targetDate) < new Date() && task.status !== 'completed')
    ).length;
    
    const tasksPending = allTasks.filter(task => 
      task.status === 'pending' || task.status === 'assigned' || task.status === 'in_progress'
    ).length;

    // Create the report
    const [report] = await db.insert(monthlyPerformanceReports).values({
      userId,
      reportMonth: month,
      reportYear: year,
      totalActiveHours,
      totalOnlineHours,
      totalDaysActive: uniqueDays,
      documentsCreated,
      documentsReviewed,
      documentsApproved,
      tasksCompleted,
      tasksOverdue,
      tasksPending,
      status: MonthlyReportStatus.DRAFT,
    }).returning();

    return report;
  }

  async submitReportForReview(id: number): Promise<MonthlyPerformanceReport> {
    const [updated] = await db.update(monthlyPerformanceReports)
      .set({ status: MonthlyReportStatus.IN_REVIEW, updatedAt: new Date() })
      .where(eq(monthlyPerformanceReports.id, id))
      .returning();
    return updated;
  }

  async reviewReport(id: number, reviewerId: number, comments?: string): Promise<MonthlyPerformanceReport> {
    const [updated] = await db.update(monthlyPerformanceReports)
      .set({ 
        status: MonthlyReportStatus.PENDING_APPROVAL,
        reviewerId,
        reviewedAt: new Date(),
        reviewComments: comments,
        updatedAt: new Date()
      })
      .where(eq(monthlyPerformanceReports.id, id))
      .returning();
    return updated;
  }

  async approveReport(id: number, approverId: number, comments?: string): Promise<MonthlyPerformanceReport> {
    const [updated] = await db.update(monthlyPerformanceReports)
      .set({ 
        status: MonthlyReportStatus.APPROVED,
        approverId,
        approvedAt: new Date(),
        approvalComments: comments,
        updatedAt: new Date()
      })
      .where(eq(monthlyPerformanceReports.id, id))
      .returning();
    return updated;
  }

  async rejectReport(id: number, comments: string): Promise<MonthlyPerformanceReport> {
    const [updated] = await db.update(monthlyPerformanceReports)
      .set({ 
        status: MonthlyReportStatus.REJECTED,
        reviewComments: comments,
        updatedAt: new Date()
      })
      .where(eq(monthlyPerformanceReports.id, id))
      .returning();
    return updated;
  }

  // Bug Reports
  async getBugReports(filters?: { status?: string; reportedById?: number }): Promise<BugReport[]> {
    let query = db.select().from(bugReports).orderBy(desc(bugReports.createdAt));
    
    if (filters?.status) {
      query = query.where(eq(bugReports.status, filters.status)) as typeof query;
    }
    if (filters?.reportedById) {
      query = query.where(eq(bugReports.reportedById, filters.reportedById)) as typeof query;
    }
    
    return query;
  }

  async getBugReport(id: number): Promise<BugReport | undefined> {
    const [report] = await db.select().from(bugReports).where(eq(bugReports.id, id));
    return report;
  }

  async createBugReport(data: Omit<InsertBugReport, 'ticketNumber'>): Promise<BugReport> {
    // Generate ticket number
    const count = await db.select({ count: sql<number>`count(*)` }).from(bugReports);
    const ticketNumber = `BUG-${String(Number(count[0].count) + 1).padStart(4, '0')}`;
    
    const [report] = await db.insert(bugReports).values({
      ...data,
      ticketNumber,
    }).returning();
    return report;
  }

  async updateBugReport(id: number, data: Partial<InsertBugReport>): Promise<BugReport> {
    const [updated] = await db.update(bugReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bugReports.id, id))
      .returning();
    return updated;
  }

  async resolveBugReport(id: number, resolvedById: number, resolutionNotes: string): Promise<BugReport> {
    const [updated] = await db.update(bugReports)
      .set({
        status: BugReportStatus.RESOLVED,
        resolvedById,
        resolutionNotes,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, id))
      .returning();
    return updated;
  }

  async closeBugReport(id: number): Promise<BugReport> {
    const [updated] = await db.update(bugReports)
      .set({
        status: BugReportStatus.CLOSED,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, id))
      .returning();
    return updated;
  }

  async markBugReportNotified(id: number): Promise<BugReport> {
    const [updated] = await db.update(bugReports)
      .set({ userNotified: true, updatedAt: new Date() })
      .where(eq(bugReports.id, id))
      .returning();
    return updated;
  }

  async deleteBugReport(id: number): Promise<void> {
    await db.delete(bugReports).where(eq(bugReports.id, id));
  }
}

export const storage = new DatabaseStorage();
