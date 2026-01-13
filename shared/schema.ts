import { pgTable, text, serial, timestamp, boolean, integer, varchar } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ENUMS
// ============================================
export const UserRole = {
  ADMIN: "admin",
  QUALITY_MANAGER: "quality_manager",
  DEPARTMENT_HEAD: "department_head",
  STAFF: "staff",
  AUDITOR: "auditor",
} as const;

export const InductionStatus = {
  PENDING: "pending",
  COMPLETED: "completed",
} as const;

export const DocumentCategory = {
  POLICY: "policy",
  MANUAL: "manual",
  SOP: "sop",
  FORMAT: "format",
} as const;

export const DocumentStatus = {
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  OBSOLETE: "obsolete",
} as const;

export const UrgencyLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export const AuditAction = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  SUBMIT_FOR_REVIEW: "submit_for_review",
  APPROVE: "approve",
  REJECT: "reject",
  PUBLISH: "publish",
  ARCHIVE: "archive",
  ASSIGN_TASK: "assign_task",
  COMPLETE_TASK: "complete_task",
} as const;

export const EmploymentType = {
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
  CONTRACT: "contract",
  PROBATION: "probation",
} as const;

export const EmployeeStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ON_LEAVE: "on_leave",
  TERMINATED: "terminated",
} as const;

export const EmployeeRecordStatus = {
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const TaskStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;

export const TaskPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export const SignatoryRole = {
  PREPARED_BY: "prepared_by",
  REVIEWED_BY: "reviewed_by",
  APPROVED_BY: "approved_by",
} as const;

export const DownloadRequestStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const FeedbackStatus = {
  PENDING: "pending",
  ADDRESSED: "addressed",
  DISMISSED: "dismissed",
} as const;

export const FeedbackType = {
  COMMENT: "comment",
  CORRECTION: "correction",
  SUGGESTION: "suggestion",
} as const;

export const DocumentTaskType = {
  PREPARE: "prepare",
  REVIEW: "review",
  APPROVE: "approve",
} as const;

export const DocumentTaskStatus = {
  PENDING: "pending",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  OVERDUE: "overdue",
} as const;

export const DocumentImportance = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

// ============================================
// USERS TABLE
// ============================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default(UserRole.STAFF),
  inductionStatus: text("induction_status").notNull().default(InductionStatus.PENDING),
  isActive: boolean("is_active").default(true),
  signatureDataUrl: text("signature_data_url"),
  dateJoined: timestamp("date_joined").defaultNow(),
  lastLogin: timestamp("last_login"),
});

// ============================================
// DOCUMENTS TABLE
// ============================================
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  documentCode: text("document_code").notNull().unique(), // e.g., SOP-001, POL-002
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default(DocumentCategory.SOP),
  content: text("content"), // Document content or file URL
  fileUrl: text("file_url"),
  versionNumber: text("version_number").notNull().default("1.0"),
  editionNumber: integer("edition_number").notNull().default(1),
  revisionNumber: integer("revision_number").notNull().default(0),
  status: text("status").notNull().default(DocumentStatus.DRAFT),
  importance: text("importance").notNull().default(DocumentImportance.MEDIUM),
  createdById: integer("created_by_id").notNull(),
  reviewerId: integer("reviewer_id"),
  approverId: integer("approver_id"),
  approvedAt: timestamp("approved_at"),
  nextReviewDate: timestamp("next_review_date"),
  requiresPreparedBy: boolean("requires_prepared_by").default(true),
  requiresReviewedBy: boolean("requires_reviewed_by").default(false),
  requiresApprovedBy: boolean("requires_approved_by").default(true),
  preparedById: integer("prepared_by_id"),
  preparedBySignedAt: timestamp("prepared_by_signed_at"),
  preparerConfirmedAt: timestamp("preparer_confirmed_at"),
  reviewedById: integer("reviewed_by_id"),
  reviewedBySignedAt: timestamp("reviewed_by_signed_at"),
  approvedById: integer("approved_by_id"),
  approvedBySignedAt: timestamp("approved_by_signed_at"),
  finalPdfUrl: text("final_pdf_url"),
  finalPdfGeneratedAt: timestamp("final_pdf_generated_at"),
  downloadRequiresApproval: boolean("download_requires_approval").default(true),
  assignedStaffIds: integer("assigned_staff_ids").array(),
  assignedDepartments: text("assigned_departments").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// DOCUMENT TASKS (Sequential Workflow Tracking)
