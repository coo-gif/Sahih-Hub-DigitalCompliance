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
  status: text("status").notNull().default(DocumentStatus.DRAFT),
  createdById: integer("created_by_id").notNull(),
  reviewerId: integer("reviewer_id"),
  approverId: integer("approver_id"),
  approvedAt: timestamp("approved_at"),
  nextReviewDate: timestamp("next_review_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// DOCUMENT VERSIONS (Archive)
// ============================================
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  versionNumber: text("version_number").notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  approvedById: integer("approved_by_id"),
  archivedAt: timestamp("archived_at").defaultNow(),
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
