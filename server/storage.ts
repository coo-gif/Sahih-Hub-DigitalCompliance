import { db } from "./db";
import {
  users, documents, documentVersions, workflowLogs, notifications, auditLogs,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type DocumentVersion, type InsertDocumentVersion,
  type WorkflowLog, type InsertWorkflowLog,
  type Notification, type InsertNotification,
  type AuditLog, type InsertAuditLog,
  DocumentStatus, InductionStatus,
} from "@shared/schema";
import { eq, desc, and, lt, gt, or, sql } from "drizzle-orm";
import crypto from "crypto";

// Simple password hashing (use bcrypt in production)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export interface IStorage {
  // Users
  getUsers(): Promise<Omit<User, 'passwordHash'>[]>;
  getUser(id: number): Promise<Omit<User, 'passwordHash'> | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<Omit<User, 'passwordHash'>>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<Omit<User, 'passwordHash'>>;
  deleteUser(id: number): Promise<void>;

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
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
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
      dateJoined: users.dateJoined,
      lastLogin: users.lastLogin,
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
      dateJoined: users.dateJoined,
      lastLogin: users.lastLogin,
    }).from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<Omit<User, 'passwordHash'>> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      passwordHash: hashPassword(insertUser.passwordHash),
    }).returning();
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<Omit<User, 'passwordHash'>> {
    const updateData: Partial<InsertUser> = { ...updates };
    if (updates.passwordHash) {
      updateData.passwordHash = hashPassword(updates.passwordHash);
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
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
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
}

export const storage = new DatabaseStorage();