// ============================================
export const documentTasks = pgTable("document_tasks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  taskNumber: text("task_number").notNull(), // e.g., TASK-001
  taskType: text("task_type").notNull(), // prepare, review, approve
  assignedToId: integer("assigned_to_id").notNull(),
  assignedById: integer("assigned_by_id").notNull(),
  status: text("status").notNull().default(DocumentTaskStatus.PENDING),
  targetDate: timestamp("target_date"), // Nullable for approval tasks (set when review completes)
  targetHours: integer("target_hours").notNull().default(24),
  assignedAt: timestamp("assigned_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  actualHours: integer("actual_hours"),
  earlyHours: integer("early_hours").default(0),
  delayHours: integer("delay_hours").default(0),
  performancePoints: integer("performance_points").default(0),
  isVisible: boolean("is_visible").default(false), // Only visible when it's their turn
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// DOCUMENT VERSIONS (Archive)
// ============================================
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  versionNumber: text("version_number").notNull(),
  editionNumber: integer("edition_number").notNull().default(1),
  revisionNumber: integer("revision_number").notNull().default(0),
  content: text("content"),
  fileUrl: text("file_url"),
  pdfUrl: text("pdf_url"),
  approvedById: integer("approved_by_id"),
  archivedAt: timestamp("archived_at").defaultNow(),
});

// ============================================
// DOCUMENT FEEDBACK (Review Comments & Corrections)
// ============================================
export const documentFeedback = pgTable("document_feedback", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  authorId: integer("author_id").notNull(), // Who wrote the feedback
  feedbackType: text("feedback_type").notNull().default(FeedbackType.COMMENT),
  content: text("content").notNull(),
  status: text("status").notNull().default(FeedbackStatus.PENDING),
  role: text("role").notNull(), // 'reviewer' or 'approver'
  createdAt: timestamp("created_at").defaultNow(),
  addressedAt: timestamp("addressed_at"),
});

