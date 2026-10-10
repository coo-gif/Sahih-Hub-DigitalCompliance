import { db } from "./db";
import {
  users, documents, documentVersions, workflowLogs, notifications, auditLogs,
  employees, employeeTasks, downloadRequests, documentFeedback, documentComments, documentTasks, taskPokes,
  documentAccessRequests, documentAccess, userRecords, buddyStatus, pushSubscriptions, buddyDialogues,
  userActivityLogs, monthlyPerformanceReports, bugReports,
  certificationApplications, certificationAudits, auditFindings, certificates, wallPosts, revisionHistory,
  trainings, trainingAssignments, trainingCompletions, docugenieForms, docugenieFormSubmissions, 
  leads, leadStatusHistory, leadUpdateRequests, customers, opportunities, historicalData,
  type User, type InsertUser,
  type DocumentComment, type InsertDocumentComment,
  type Lead, type InsertLead,
  type LeadStatusHistory, type InsertLeadStatusHistory,
  type LeadUpdateRequest, type InsertLeadUpdateRequest,
  type Customer, type InsertCustomer,
  type Opportunity, type InsertOpportunity,
  type HistoricalData, type InsertHistoricalData,
  type DocuGenieForm, type InsertDocuGenieForm,
  type DocuGenieFormSubmission, type InsertDocuGenieFormSubmission,
  type RevisionHistory, type InsertRevisionHistory,
  type Training, type InsertTraining,
  type TrainingAssignment, type InsertTrainingAssignment,
  type TrainingCompletion, type InsertTrainingCompletion,
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
  type CertificationApplication, type InsertCertificationApplication,
  type CertificationAudit, type InsertCertificationAudit,
  type AuditFinding, type InsertAuditFinding,
  type Certificate, type InsertCertificate,
  type WallPost, type InsertWallPost,
  DocumentStatus, DocumentCommentStatus, InductionStatus, TaskStatus, FeedbackStatus, DocumentTaskStatus,
  EmployeeRecordStatus, DocumentAccessRequestStatus, BuddyState, MonthlyReportStatus,
  BugReportStatus, taskRecords, TaskRecordStatus,
} from "@shared/schema";
import { eq, desc, and, lt, gt, or, sql } from "drizzle-orm";
import { computeTaskMetrics, reportFieldsFromMetrics } from "./task-ledger";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Columns that tie a user to business or audit records: a user referenced here is deactivated, never deleted
const USER_RECORD_COLUMNS: Array<[string, string]> = [
  ['audit_logs', 'user_id'], ['documents', 'created_by_id'], ['documents', 'prepared_by_id'],
  ['documents', 'reviewer_id'], ['documents', 'approver_id'], ['documents', 'reviewed_by_id'],
  ['documents', 'approved_by_id'], ['documents', 'hub_approved_by_id'], ['document_versions', 'approved_by_id'],
  ['workflow_logs', 'action_by_id'], ['workflow_logs', 'assigned_to_id'], ['document_comments', 'author_id'],
  ['document_feedback', 'author_id'], ['document_access', 'user_id'], ['document_access', 'granted_by_id'],
  ['document_access_requests', 'requester_id'], ['download_requests', 'requester_id'], ['change_requests', 'initiator_id'],
  ['revision_history', 'prepared_by_id'], ['revision_history', 'reviewed_by_id'], ['revision_history', 'approved_by_id'],
  ['employees', 'user_id'], ['employees', 'created_by_user_id'], ['employees', 'reviewer_id'], ['employees', 'approver_id'],
  ['employee_tasks', 'assigned_by_user_id'], ['task_records', 'user_id'], ['user_records', 'user_id'],
  ['monthly_performance_reports', 'user_id'], ['bug_reports', 'reported_by_id'], ['bug_reports', 'assigned_to_id'],
  ['wall_posts', 'author_id'], ['leads', 'created_by_id'], ['leads', 'assigned_to_id'], ['customers', 'created_by_id'],
  ['opportunities', 'created_by_id'], ['trainings', 'created_by_id'], ['training_assignments', 'assigned_by_id'],
  ['certificates', 'issued_by_id'], ['docugenie_forms', 'created_by_id'],
  ['internal_audits', 'created_by_id'], ['internal_audits', 'lead_auditor_id'], ['internal_audits', 'signed_off_by_id'],
];
// Personal data removed together with the account
const USER_EPHEMERAL_COLUMNS: Array<[string, string]> = [
  ['notifications', 'user_id'], ['buddy_status', 'user_id'], ['buddy_dialogues', 'user_id'],
  ['push_subscriptions', 'user_id'], ['user_activity_logs', 'user_id'],
];