// ============================================
// DOWNLOAD REQUESTS
// ============================================
export const downloadRequests = pgTable("download_requests", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  requesterId: integer("requester_id").notNull(),
  status: text("status").notNull().default(DownloadRequestStatus.PENDING),
  decidedById: integer("decided_by_id"),
  decidedAt: timestamp("decided_at"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// DOCUMENT ACCESS REQUESTS
// ============================================
export const DocumentAccessRequestStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const documentAccessRequests = pgTable("document_access_requests", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  requesterId: integer("requester_id").notNull(),
  status: text("status").notNull().default(DocumentAccessRequestStatus.PENDING),
  requestReason: text("request_reason"),
  decidedById: integer("decided_by_id"),
  decidedAt: timestamp("decided_at"),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// DOCUMENT ACCESS (Who has access to view approved documents)
// ============================================
export const documentAccess = pgTable("document_access", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  userId: integer("user_id").notNull(),
  grantedById: integer("granted_by_id").notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  isRevoked: boolean("is_revoked").default(false),
});

// ============================================
// TASK POKES (Buzz/Reminder Notifications)
// ============================================
export const taskPokes = pgTable("task_pokes", {
  id: serial("id").primaryKey(),
  documentTaskId: integer("document_task_id").notNull(),
  pokedById: integer("poked_by_id").notNull(),
  pokedUserId: integer("poked_user_id").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// WORKFLOW LOGS
// ============================================
export const workflowLogs = pgTable("workflow_logs", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  assignedToId: integer("assigned_to_id"),
  actionById: integer("action_by_id").notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// NOTIFICATIONS
// ============================================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  urgencyLevel: text("urgency_level").notNull().default(UrgencyLevel.LOW),
  isRead: boolean("is_read").default(false),
  relatedDocumentId: integer("related_document_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// AUDIT LOGS (ISO 17021 Compliance)
// ============================================
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(), // 'document', 'user', etc.
  entityId: integer("entity_id"),
  previousValue: text("previous_value"), // JSON string of old values
  newValue: text("new_value"), // JSON string of new values
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// EMPLOYEES TABLE (HR Department)
// ============================================
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeNumber: text("employee_number").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  jobTitle: text("job_title").notNull(),
  department: text("department").notNull(),
  employmentType: text("employment_type").notNull().default(EmploymentType.FULL_TIME),
  supervisorId: integer("supervisor_id"),
  hireDate: timestamp("hire_date").notNull(),
  status: text("status").notNull().default(EmployeeStatus.ACTIVE),
  workflowStatus: text("workflow_status").notNull().default(EmployeeRecordStatus.DRAFT),
  userId: integer("user_id"),
  createdByUserId: integer("created_by_user_id"),
  reviewerId: integer("reviewer_id"),
  approverId: integer("approver_id"),
  submittedForReviewAt: timestamp("submitted_for_review_at"),
  reviewedAt: timestamp("reviewed_at"),
  submittedForApprovalAt: timestamp("submitted_for_approval_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectedById: integer("rejected_by_id"),
  workflowNotes: text("workflow_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// EMPLOYEE TASKS (Document-Employee Linking)
// ============================================
export const employeeTasks = pgTable("employee_tasks", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  documentId: integer("document_id"),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default(TaskStatus.PENDING),
  priority: text("priority").notNull().default(TaskPriority.MEDIUM),
  notes: text("notes"),
  assignedByUserId: integer("assigned_by_user_id").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// RELATIONS
// ============================================
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  createdBy: one(users, { fields: [documents.createdById], references: [users.id] }),
  reviewer: one(users, { fields: [documents.reviewerId], references: [users.id] }),
  approver: one(users, { fields: [documents.approverId], references: [users.id] }),
  versions: many(documentVersions),
  workflowLogs: many(workflowLogs),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, { fields: [documentVersions.documentId], references: [documents.id] }),
  approvedBy: one(users, { fields: [documentVersions.approvedById], references: [users.id] }),
}));

export const workflowLogsRelations = relations(workflowLogs, ({ one }) => ({
  document: one(documents, { fields: [workflowLogs.documentId], references: [documents.id] }),
  assignedTo: one(users, { fields: [workflowLogs.assignedToId], references: [users.id] }),
  actionBy: one(users, { fields: [workflowLogs.actionById], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  relatedDocument: one(documents, { fields: [notifications.relatedDocumentId], references: [documents.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  supervisor: one(employees, { fields: [employees.supervisorId], references: [employees.id] }),
  tasks: many(employeeTasks),
}));

export const employeeTasksRelations = relations(employeeTasks, ({ one }) => ({
  employee: one(employees, { fields: [employeeTasks.employeeId], references: [employees.id] }),
  document: one(documents, { fields: [employeeTasks.documentId], references: [documents.id] }),
  assignedBy: one(users, { fields: [employeeTasks.assignedByUserId], references: [users.id] }),
}));

export const downloadRequestsRelations = relations(downloadRequests, ({ one }) => ({
  document: one(documents, { fields: [downloadRequests.documentId], references: [documents.id] }),
  requester: one(users, { fields: [downloadRequests.requesterId], references: [users.id] }),
  decidedBy: one(users, { fields: [downloadRequests.decidedById], references: [users.id] }),
}));

export const documentFeedbackRelations = relations(documentFeedback, ({ one }) => ({
  document: one(documents, { fields: [documentFeedback.documentId], references: [documents.id] }),
  author: one(users, { fields: [documentFeedback.authorId], references: [users.id] }),
}));

export const documentTasksRelations = relations(documentTasks, ({ one, many }) => ({
  document: one(documents, { fields: [documentTasks.documentId], references: [documents.id] }),
  assignedTo: one(users, { fields: [documentTasks.assignedToId], references: [users.id] }),
  assignedBy: one(users, { fields: [documentTasks.assignedById], references: [users.id] }),
  pokes: many(taskPokes),
}));

export const taskPokesRelations = relations(taskPokes, ({ one }) => ({
  documentTask: one(documentTasks, { fields: [taskPokes.documentTaskId], references: [documentTasks.id] }),
  pokedBy: one(users, { fields: [taskPokes.pokedById], references: [users.id] }),
  pokedUser: one(users, { fields: [taskPokes.pokedUserId], references: [users.id] }),
}));

// ============================================
// INSERT SCHEMAS
// ============================================
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  dateJoined: true, 
  lastLogin: true 
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  approvedAt: true,
});

export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({ 
  id: true, 
  archivedAt: true 
});

export const insertWorkflowLogSchema = createInsertSchema(workflowLogs).omit({ 
  id: true, 
  createdAt: true 
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ 
  id: true, 
  createdAt: true 
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ 
  id: true, 
  createdAt: true 
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeTaskSchema = createInsertSchema(employeeTasks).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertDownloadRequestSchema = createInsertSchema(downloadRequests).omit({ 
  id: true, 
  createdAt: true,
  decidedAt: true,
});

export const insertDocumentFeedbackSchema = createInsertSchema(documentFeedback).omit({ 
  id: true, 
  createdAt: true,
  addressedAt: true,
});

export const insertDocumentTaskSchema = createInsertSchema(documentTasks).omit({ 
  id: true, 
  createdAt: true,
  assignedAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertTaskPokeSchema = createInsertSchema(taskPokes).omit({ 
  id: true, 
  createdAt: true,
});

export const insertDocumentAccessRequestSchema = createInsertSchema(documentAccessRequests).omit({ 
  id: true, 
  createdAt: true,
  decidedAt: true,
});

export const insertDocumentAccessSchema = createInsertSchema(documentAccess).omit({ 
  id: true, 
  grantedAt: true,
  revokedAt: true,
});

// ============================================
// TYPES
// ============================================
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;

export type WorkflowLog = typeof workflowLogs.$inferSelect;
export type InsertWorkflowLog = z.infer<typeof insertWorkflowLogSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type EmployeeTask = typeof employeeTasks.$inferSelect;
export type InsertEmployeeTask = z.infer<typeof insertEmployeeTaskSchema>;

export type DownloadRequest = typeof downloadRequests.$inferSelect;
export type InsertDownloadRequest = z.infer<typeof insertDownloadRequestSchema>;

export type DocumentFeedback = typeof documentFeedback.$inferSelect;
export type InsertDocumentFeedback = z.infer<typeof insertDocumentFeedbackSchema>;

export type DocumentTask = typeof documentTasks.$inferSelect;
export type InsertDocumentTask = z.infer<typeof insertDocumentTaskSchema>;

export type TaskPoke = typeof taskPokes.$inferSelect;
export type InsertTaskPoke = z.infer<typeof insertTaskPokeSchema>;

export type DocumentAccessRequest = typeof documentAccessRequests.$inferSelect;
export type InsertDocumentAccessRequest = z.infer<typeof insertDocumentAccessRequestSchema>;

export type DocumentAccess = typeof documentAccess.$inferSelect;
export type InsertDocumentAccess = z.infer<typeof insertDocumentAccessSchema>;

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// User types
export type CreateUserRequest = Omit<InsertUser, 'passwordHash'> & { password: string };
export type UpdateUserRequest = Partial<Omit<InsertUser, 'passwordHash' | 'email'>>;
export type UserResponse = Omit<User, 'passwordHash'>;

// Document types
export type CreateDocumentRequest = Pick<InsertDocument, 'documentCode' | 'title' | 'description' | 'category' | 'content' | 'fileUrl' | 'nextReviewDate'>;
export type UpdateDocumentRequest = Partial<CreateDocumentRequest>;

// Workflow types
export interface SubmitForReviewRequest {
  reviewerId: number;
  comments?: string;
}

export interface ApproveDocumentRequest {
  comments?: string;
}

export interface RejectDocumentRequest {
  comments: string;
}

// Dashboard types
export interface DashboardStats {
  totalDocuments: number;
  approvedDocuments: number;
  pendingApprovals: number;
  expiringDocuments: number;
  nonCompliantDocuments: number;
  totalUsers: number;
  pendingInductions: number;
}

export interface ComplianceAlert {
  id: number;
  documentCode: string;
  title: string;
  nextReviewDate: Date | null;
  daysUntilExpiry: number;
  alertLevel: 'yellow' | 'red';
}