export class UserHasRecordsError extends Error {
  constructor() {
    super('This user has records in the system and cannot be deleted. Deactivate the account instead.');
  }
}

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
  markNotificationRead(id: number, userId?: number): Promise<Notification | undefined>;
  markDocumentNotificationsRead(userId: number, documentId: number): Promise<number>;
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
  getDocumentComments(documentId: number): Promise<DocumentComment[]>;
  getOpenCommentsAssignedTo(userId: number): Promise<DocumentComment[]>;
  getDocumentComment(id: number): Promise<DocumentComment | undefined>;
  createDocumentComment(comment: InsertDocumentComment): Promise<DocumentComment>;
  updateDocumentComment(id: number, updates: Partial<InsertDocumentComment>): Promise<DocumentComment>;
  deleteDocumentComment(id: number): Promise<void>;
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
  getAllUserRecords(): Promise<UserRecord[]>;
  getUserRecord(id: number): Promise<UserRecord | undefined>;
  createUserRecord(record: InsertUserRecord): Promise<UserRecord>;
  generateReportNumber(reportType: string): Promise<string>;

  // Buddy Status System
  getBuddyStatus(userId: number): Promise<BuddyStatus | undefined>;
  getOrCreateBuddyStatus(userId: number): Promise<BuddyStatus>;
  updateBuddyStatus(userId: number, updates: Partial<InsertBuddyStatus>): Promise<BuddyStatus>;
  calculateUserCompliance(userId: number): Promise<{ score: number; state: string }>;
  getUserTaskStats(userId: number): Promise<{ totalTasks: number; completedTasks: number; overdueTasks: number }>;
  calculateSystemCompliance(): Promise<{ score: number; state: string }>;
  getSystemTaskStats(): Promise<{ totalTasks: number; completedTasks: number; overdueTasks: number }>;

  // Push Subscriptions
  getPushSubscriptions(userId: number): Promise<PushSubscription[]>;
  savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  removePushSubscription(userId: number, endpoint: string): Promise<void>;

  // Buddy Dialogues
  getBuddyDialogues(userId: number, unacknowledgedOnly?: boolean): Promise<BuddyDialogue[]>;
  createBuddyDialogue(dialogue: InsertBuddyDialogue): Promise<BuddyDialogue>;
  acknowledgeBuddyDialogue(id: number, userId?: number): Promise<BuddyDialogue | undefined>;

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
  approveReport(id: number, approverId: number, comments?: string): Promise<MonthlyPerformanceReport | undefined>;
  rejectReport(id: number, comments: string): Promise<MonthlyPerformanceReport>;

  // Certification Applications
  getCertificationApplications(filters?: { status?: string; assignedAuditorId?: number }): Promise<CertificationApplication[]>;
  getCertificationApplication(id: number): Promise<CertificationApplication | undefined>;
  createCertificationApplication(app: InsertCertificationApplication): Promise<CertificationApplication>;
  updateCertificationApplication(id: number, app: Partial<InsertCertificationApplication>): Promise<CertificationApplication>;
  deleteCertificationApplication(id: number): Promise<void>;

  // Certification Audits
  getCertificationAudits(applicationId?: number): Promise<CertificationAudit[]>;
  getCertificationAudit(id: number): Promise<CertificationAudit | undefined>;
  createCertificationAudit(audit: InsertCertificationAudit): Promise<CertificationAudit>;
  updateCertificationAudit(id: number, audit: Partial<InsertCertificationAudit>): Promise<CertificationAudit>;

  // Audit Findings
  getAuditFindings(auditId?: number): Promise<AuditFinding[]>;
  getAuditFinding(id: number): Promise<AuditFinding | undefined>;
  createAuditFinding(finding: InsertAuditFinding): Promise<AuditFinding>;
  updateAuditFinding(id: number, finding: Partial<InsertAuditFinding>): Promise<AuditFinding>;

  // Certificates
  getCertificates(filters?: { applicationId?: number; status?: string }): Promise<Certificate[]>;
  getCertificate(id: number): Promise<Certificate | undefined>;
  getCertificateByNumber(certificateNumber: string): Promise<Certificate | undefined>;
  createCertificate(cert: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: number, cert: Partial<InsertCertificate>): Promise<Certificate>;

  // Wall Posts
  getWallPosts(limit?: number): Promise<Array<WallPost & { authorName: string; authorRole: string }>>;
  getWallPost(id: number): Promise<WallPost | undefined>;
  createWallPost(post: InsertWallPost): Promise<WallPost>;
  updateWallPost(id: number, post: Partial<InsertWallPost>): Promise<WallPost>;
  deleteWallPost(id: number): Promise<void>;
  pinWallPost(id: number, isPinned: boolean): Promise<WallPost>;

  // Revision History
  getRevisionHistory(documentId: number): Promise<RevisionHistory[]>;
  getRevisionHistoryById(id: number): Promise<RevisionHistory | undefined>;
  createRevisionHistory(entry: InsertRevisionHistory): Promise<RevisionHistory>;
  updateRevisionHistory(id: number, updates: Partial<InsertRevisionHistory>): Promise<RevisionHistory>;
  deleteRevisionHistory(id: number): Promise<void>;

  // DocuGenie Forms
  getDocuGenieForms(filters?: { status?: string; createdById?: number }): Promise<DocuGenieForm[]>;
  getDocuGenieForm(id: number): Promise<DocuGenieForm | undefined>;
  getDocuGenieFormByToken(token: string): Promise<DocuGenieForm | undefined>;
  createDocuGenieForm(form: InsertDocuGenieForm): Promise<DocuGenieForm>;
  updateDocuGenieForm(id: number, form: Partial<InsertDocuGenieForm>): Promise<DocuGenieForm>;
  deleteDocuGenieForm(id: number): Promise<void>;

  // DocuGenie Form Submissions
  getDocuGenieFormSubmissions(formId: number): Promise<DocuGenieFormSubmission[]>;
  getDocuGenieFormSubmission(id: number): Promise<DocuGenieFormSubmission | undefined>;
  createDocuGenieFormSubmission(submission: InsertDocuGenieFormSubmission): Promise<DocuGenieFormSubmission>;

  // CRM - Leads
  getLeads(filters?: { status?: string; assignedToId?: number }): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<void>;

  // CRM - Lead Status History
  getLeadStatusHistory(leadId: number): Promise<Array<LeadStatusHistory & { changedByName: string }>>;
  createLeadStatusHistory(entry: InsertLeadStatusHistory): Promise<LeadStatusHistory>;

  // CRM - Lead Update Requests
  getLeadUpdateRequests(leadId: number): Promise<Array<LeadUpdateRequest & { requestedByName: string; requestedFromName: string }>>;
  getPendingLeadUpdateRequests(userId: number): Promise<Array<LeadUpdateRequest & { leadName: string; requestedByName: string }>>;
  createLeadUpdateRequest(request: InsertLeadUpdateRequest): Promise<LeadUpdateRequest>;
  getLeadUpdateRequest(id: number): Promise<LeadUpdateRequest | undefined>;
  resolveLeadUpdateRequest(id: number, response?: string | null): Promise<LeadUpdateRequest | undefined>;

  // CRM - Customers
  getCustomers(filters?: { accountOwnerId?: number }): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<void>;

  // CRM - Opportunities
  getOpportunities(filters?: { stage?: string; customerId?: number }): Promise<Opportunity[]>;
  getOpportunity(id: number): Promise<Opportunity | undefined>;
  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: number, opportunity: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: number): Promise<void>;

  // Historical Performance Data
  getHistoricalData(filters?: { year?: number }): Promise<HistoricalData[]>;
  getHistoricalDataEntry(id: number): Promise<HistoricalData | undefined>;
  createHistoricalData(data: InsertHistoricalData): Promise<HistoricalData>;
  updateHistoricalData(id: number, data: Partial<InsertHistoricalData>): Promise<HistoricalData | undefined>;
  deleteHistoricalData(id: number): Promise<void>;
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
      agreementAcceptedAt: users.agreementAcceptedAt,
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
      agreementAcceptedAt: users.agreementAcceptedAt,
    }).from(users).where(eq(users.id, id));
    return user;
  }

  async acceptUserAgreement(userId: number): Promise<void> {
    await db.update(users)
      .set({ agreementAcceptedAt: new Date() })
      .where(eq(users.id, userId));
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
    // Never hand back the password hash or Gmail tokens
    const { passwordHash, gmailAccessToken, gmailRefreshToken, ...userWithoutPassword } = user;
    return userWithoutPassword as Omit<User, 'passwordHash'>;
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
    const { passwordHash, gmailAccessToken, gmailRefreshToken, ...userWithoutPassword } = user;
    return userWithoutPassword as Omit<User, 'passwordHash'>;
  }

  async deleteUser(id: number): Promise<void> {
    if (await this.userHasRecords(id)) {
      throw new UserHasRecordsError();
    }
    // Personal, non-record data goes with the account
    for (const [table, column] of USER_EPHEMERAL_COLUMNS) {
      await db.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${id}`);
    }
    await db.delete(users).where(eq(users.id, id));
  }

  // True when the user appears in any business or audit record (the tables have no foreign keys)
  async userHasRecords(id: number): Promise<boolean> {
    const checks = USER_RECORD_COLUMNS.map(([table, column]) =>
      sql`EXISTS (SELECT 1 FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${id})`);
    const result = await db.execute(sql`SELECT (${sql.join(checks, sql` OR `)}) AS has_records`);
    return !!(result.rows[0] as any)?.has_records;
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

  async markNotificationRead(id: number, userId?: number): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(userId !== undefined ? and(eq(notifications.id, id), eq(notifications.userId, userId)) : eq(notifications.id, id))
      .returning();
    return updated;
  }

  // A tagged user opening the document has seen what they were tagged in
  async markDocumentNotificationsRead(userId: number, documentId: number): Promise<number> {
    const updated = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.relatedDocumentId, documentId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return updated.length;
  }



  async markAllNotificationsRead(userId: number): Promise<number> {
    const updated = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return updated.length;
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

  async getDocumentComments(documentId: number): Promise<DocumentComment[]> {
    return await db.select().from(documentComments)
      .where(eq(documentComments.documentId, documentId))
      .orderBy(documentComments.createdAt);
  }

  async getOpenCommentsAssignedTo(userId: number): Promise<DocumentComment[]> {
    return await db.select().from(documentComments)
      .where(and(
        eq(documentComments.status, DocumentCommentStatus.OPEN),
        sql`${userId} = ANY(${documentComments.assigneeIds})`
      ))
      .orderBy(documentComments.createdAt);
  }

  async getDocumentComment(id: number): Promise<DocumentComment | undefined> {
    const [comment] = await db.select().from(documentComments).where(eq(documentComments.id, id));
    return comment;
  }

  async createDocumentComment(comment: InsertDocumentComment): Promise<DocumentComment> {
    const [created] = await db.insert(documentComments).values(comment).returning();
    return created;
  }

  async updateDocumentComment(id: number, updates: Partial<InsertDocumentComment>): Promise<DocumentComment> {
    const [updated] = await db.update(documentComments).set(updates).where(eq(documentComments.id, id)).returning();
    return updated;
  }

  async deleteDocumentComment(id: number): Promise<void> {
    await db.delete(documentComments).where(eq(documentComments.id, id));
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

  async getAllUserRecords(): Promise<UserRecord[]> {
    return await db.select().from(userRecords)
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
    // One report is saved once per recipient, so continue from the highest number used (not the row count)
    const [row] = await db.select({
      maxNumber: sql<number | null>`MAX(CAST(SUBSTRING(${userRecords.reportNumber} FROM '[0-9]+$') AS INTEGER))`,
    }).from(userRecords)
      .where(sql`${userRecords.reportNumber} LIKE ${prefix + '-' + year + '-%'}`);
    const nextNumber = Number(row?.maxNumber || 0) + 1;
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

  // Compliance is measured from the task ledger (task_records): tasks completed on time over the
  // last 30 days against those completed late and those still open past their target date
  private async ledgerTaskStats(userId?: number): Promise<{ totalTasks: number; completedTasks: number; overdueTasks: number; score: number }> {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const scope = or(
      eq(taskRecords.status, TaskRecordStatus.OPEN),
      and(eq(taskRecords.status, TaskRecordStatus.COMPLETED), gt(taskRecords.closedAt, since)),
    );
    const rows = await db.select().from(taskRecords)
      .where(userId !== undefined ? and(eq(taskRecords.userId, userId), scope) : scope);

    const completed = rows.filter(r => r.status === TaskRecordStatus.COMPLETED);
    const onTime = completed.filter(r => r.completedOnTime === true).length;
    const late = completed.filter(r => r.completedOnTime === false).length;
    const open = rows.filter(r => r.status === TaskRecordStatus.OPEN);
    const overdue = open.filter(r => r.dueAt && r.dueAt < now).length;

    const measured = onTime + late + overdue;
    const score = measured === 0 ? 100 : Math.max(0, Math.min(100, Math.round((onTime / measured) * 100)));
    return { totalTasks: completed.length + open.length, completedTasks: completed.length, overdueTasks: overdue, score };
  }

  private complianceState(score: number): string {
    if (score >= 90) return BuddyState.FLEXING;
    if (score >= 80) return BuddyState.HEALTHY;
    if (score >= 70) return BuddyState.TIRED;
    if (score >= 60) return BuddyState.WEAK;
    return BuddyState.CRITICAL;
  }

  async calculateUserCompliance(userId: number): Promise<{ score: number; state: string }> {
    const stats = await this.ledgerTaskStats(userId);
    const score = stats.score;
    const state = this.complianceState(score);

    // Update buddy status
    await this.getOrCreateBuddyStatus(userId);
    await this.updateBuddyStatus(userId, {
      complianceScore: score,
      currentState: state,
      totalTasksAssigned: stats.totalTasks,
      tasksCompleted: stats.completedTasks,
      tasksOverdue: stats.overdueTasks,
    });

    return { score, state };
  }

  async getUserTaskStats(userId: number): Promise<{ totalTasks: number; completedTasks: number; overdueTasks: number }> {
    const { totalTasks, completedTasks, overdueTasks } = await this.ledgerTaskStats(userId);
    return { totalTasks, completedTasks, overdueTasks };
  }

  async calculateSystemCompliance(): Promise<{ score: number; state: string }> {
    // All users' tasks combined
    const { score } = await this.ledgerTaskStats();
    return { score, state: this.complianceState(score) };
  }

  async getSystemTaskStats(): Promise<{ totalTasks: number; completedTasks: number; overdueTasks: number }> {
    const { totalTasks, completedTasks, overdueTasks } = await this.ledgerTaskStats();
    return { totalTasks, completedTasks, overdueTasks };
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

  async acknowledgeBuddyDialogue(id: number, userId?: number): Promise<BuddyDialogue | undefined> {
    const [updated] = await db.update(buddyDialogues)
      .set({ isAcknowledged: true, acknowledgedAt: new Date() })
      .where(userId !== undefined ? and(eq(buddyDialogues.id, id), eq(buddyDialogues.userId, userId)) : eq(buddyDialogues.id, id))
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
      const minutesSinceLastHeartbeat = Math.round((now.getTime() - lastHeartbeat.getTime()) / (1000 * 60));
      
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

  // Online and active time for a month, from the activity sessions the client records
  async getActivitySummary(userId: number, month: number, year: number): Promise<{ totalActiveHours: number; totalOnlineHours: number; totalDaysActive: number }> {
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

    return { totalActiveHours, totalOnlineHours, totalDaysActive: uniqueDays };
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

    const { totalActiveHours, totalOnlineHours, totalDaysActive: uniqueDays } = await this.getActivitySummary(userId, month, year);

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

    // Task performance from the task ledger
    const taskMetrics = await computeTaskMetrics(userId, startDate, endDate);

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
      ...reportFieldsFromMetrics(taskMetrics),
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

  // Approval and the User Records entry are saved together: either both are written or neither
  async approveReport(id: number, approverId: number, comments?: string): Promise<MonthlyPerformanceReport | undefined> {
    return await db.transaction(async (tx) => {
      const [updated] = await tx.update(monthlyPerformanceReports)
        .set({
          status: MonthlyReportStatus.APPROVED,
          approverId,
          approvedAt: new Date(),
          approvalComments: comments,
          updatedAt: new Date()
        })
        .where(and(eq(monthlyPerformanceReports.id, id), eq(monthlyPerformanceReports.status, MonthlyReportStatus.PENDING_APPROVAL)))
        .returning();
      if (!updated) return undefined;

      const [reviewer] = updated.reviewerId
        ? await tx.select({ id: users.id, name: users.name, signatureDataUrl: users.signatureDataUrl }).from(users).where(eq(users.id, updated.reviewerId))
        : [];
      const [approver] = await tx.select({ id: users.id, name: users.name, signatureDataUrl: users.signatureDataUrl }).from(users).where(eq(users.id, approverId));
      const period = `${updated.reportYear}-${String(updated.reportMonth).padStart(2, '0')}`;
      await tx.insert(userRecords).values({
        userId: updated.userId,
        reportType: 'monthly_performance',
        reportTitle: `Monthly Performance Report - ${updated.reportMonth}/${updated.reportYear}`,
        reportNumber: `MPR-${period}-${updated.id}`,
        reviewerId: reviewer?.id ?? null,
        reviewerName: reviewer?.name ?? null,
        reviewerSignatureDataUrl: reviewer?.signatureDataUrl ?? null,
        reviewerSignedAt: updated.reviewedAt,
        approverId: approver?.id ?? approverId,
        approverName: approver?.name ?? null,
        approverSignatureDataUrl: approver?.signatureDataUrl ?? null,
        approverSignedAt: updated.approvedAt,
        metadata: JSON.stringify({
          reportId: updated.id,
          reportMonth: updated.reportMonth,
          reportYear: updated.reportYear,
          totalActiveHours: updated.totalActiveHours,
          totalOnlineHours: updated.totalOnlineHours,
          totalDaysActive: updated.totalDaysActive,
          documentsCreated: updated.documentsCreated,
          documentsReviewed: updated.documentsReviewed,
          documentsApproved: updated.documentsApproved,
          tasksAssigned: updated.tasksAssigned,
          tasksCompleted: updated.tasksCompleted,
          tasksCompletedOnTime: updated.tasksCompletedOnTime,
          tasksOverdue: updated.tasksOverdue,
          tasksPending: updated.tasksPending,
          onTimeRate: updated.onTimeRate,
          completionRate: updated.completionRate,
          performanceScore: updated.performanceScore,
          reviewComments: updated.reviewComments,
          approvalComments: updated.approvalComments,
        }),
      });
      return updated;
    });
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

  async updateLiveReportStats(userId: number, updateType: 'task_completed' | 'document_created' | 'document_reviewed' | 'document_approved'): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    // Find existing report for this month
    const [existingReport] = await db.select().from(monthlyPerformanceReports)
      .where(and(
        eq(monthlyPerformanceReports.userId, userId),
        eq(monthlyPerformanceReports.reportMonth, month),
        eq(monthlyPerformanceReports.reportYear, year)
      ));
    
    if (!existingReport) {
      // No report exists for this month yet - will be generated later
      return;
    }
    
    // Only update draft reports (don't modify in-review or approved reports)
    if (existingReport.status !== MonthlyReportStatus.DRAFT) {
      return;
    }
    
    // Recalculate task statistics for this user
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    // Get all documents
    const allDocs = await this.getDocuments();
    const userDocs = allDocs.filter(doc => doc.createdById === userId);
    
    const documentsCreated = userDocs.filter(doc =>
      doc.createdAt && doc.createdAt >= startDate && doc.createdAt <= endDate
    ).length;
    
    const documentsReviewed = allDocs.filter(doc =>
      doc.reviewerId === userId &&
      doc.reviewedBySignedAt && 
      new Date(doc.reviewedBySignedAt) >= startDate && 
      new Date(doc.reviewedBySignedAt) <= endDate
    ).length;
    
    const documentsApproved = allDocs.filter(doc =>
      doc.approverId === userId &&
      doc.approvedAt && 
      new Date(doc.approvedAt) >= startDate && 
      new Date(doc.approvedAt) <= endDate
    ).length;

    // Task figures are filled from the task ledger (see task-ledger.ts)
    // Update the report with live stats
    await db.update(monthlyPerformanceReports)
      .set({ 
        documentsCreated,
        documentsReviewed,
        documentsApproved,
        updatedAt: new Date()
      })
      .where(eq(monthlyPerformanceReports.id, existingReport.id));
  }

  // Bug Reports
  async getBugReports(filters?: { status?: string; reportedById?: number; involvingUserId?: number }): Promise<BugReport[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(bugReports.status, filters.status));
    }
    if (filters?.reportedById) {
      conditions.push(eq(bugReports.reportedById, filters.reportedById));
    }
    // Reported by or assigned to this user
    if (filters?.involvingUserId) {
      conditions.push(or(eq(bugReports.reportedById, filters.involvingUserId), eq(bugReports.assignedToId, filters.involvingUserId))!);
    }
    return db.select().from(bugReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bugReports.createdAt));
  }

  async getBugReport(id: number): Promise<BugReport | undefined> {
    const [report] = await db.select().from(bugReports).where(eq(bugReports.id, id));
    return report;
  }

  async createBugReport(data: Omit<InsertBugReport, 'ticketNumber'>): Promise<BugReport> {
    // Next ticket number after the highest one issued, so deleted tickets never cause a clash
    const [{ maxNumber }] = await db.select({
      maxNumber: sql<number>`coalesce(max(nullif(regexp_replace(${bugReports.ticketNumber}, '[^0-9]', '', 'g'), '')::int), 0)`,
    }).from(bugReports);
    const ticketNumber = `BUG-${String(Number(maxNumber) + 1).padStart(4, '0')}`;
    
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

  async resolveBugReport(id: number, resolvedById: number, resolutionNotes: string, resolutionEvidenceUrl?: string): Promise<BugReport> {
    const [updated] = await db.update(bugReports)
      .set({
        status: BugReportStatus.RESOLVED,
        resolvedById,
        resolutionNotes,
        resolutionEvidenceUrl: resolutionEvidenceUrl || null,
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

  // ============================================
  // CERTIFICATION APPLICATIONS
  // ============================================
  async getCertificationApplications(filters?: { status?: string; assignedAuditorId?: number }): Promise<CertificationApplication[]> {
    let query = db.select().from(certificationApplications).orderBy(desc(certificationApplications.createdAt));
    
    if (filters?.status) {
      query = query.where(eq(certificationApplications.status, filters.status)) as typeof query;
    }
    if (filters?.assignedAuditorId) {
      query = query.where(eq(certificationApplications.assignedAuditorId, filters.assignedAuditorId)) as typeof query;
    }
    
    return query;
  }

  async getCertificationApplication(id: number): Promise<CertificationApplication | undefined> {
    const [app] = await db.select().from(certificationApplications).where(eq(certificationApplications.id, id));
    return app;
  }

  async createCertificationApplication(data: InsertCertificationApplication): Promise<CertificationApplication> {
    // Next number after the highest one this year (a count would repeat numbers after a delete)
    const prefix = `APP-${new Date().getFullYear()}-`;
    for (let attempt = 0; ; attempt++) {
      const [{ max }] = await db.select({
        max: sql<number>`coalesce(max(cast(substring(${certificationApplications.applicationNumber} from '[0-9]+$') as integer)), 0)`,
      }).from(certificationApplications)
        .where(sql`${certificationApplications.applicationNumber} like ${prefix + '%'}`);
      const appNumber = `${prefix}${String(Number(max) + 1).padStart(4, '0')}`;
      try {
        const [app] = await db.insert(certificationApplications).values({
          ...data,
          applicationNumber: appNumber,
        }).returning();
        return app;
      } catch (err: any) {
        // another application took the same number at the same moment: try the next one
        if (err?.code !== '23505' || attempt >= 4) throw err;
      }
    }
  }

  async updateCertificationApplication(id: number, data: Partial<InsertCertificationApplication>): Promise<CertificationApplication> {
    const [updated] = await db.update(certificationApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(certificationApplications.id, id))
      .returning();
    return updated;
  }

  async deleteCertificationApplication(id: number): Promise<void> {
    await db.delete(certificationApplications).where(eq(certificationApplications.id, id));
  }

  // ============================================
  // CERTIFICATION AUDITS
  // ============================================
  async getCertificationAudits(applicationId?: number): Promise<CertificationAudit[]> {
    if (applicationId) {
      return db.select().from(certificationAudits)
        .where(eq(certificationAudits.applicationId, applicationId))
        .orderBy(desc(certificationAudits.scheduledDate));
    }
    return db.select().from(certificationAudits).orderBy(desc(certificationAudits.scheduledDate));
  }

  async getCertificationAudit(id: number): Promise<CertificationAudit | undefined> {
    const [audit] = await db.select().from(certificationAudits).where(eq(certificationAudits.id, id));
    return audit;
  }

  async createCertificationAudit(data: InsertCertificationAudit): Promise<CertificationAudit> {
    const [audit] = await db.insert(certificationAudits).values(data).returning();
    return audit;
  }

  async updateCertificationAudit(id: number, data: Partial<InsertCertificationAudit>): Promise<CertificationAudit> {
    const [updated] = await db.update(certificationAudits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(certificationAudits.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // AUDIT FINDINGS
  // ============================================
  async getAuditFindings(auditId?: number): Promise<AuditFinding[]> {
    if (auditId) {
      return db.select().from(auditFindings)
        .where(eq(auditFindings.auditId, auditId))
        .orderBy(desc(auditFindings.createdAt));
    }
    return db.select().from(auditFindings).orderBy(desc(auditFindings.createdAt));
  }

  async getAuditFinding(id: number): Promise<AuditFinding | undefined> {
    const [finding] = await db.select().from(auditFindings).where(eq(auditFindings.id, id));
    return finding;
  }

  async createAuditFinding(data: InsertAuditFinding): Promise<AuditFinding> {
    const [finding] = await db.insert(auditFindings).values(data).returning();
    return finding;
  }

  async updateAuditFinding(id: number, data: Partial<InsertAuditFinding>): Promise<AuditFinding> {
    const [updated] = await db.update(auditFindings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(auditFindings.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // CERTIFICATES
  // ============================================
  async getCertificates(filters?: { applicationId?: number; status?: string }): Promise<Certificate[]> {
    let query = db.select().from(certificates).orderBy(desc(certificates.createdAt));
    
    if (filters?.applicationId) {
      query = query.where(eq(certificates.applicationId, filters.applicationId)) as typeof query;
    }
    if (filters?.status) {
      query = query.where(eq(certificates.status, filters.status)) as typeof query;
    }
    
    return query;
  }

  async getCertificate(id: number): Promise<Certificate | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
    return cert;
  }

  async getCertificateByNumber(certificateNumber: string): Promise<Certificate | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.certificateNumber, certificateNumber));
    return cert;
  }

  async createCertificate(data: InsertCertificate): Promise<Certificate> {
    const [cert] = await db.insert(certificates).values(data).returning();
    return cert;
  }

  async updateCertificate(id: number, data: Partial<InsertCertificate>): Promise<Certificate> {
    const [updated] = await db.update(certificates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(certificates.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // WALL POSTS
  // ============================================
  async getWallPosts(limit: number = 50): Promise<Array<WallPost & { authorName: string; authorRole: string }>> {
    const posts = await db.select({
      id: wallPosts.id,
      authorId: wallPosts.authorId,
      content: wallPosts.content,
      isPinned: wallPosts.isPinned,
      createdAt: wallPosts.createdAt,
      updatedAt: wallPosts.updatedAt,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(wallPosts)
    .leftJoin(users, eq(wallPosts.authorId, users.id))
    .orderBy(desc(wallPosts.isPinned), desc(wallPosts.createdAt))
    .limit(limit);
    
    return posts.map(p => ({
      ...p,
      authorName: p.authorName || 'Unknown',
      authorRole: p.authorRole || 'staff',
    }));
  }

  async getWallPost(id: number): Promise<WallPost | undefined> {
    const [post] = await db.select().from(wallPosts).where(eq(wallPosts.id, id));
    return post;
  }

  async createWallPost(data: InsertWallPost): Promise<WallPost> {
    const [post] = await db.insert(wallPosts).values(data).returning();
    return post;
  }

  async updateWallPost(id: number, data: Partial<InsertWallPost>): Promise<WallPost> {
    const [updated] = await db.update(wallPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(wallPosts.id, id))
      .returning();
    return updated;
  }

  async deleteWallPost(id: number): Promise<void> {
    await db.delete(wallPosts).where(eq(wallPosts.id, id));
  }

  async pinWallPost(id: number, isPinned: boolean): Promise<WallPost> {
    const [updated] = await db.update(wallPosts)
      .set({ isPinned, updatedAt: new Date() })
      .where(eq(wallPosts.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // REVISION HISTORY
  // ============================================
  async getRevisionHistory(documentId: number): Promise<RevisionHistory[]> {
    return db.select()
      .from(revisionHistory)
      .where(eq(revisionHistory.documentId, documentId))
      .orderBy(desc(revisionHistory.revisionNumber));
  }

  async getRevisionHistoryById(id: number): Promise<RevisionHistory | undefined> {
    const [entry] = await db.select()
      .from(revisionHistory)
      .where(eq(revisionHistory.id, id));
    return entry;
  }

  async createRevisionHistory(entry: InsertRevisionHistory): Promise<RevisionHistory> {
    const [created] = await db.insert(revisionHistory).values(entry).returning();
    return created;
  }

  async updateRevisionHistory(id: number, updates: Partial<InsertRevisionHistory>): Promise<RevisionHistory> {
    const [updated] = await db.update(revisionHistory)
      .set(updates)
      .where(eq(revisionHistory.id, id))
      .returning();
    return updated;
  }

  async deleteRevisionHistory(id: number): Promise<void> {
    await db.delete(revisionHistory).where(eq(revisionHistory.id, id));
  }

  // ============================================
  // TRAININGS
  // ============================================
  async getTrainings(): Promise<Training[]> {
    return db.select().from(trainings).orderBy(desc(trainings.createdAt));
  }

  async getTraining(id: number): Promise<Training | undefined> {
    const [training] = await db.select().from(trainings).where(eq(trainings.id, id));
    return training;
  }

  async createTraining(data: InsertTraining): Promise<Training> {
    const [training] = await db.insert(trainings).values(data).returning();
    return training;
  }

  async updateTraining(id: number, data: Partial<InsertTraining>): Promise<Training> {
    const [updated] = await db.update(trainings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trainings.id, id))
      .returning();
    return updated;
  }

  async deleteTraining(id: number): Promise<void> {
    await db.delete(trainings).where(eq(trainings.id, id));
  }

  // ============================================
  // TRAINING ASSIGNMENTS
  // ============================================
  async getTrainingAssignments(filters?: { employeeId?: number; trainingId?: number }): Promise<TrainingAssignment[]> {
    let query = db.select().from(trainingAssignments);
    
    if (filters?.employeeId) {
      query = query.where(eq(trainingAssignments.employeeId, filters.employeeId)) as any;
    }
    if (filters?.trainingId) {
      query = query.where(eq(trainingAssignments.trainingId, filters.trainingId)) as any;
    }
    
    return query.orderBy(desc(trainingAssignments.createdAt));
  }

  async getTrainingAssignment(id: number): Promise<TrainingAssignment | undefined> {
    const [assignment] = await db.select().from(trainingAssignments).where(eq(trainingAssignments.id, id));
    return assignment;
  }

  async createTrainingAssignment(data: InsertTrainingAssignment): Promise<TrainingAssignment> {
    const [assignment] = await db.insert(trainingAssignments).values(data).returning();
    return assignment;
  }

  async updateTrainingAssignment(id: number, data: Partial<InsertTrainingAssignment>): Promise<TrainingAssignment> {
    const [updated] = await db.update(trainingAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trainingAssignments.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingAssignment(id: number): Promise<void> {
    await db.delete(trainingAssignments).where(eq(trainingAssignments.id, id));
  }

  // ============================================
  // TRAINING COMPLETIONS
  // ============================================
  async getTrainingCompletions(filters?: { employeeId?: number; trainingId?: number }): Promise<TrainingCompletion[]> {
    let query = db.select().from(trainingCompletions);
    
    if (filters?.employeeId) {
      query = query.where(eq(trainingCompletions.employeeId, filters.employeeId)) as any;
    }
    if (filters?.trainingId) {
      query = query.where(eq(trainingCompletions.trainingId, filters.trainingId)) as any;
    }
    
    return query.orderBy(desc(trainingCompletions.completionDate));
  }

  async getTrainingCompletion(id: number): Promise<TrainingCompletion | undefined> {
    const [completion] = await db.select().from(trainingCompletions).where(eq(trainingCompletions.id, id));
    return completion;
  }

  async createTrainingCompletion(data: InsertTrainingCompletion): Promise<TrainingCompletion> {
    const [completion] = await db.insert(trainingCompletions).values(data).returning();
    return completion;
  }

  async updateTrainingCompletion(id: number, data: Partial<InsertTrainingCompletion>): Promise<TrainingCompletion> {
    const [updated] = await db.update(trainingCompletions)
      .set(data)
      .where(eq(trainingCompletions.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingCompletion(id: number): Promise<void> {
    await db.delete(trainingCompletions).where(eq(trainingCompletions.id, id));
  }

  // ============================================
  // DOCUGENIE FORMS
  // ============================================
  async getDocuGenieForms(filters?: { status?: string; createdById?: number }): Promise<DocuGenieForm[]> {
    let query = db.select().from(docugenieForms);
    
    if (filters?.status) {
      query = query.where(eq(docugenieForms.status, filters.status)) as any;
    }
    if (filters?.createdById) {
      query = query.where(eq(docugenieForms.createdById, filters.createdById)) as any;
    }
    
    return query.orderBy(desc(docugenieForms.createdAt));
  }

  async getDocuGenieForm(id: number): Promise<DocuGenieForm | undefined> {
    const [form] = await db.select().from(docugenieForms).where(eq(docugenieForms.id, id));
    return form;
  }

  async getDocuGenieFormByToken(token: string): Promise<DocuGenieForm | undefined> {
    const [form] = await db.select().from(docugenieForms).where(eq(docugenieForms.shareToken, token));
    return form;
  }

  async createDocuGenieForm(form: InsertDocuGenieForm): Promise<DocuGenieForm> {
    const [created] = await db.insert(docugenieForms).values(form).returning();
    return created;
  }

  async updateDocuGenieForm(id: number, form: Partial<InsertDocuGenieForm>): Promise<DocuGenieForm> {
    const [updated] = await db.update(docugenieForms)
      .set({ ...form, updatedAt: new Date() })
      .where(eq(docugenieForms.id, id))
      .returning();
    return updated;
  }

  async deleteDocuGenieForm(id: number): Promise<void> {
    await db.delete(docugenieFormSubmissions).where(eq(docugenieFormSubmissions.formId, id));
    await db.delete(docugenieForms).where(eq(docugenieForms.id, id));
  }

  // ============================================
  // DOCUGENIE FORM SUBMISSIONS
  // ============================================
  async getDocuGenieFormSubmissions(formId: number): Promise<DocuGenieFormSubmission[]> {
    return db.select().from(docugenieFormSubmissions)
      .where(eq(docugenieFormSubmissions.formId, formId))
      .orderBy(desc(docugenieFormSubmissions.submittedAt));
  }

  async getDocuGenieFormSubmission(id: number): Promise<DocuGenieFormSubmission | undefined> {
    const [submission] = await db.select().from(docugenieFormSubmissions).where(eq(docugenieFormSubmissions.id, id));
    return submission;
  }

  async createDocuGenieFormSubmission(submission: InsertDocuGenieFormSubmission): Promise<DocuGenieFormSubmission> {
    const [created] = await db.insert(docugenieFormSubmissions).values(submission).returning();
    return created;
  }

  // ============================================
  // CRM - LEADS
  // ============================================
  async getLeads(filters?: { status?: string; assignedToId?: number }): Promise<Lead[]> {
    let query = db.select().from(leads);
    
    if (filters?.status) {
      query = query.where(eq(leads.leadStatus, filters.status)) as any;
    }
    if (filters?.assignedToId) {
      query = query.where(eq(leads.assignedToId, filters.assignedToId)) as any;
    }
    
    return query.orderBy(desc(leads.createdAt));
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await db.update(leads)
      .set({ ...lead, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async deleteLead(id: number): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  // ============================================
  // CRM - LEAD STATUS HISTORY
  // ============================================
  async getLeadStatusHistory(leadId: number): Promise<Array<LeadStatusHistory & { changedByName: string }>> {
    const result = await db
      .select({
        id: leadStatusHistory.id,
        leadId: leadStatusHistory.leadId,
        previousStatus: leadStatusHistory.previousStatus,
        newStatus: leadStatusHistory.newStatus,
        reason: leadStatusHistory.reason,
        evidenceUrl: leadStatusHistory.evidenceUrl,
        evidenceFileName: leadStatusHistory.evidenceFileName,
        changedById: leadStatusHistory.changedById,
        changedAt: leadStatusHistory.changedAt,
        changedByName: users.name,
      })
      .from(leadStatusHistory)
      .leftJoin(users, eq(leadStatusHistory.changedById, users.id))
      .where(eq(leadStatusHistory.leadId, leadId))
      .orderBy(desc(leadStatusHistory.changedAt));
    
    return result.map(r => ({
      ...r,
      changedByName: r.changedByName || 'Unknown',
    }));
  }

  async createLeadStatusHistory(entry: InsertLeadStatusHistory): Promise<LeadStatusHistory> {
    const [result] = await db.insert(leadStatusHistory).values(entry).returning();
    return result;
  }

  // ============================================
  // CRM - LEAD UPDATE REQUESTS
  // ============================================
  async getLeadUpdateRequests(leadId: number): Promise<Array<LeadUpdateRequest & { requestedByName: string; requestedFromName: string }>> {
    const requestedByUser = db.select({ id: users.id, name: users.name }).from(users).as('requestedByUser');
    const requestedFromUser = db.select({ id: users.id, name: users.name }).from(users).as('requestedFromUser');
    
    const result = await db
      .select({
        id: leadUpdateRequests.id,
        leadId: leadUpdateRequests.leadId,
        requestedById: leadUpdateRequests.requestedById,
        requestedFromId: leadUpdateRequests.requestedFromId,
        message: leadUpdateRequests.message,
        isResolved: leadUpdateRequests.isResolved,
        resolvedAt: leadUpdateRequests.resolvedAt,
        response: leadUpdateRequests.response,
        respondedAt: leadUpdateRequests.respondedAt,
        createdAt: leadUpdateRequests.createdAt,
        requestedByName: sql<string>`(SELECT name FROM users WHERE id = ${leadUpdateRequests.requestedById})`,
        requestedFromName: sql<string>`(SELECT name FROM users WHERE id = ${leadUpdateRequests.requestedFromId})`,
      })
      .from(leadUpdateRequests)
      .where(eq(leadUpdateRequests.leadId, leadId))
      .orderBy(desc(leadUpdateRequests.createdAt));
    
    return result.map(r => ({
      ...r,
      requestedByName: r.requestedByName || 'Unknown',
      requestedFromName: r.requestedFromName || 'Unknown',
    }));
  }

  async getPendingLeadUpdateRequests(userId: number): Promise<Array<LeadUpdateRequest & { leadName: string; requestedByName: string }>> {
    const result = await db
      .select({
        id: leadUpdateRequests.id,
        leadId: leadUpdateRequests.leadId,
        requestedById: leadUpdateRequests.requestedById,
        requestedFromId: leadUpdateRequests.requestedFromId,
        message: leadUpdateRequests.message,
        isResolved: leadUpdateRequests.isResolved,
        resolvedAt: leadUpdateRequests.resolvedAt,
        response: leadUpdateRequests.response,
        respondedAt: leadUpdateRequests.respondedAt,
        createdAt: leadUpdateRequests.createdAt,
        leadName: leads.leadName,
        requestedByName: sql<string>`(SELECT name FROM users WHERE id = ${leadUpdateRequests.requestedById})`,
      })
      .from(leadUpdateRequests)
      .leftJoin(leads, eq(leadUpdateRequests.leadId, leads.id))
      .where(and(
        eq(leadUpdateRequests.requestedFromId, userId),
        eq(leadUpdateRequests.isResolved, false)
      ))
      .orderBy(desc(leadUpdateRequests.createdAt));
    
    return result.map(r => ({
      ...r,
      leadName: r.leadName || 'Unknown Lead',
      requestedByName: r.requestedByName || 'Unknown',
    }));
  }

  async createLeadUpdateRequest(request: InsertLeadUpdateRequest): Promise<LeadUpdateRequest> {
    const [result] = await db.insert(leadUpdateRequests).values(request).returning();
    return result;
  }

  async getLeadUpdateRequest(id: number): Promise<LeadUpdateRequest | undefined> {
    const [result] = await db.select().from(leadUpdateRequests).where(eq(leadUpdateRequests.id, id));
    return result;
  }

  async resolveLeadUpdateRequest(id: number, response?: string | null): Promise<LeadUpdateRequest | undefined> {
    const now = new Date();
    const [result] = await db
      .update(leadUpdateRequests)
      .set({ isResolved: true, resolvedAt: now, response: response ?? null, respondedAt: response ? now : null })
      .where(eq(leadUpdateRequests.id, id))
      .returning();
    return result;
  }

  // ============================================
  // CRM - CUSTOMERS
  // ============================================
  async getCustomers(filters?: { accountOwnerId?: number }): Promise<Customer[]> {
    let query = db.select().from(customers);
    
    if (filters?.accountOwnerId) {
      query = query.where(eq(customers.accountOwnerId, filters.accountOwnerId)) as any;
    }
    
    return query.orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  async deleteCustomer(id: number): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // ============================================
  // CRM - OPPORTUNITIES
  // ============================================
  async getOpportunities(filters?: { stage?: string; customerId?: number }): Promise<Opportunity[]> {
    let query = db.select().from(opportunities);
    
    if (filters?.stage) {
      query = query.where(eq(opportunities.stage, filters.stage)) as any;
    }
    if (filters?.customerId) {
      query = query.where(eq(opportunities.customerId, filters.customerId)) as any;
    }
    
    return query.orderBy(desc(opportunities.createdAt));
  }

  async getOpportunity(id: number): Promise<Opportunity | undefined> {
    const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    return opportunity;
  }

  async createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity> {
    const [created] = await db.insert(opportunities).values(opportunity).returning();
    return created;
  }

  async updateOpportunity(id: number, opportunity: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const [updated] = await db.update(opportunities)
      .set({ ...opportunity, updatedAt: new Date() })
      .where(eq(opportunities.id, id))
      .returning();
    return updated;
  }

  async deleteOpportunity(id: number): Promise<void> {
    await db.delete(opportunities).where(eq(opportunities.id, id));
  }

  // ============================================
  // HISTORICAL PERFORMANCE DATA
  // ============================================
  async getHistoricalData(filters?: { year?: number }): Promise<HistoricalData[]> {
    let query = db.select().from(historicalData);
    
    if (filters?.year) {
      query = query.where(eq(historicalData.year, filters.year)) as any;
    }
    
    return query.orderBy(desc(historicalData.year), desc(historicalData.createdAt));
  }

  async getHistoricalDataEntry(id: number): Promise<HistoricalData | undefined> {
    const [entry] = await db.select().from(historicalData).where(eq(historicalData.id, id));
    return entry;
  }

  async createHistoricalData(data: InsertHistoricalData): Promise<HistoricalData> {
    const [created] = await db.insert(historicalData).values(data).returning();
    return created;
  }

  async updateHistoricalData(id: number, data: Partial<InsertHistoricalData>): Promise<HistoricalData | undefined> {
    const [updated] = await db.update(historicalData)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(historicalData.id, id))
      .returning();
    return updated;
  }

  async deleteHistoricalData(id: number): Promise<void> {
    await db.delete(historicalData).where(eq(historicalData.id, id));
  }
}

export const storage = new DatabaseStorage();
