import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, verifyPassword } from "./storage";
import { api } from "@shared/routes";
import { 
  DocumentStatus, 
  DocumentHubStatus,
  DocumentClassification,
  DocumentCommentStatus,
  DocumentLifecycleStatus,
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
  ReportType,
  DocuGenieFormStatus,
  insertDocuGenieFormSchema,
  insertDocuGenieFormSubmissionSchema,
  LeadSource,
  LeadStatus,
  insertLeadSchema,
  insertCustomerSchema,
  insertOpportunitySchema,
  OpportunityStage,
  insertHistoricalDataSchema,
  type Document,
} from "@shared/schema";
import { z } from "zod";
import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

// Helper function to find chromium executable
function findChromiumPath(): string | undefined {
  // Try common paths in order of preference
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
  ];
  
  // Check which paths exist
  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  
  // Try to find using which command
  try {
    const result = execSync('which chromium 2>/dev/null || which google-chrome 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Try to find in nix store
  try {
    const result = execSync('find /nix/store -name "chromium" -type f -executable 2>/dev/null | head -1', { encoding: 'utf-8' }).trim();
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch (e) {
    // Ignore errors
  }
  
  return undefined;
}
import { listEmails, getEmail, sendEmail as sendEmailGmail, getUnreadCount, markAsRead, getLabels } from "./gmail";
import { isSmtpConfigured, sendEmailSmtp } from "./email-smtp";
import { 
  isGoogleOAuthConfigured, 
  getAuthUrl, 
  exchangeCodeForTokens, 
  saveUserGmailTokens, 
  getUserGmailTokens, 
  disconnectUserGmail,
  sendEmailWithUserAccount,
  getEmailsWithUserAccount,
  getUnreadCountWithUserAccount,
  markEmailAsReadWithUserAccount,
  deleteEmailWithUserAccount,
  archiveEmailWithUserAccount,
  starEmailWithUserAccount,
  unstarEmailWithUserAccount,
  markAsSpamWithUserAccount,
  markAsReadWithUserAccount,
  markAsUnreadWithUserAccount,
  moveToFolderWithUserAccount,
  getEmailWithUserAccount,
  getThreadWithUserAccount,
  sendEmailWithAttachments
} from "./gmail-oauth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { collectOpenTasks, TASK_TYPE_LABELS, type OpenTask } from "./task-sources";
import { registerDocumentControlRoutes, presentForReader, recordApprovedVersion, setDocumentLinks } from "./document-control";
import { convertUploadedFile, isGoogleFileUrl, UnsupportedFileError } from "./document-import";
import {
  reconcileTasks, scheduleReconcile, getOpenTaskRecords, computeTaskMetrics, monthRange, refreshPerformanceReports,
  parseTargetDate, setTaskTarget, getTaskTarget, TargetDateError,
} from "./task-ledger";

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Populate req.user from the session userId
  try {
    const user = await storage.getUser(req.session.userId);
    if (user) {
      (req as any).user = user;
    }
  } catch (error) {
    console.error('Error fetching user in requireAuth:', error);
  }
  
  next();
}

const COO_EMAIL = 'coo@sahihcertify.com';

// Documents the COO stored in the Hub as public information are readable by every signed-in user
function isPublicHubDocument(doc: { hubStatus?: string | null; classification?: string | null; lifecycleStatus?: string | null }): boolean {
  return doc.hubStatus === DocumentHubStatus.STORED && doc.classification === DocumentClassification.PUBLIC_INFORMATION && !isWithdrawnDocument(doc);
}

// Obsolete and quarantined documents are withdrawn from use: only the COO can open them
function isWithdrawnDocument(doc: { lifecycleStatus?: string | null }): boolean {
  return doc.lifecycleStatus === DocumentLifecycleStatus.OBSOLETE || doc.lifecycleStatus === DocumentLifecycleStatus.QUARANTINE;
}

// Same visibility rule as the documents list: unlocked, unapproved documents are open to everyone;
// approved or locked ones need the COO, a workflow role, public classification or an access grant.
async function canViewDocument(doc: Document, user: { id: number; email: string }): Promise<boolean> {
  if (!doc.isLocked && doc.status !== DocumentStatus.APPROVED) return true;
  if (user.email === COO_EMAIL) return true;
  if (isWithdrawnDocument(doc)) return false;
  if (isPublicHubDocument(doc)) return true;
  if (doc.createdById === user.id || doc.preparedById === user.id || doc.reviewerId === user.id || doc.approverId === user.id) return true;
  return storage.hasDocumentAccess(doc.id, user.id);
}

// Moves a document workflow step (prepare / revise / review / approve) to another person and tells everyone involved
async function reassignDocumentTask(doc: Document, taskType: string, newAssigneeId: number, userId: number, reason?: string, newApproverId?: number) {
  const documentId = doc.id;
  const newAssignee = await storage.getUser(newAssigneeId);
  if (!newAssignee) throw new Error('New assignee not found');
  // Prepare update data based on task type
  const updateData: any = {};
  let oldAssigneeId: number | null = null;
  
  if (taskType === 'review') {
    oldAssigneeId = doc.reviewerId;
    updateData.reviewerId = newAssigneeId;
    updateData.reviewedBySignedAt = null; // Clear previous signature
  } else if (taskType === 'approve') {
    oldAssigneeId = doc.approverId;
    updateData.approverId = newAssigneeId;
    updateData.approvedBySignedAt = null; // Clear previous signature
  } else if (taskType === 'prepare' || taskType === 'revise') {
    oldAssigneeId = doc.preparedById;
    updateData.preparedById = newAssigneeId;
    updateData.preparerConfirmedAt = null;
    updateData.preparedBySignedAt = null;
  }
  
  // If new approver is also specified
  if (newApproverId) {
    const newApprover = await storage.getUser(newApproverId);
    if (!newApprover) {
      throw new Error('New approver not found');
    }
    updateData.approverId = newApproverId;
  }
  
  // Update the document
  const updated = await storage.updateDocument(documentId, updateData);
  
  // Get old assignee info for audit log
  const oldAssignee = oldAssigneeId ? await storage.getUser(oldAssigneeId) : null;
  
  // Create audit log
  await storage.createAuditLog({
    userId,
    action: AuditAction.UPDATE,
    entityType: 'document',
    entityId: documentId,
    oldValue: JSON.stringify({
      taskType,
      assignedTo: oldAssignee?.name || 'Unknown',
      assignedToId: oldAssigneeId,
    }),
    newValue: JSON.stringify({
      taskType,
      assignedTo: newAssignee.name,
      assignedToId: newAssigneeId,
      reason: reason || 'Task reassigned',
      ...(newApproverId && { newApproverId }),
    }),
  });
  
  // Create workflow log
  await storage.createWorkflowLog({
    documentId,
    fromStatus: doc.status,
    toStatus: doc.status, // Status doesn't change
    actionById: userId,
    comments: `Task reassigned: ${taskType} from ${oldAssignee?.name || 'Unknown'} to ${newAssignee.name}. ${reason ? `Reason: ${reason}` : ''}`,
  });
  
  // Notify the new assignee
  await storage.createNotification({
    userId: newAssigneeId,
    title: 'Task Assigned to You',
    message: `You have been assigned to ${taskType} document "${doc.title}" (${doc.documentCode}). ${reason ? `Reason: ${reason}` : ''}`,
    urgencyLevel: UrgencyLevel.HIGH,
    relatedDocumentId: documentId,
  });
  
  // Notify the old assignee if they weren't the one doing the reassignment
  if (oldAssigneeId && oldAssigneeId !== userId) {
    await storage.createNotification({
      userId: oldAssigneeId,
      title: 'Task Reassigned',
      message: `Your ${taskType} task for document "${doc.title}" has been reassigned to ${newAssignee.name}.`,
      urgencyLevel: UrgencyLevel.MEDIUM,
      relatedDocumentId: documentId,
    });
  }
  
  return updated;
}

// Who assigned a task: the recorded initiator, else the one implied by the workflow
async function taskInitiatorId(taskKey: string): Promise<number | null> {
  const target = await getTaskTarget(taskKey);
  if (target) return target.initiatorId;
  const { tasks } = await collectOpenTasks();
  return tasks.find(t => t.key === taskKey)?.initiatorId ?? null;
}

// Task types whose assignee can be changed from the task screens
const REASSIGNABLE_TASK_TYPES = new Set(['prepare', 'revise', 'review', 'approve', 'employee_review', 'employee_approve', 'comment', 'bug', 'lead_followup']);

function canManageTasks(user: { id: number; role: string; email: string } | undefined, initiatorId: number | null): boolean {
  if (!user) return false;
  return user.id === initiatorId || user.role === UserRole.ADMIN || user.role === UserRole.QUALITY_MANAGER || user.email === COO_EMAIL;
}

function getCurrentUserId(req: any): number {
  if (!req.session?.userId) {
    throw new Error('Not authenticated');
  }
  return req.session.userId;
}

const COMPANY_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAMAAABlApw1AAAAYFBMVEUAAAD///+qqqqampra2tpDQ0Pj4+Pd3d34+PhPT0/x8fFISEi/v79YWFgQEBCWlpY2NjYjIyPp6emAgICNjY1hYWEaGhotLS2hoaEoKCh1dXW1tbXFxcVqamrLy8vS0tIYlW4WAAAI+UlEQVR4nO2ciZKzKhCFaRdEXKK4a4zv/5a30SxmMyYBJ39dvpqaGMelj8CxQRxCDAaDwWAwGAwGg8FgMBgMBsNPk+ysD+j8xYMG3aN9Ii0CfA8+IEwW43ce7pT9joB9vHRI93H8PyQgXDxi9OyIPyPgRfxPrv/vCNh/GP+vCAjLpcO5C4f7DQFhunS0J/7zQwKW689i/JoEuMM78X/oPxOtFgGkeKMIPvUfCcv1xI8K6Nr4l+uP/0fx45UTK6//ov8EyyWppwEc8fmq+D/3H83xo4IVZfCN/+iOHxW8bAdf+Y/2+F970cf5A8J2+uN/5UXL1//FzZDVi61HFUvt4Cv/kQoW+w/KFDz1oq/8Z6TeQsDTMviq/myqIHrYDr7yn4uCTWrRIy/6xn+uFGzSku+9aPn6v2y/F1jdbKHgtiV/334vaEqnFxW88M+34uf9JgKuvEiF/5wQ2xQAmXvRN/2Xv4v/4kWq/EfCN4z/VAbK/Gfz+DE6rtZ/to4f2yf7bPz2V+JHFuNfmz/8YfyLvNd+AbpNsoj1vBv/q/a0NUvjt89YduRtec9/Thz+Ouwz7/nP75XB4z7PqjLQ1KMpF/PNu/g/vP6SsNIiINgtPjG9Znn89hW6HnAs5/xz3st/NhPwImubxf/V9df5iGmdQ3wbv85nZOEKh3gv/9lYAIQvRwy+8Z8NBLz0uM/mhGwo4Nvx278XsOhFX7ffLQQsKPju/rWZgKe16Hv/0SpgdnUft2QF/qNTwNVUg+6Bm6rwH50Ckv38HPd3NDXtd0RP377srk5y25IVxs80De7W16e5zovU1R8AujxV82Mydn2euRep8p/pwJoecNxd5O7sRcr8Z0Tbc7797ZlOXqQkfzijb3xux27PNbVkhe1XMujpEiPV/ePhvfr4wdIVPyHd/dlCpf4jEa4+AeVdHcIyeGsu4ArWdrw/wlIc7APYG4M371OumnL2FZrnSmS64xdvjf+9T3N3L1CM9mfcxcqZlx+ywVSV/IETKWPQaKFnNDqRKDaIn1Sqjf8M22DSpSTR5aWbTLocFeiJv9sqfvl4/t+On5BefS3S1Q17QqtawfIbfxro1daibuv4sRujUoH1FzMMEnVJxWb+eY2qxI792SSb1FJRjbxN8ocnZN9Xo1DTMNxKim9HJPJt7f8e98FIxXq2mqO7yBf3tM3vXo+pDp+1ZbpR9ryC/IO5QexHLv+E371bCI7GNyY/IW7fsiNWB38d8R1Vvj7+wd/kPZm3CdeF/xPe+Rj/8NpShf3XUS7S7pdbs2f9kvc8JAufS6D13yY+62j6J21B5P9C+JI0eJAgiUzboy8t1Hxek9jh93z/Je2BThq4s82reepx7b0nhu53bX8FUf/ztmkwGAyG/xFReLmtdndjynGZ3kwUaLup7xh1LX4Jt3gK/JAySosxl8xmczHAu9mqqMN9l8//0WOSd1PvN5OzmGr4s2HciLZ8HAZpATuE6TQcDs7NVp0ThgegsyitIZ+evWfsbwUkebDzA8ufBNh8LIY7AWnWNmkGw2VNn0VZWe9uBAR2152l5LuGRHVozfs6hRWQXWepzsBbyCYBBZO/7wUMnDkRcfhUicrMSjG8inBxI2APHNhJgaAuCXHFMFNgQ+EBA64qD2wO4zS87CSAVExOargVYIGVQUes44SBZg9J6lGfMH5bAg1pWVeeBAQkSeMdzEbqbOAHubmq8Qt3mkd4LgGsGnLNrYABUtcbSvsoIEUBpef5hKOAltXXbSAU1UnA2EgKZl3GunajPxRc1ew5F/aB6yb5UUDiugU/JOhClTsj6WDXUyewWJ7I7/4BoojzrGG8SnJmJYl1FhDlHuTjXpUQhfwshulzPFINGf7OuKr3WpsBqOM4AksZbTTuPMeT87MBBmcOBaDAHA5i/OoxwFWOcADkvnzAvxwF1EJ0DoxbDQDeuMDHczjHZTEeT9mrxW5uj/hoIFGcycWsIvbOvma3O/6cv9ptkE0r5K+dPbVKG9Bz/OmYeZ4ft58f7bj8c/8i4Ihgl+Xab/+9LrOAIK4mEypZJzadpaKEjAPwY3MISPpvjXeNFLXd/tS/XzAY3iFOj9VXfqarBj3jRnpOmjSkeTwz+slqZQRFX5wzw+hk45y7gYD5dm5RFI/+cX0LmOj0DPb9PNe+EN31jdTSYiJweS/Ep3xa8A6BS+cCxiet4nrfJEPlGbVL1JsHGb0z/R0qbqnWlx7kqYtc3i8Tv5ICBOZz+C2KiEsZSU5lUzC2a3OZFaeyK1JWJHUxeULDHPuj4OBO41Bv6Urrb3y57EJdYulU59W4WxyMiamrbFgYxFgvCocKz5YC9lRe0iFMXCpCSndTDT4cZ46VNW4XkdazHKfAvEyUBc0x2WaiTRy81LkjvNwNqaBW2lLgtHWH/biaWiWxnNqjToJnE0JVNmoBl6H1hzwDUfkU9rgmIkyggOMykp6qUw5dhJ2YHKvToUJVrWwDpACaJQFW9gz7c3UbhDbWuAw7DV2f+EBxNS0OmKxjd612II+paHtlU+lqACZ7fFXp8UhWobKDnjCayCoUd1OWfGrQMfei+ABNLvtYsSXfaBgbMTgNCbAT1ME0uNIkOyyyWm7lM4qrsUbCIQ1xhxy3pyxXeLN2QwASDZwyKYCT9CwA5PIooKQwemoMjFLqlbL/cy0gkQLSA5MCqo5RjsFbJwGhFMCdJIRWCpAvWnBV03FkFfegCfFcznMBWPjSYuKY076pEjIKKMde2FwARio3r3HjbC5AHnEqgUkASXMBim4PXWdbjOGZ654fBYRXAqaM3uUQ1laIsYVZbpNTCXRWMhPgYYfXyeseNyr2WIVsGOxobAMwtB3UeBkmAXXee6oEyEfvXkF6AQPlUYBtYAyaT23gXAIkkvNI91g7MFu2yNgGsDeP7b6/CBhIgy2K58kB6B63aPDvvdSV2oyxuiKnEsCTMlVvZJVVksgG1SRVU8VxVcm0ICb4eV6+bIgXLU7kRykXcYsEN5O74ycuNNOqEvdKxi3wS3xeHU9HK3F7/Ps/2FEwGAwGg8FgMBgMBoPBYDAYDAbDKv4DRtuGaiLoaoAAAAAASUVORK5CYII=';

async function generateReportPdf(
  reportType: string,
  title: string,
  content: string,
  metadata: {
    documentCode?: string;
    documentTitle?: string;
    employeeName?: string;
    employeeNumber?: string;
    department?: string;
    jobTitle?: string;
    hireDate?: string;
    preparedByName?: string;
    preparedBySignature?: string | null;
    preparedBySignedAt?: Date | null;
    reviewerName?: string;
    reviewerSignature?: string | null;
    reviewerSignedAt?: Date | null;
    approverName?: string;
    approverSignature?: string | null;
    approverSignedAt?: Date | null;
    reportNumber: string;
    generatedAt: Date;
  }
): Promise<string> {
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const signatureHtml = (name: string | undefined, signature: string | null | undefined, signedAt: Date | null | undefined, role: string) => `
    <div class="signature-block">
      <div class="signature-role">${role}</div>
      ${signature ? `<img src="${signature}" class="signature-img" alt="${name} signature" />` : '<div class="signature-placeholder"></div>'}
      <div class="signature-line">${name || 'N/A'}</div>
      <div class="signature-date">${formatDate(signedAt)}</div>
    </div>
  `;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #0891b2; margin-bottom: 30px; }
        .logo-container { display: flex; align-items: center; gap: 15px; }
        .logo-img { height: 150px; width: auto; }
        .company-info { text-align: right; }
        .company-name { font-size: 18px; font-weight: bold; color: #0891b2; }
        .report-number { font-size: 12px; color: #666; margin-top: 5px; }
        .report-title { text-align: center; font-size: 20px; font-weight: bold; color: #0891b2; margin: 30px 0; padding: 15px; background: linear-gradient(135deg, #ecfeff 0%, #f0fdfa 100%); border-radius: 8px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 14px; font-weight: bold; color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 5px; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .info-item { padding: 8px 12px; background: #f8fafc; border-radius: 4px; }
        .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; }
        .info-value { font-size: 12px; font-weight: 600; color: #1e293b; }
        .content { padding: 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0; min-height: 100px; }
        .signatures { display: flex; justify-content: space-around; margin-top: 40px; padding-top: 30px; border-top: 2px solid #e2e8f0; }
        .signature-block { text-align: center; width: 28%; }
        .signature-role { font-size: 12px; font-weight: bold; color: #0891b2; margin-bottom: 10px; }
        .signature-img { max-height: 50px; max-width: 150px; margin: 10px auto; display: block; }
        .signature-placeholder { height: 50px; border-bottom: 1px solid #999; margin: 10px auto; width: 150px; }
        .signature-line { font-size: 11px; font-weight: 600; margin-top: 5px; padding-top: 5px; border-top: 1px solid #333; }
        .signature-date { font-size: 9px; color: #666; margin-top: 3px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
        .watermark { position: fixed; bottom: 50px; right: 50px; font-size: 60px; color: rgba(8, 145, 178, 0.05); transform: rotate(-15deg); font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="watermark">SAHIH</div>
      <div class="header">
        <div class="logo-container">
          <img src="${COMPANY_LOGO_BASE64}" alt="Sahih Certifications" class="logo-img" />
          <div>
            <div class="company-name">SAHIH CERTIFICATIONS</div>
            <div style="font-size: 10px; color: #64748b;">Quality Management System</div>
          </div>
        </div>
        <div class="company-info">
          <div class="report-number"><strong>Report No:</strong> ${metadata.reportNumber}</div>
          <div class="report-number"><strong>Generated:</strong> ${formatDate(metadata.generatedAt)}</div>
        </div>
      </div>
      
      <div class="report-title">${title}</div>
      
      ${reportType === ReportType.DOCUMENT_APPROVAL ? `
        <div class="section">
          <div class="section-title">Document Information</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Document Code</div>
              <div class="info-value">${metadata.documentCode || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Document Title</div>
              <div class="info-value">${metadata.documentTitle || 'N/A'}</div>
            </div>
          </div>
        </div>
      ` : `
        <div class="section">
          <div class="section-title">Employee Information</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Employee Name</div>
              <div class="info-value">${metadata.employeeName || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Employee Number</div>
              <div class="info-value">${metadata.employeeNumber || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Department</div>
              <div class="info-value">${metadata.department || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Job Title</div>
              <div class="info-value">${metadata.jobTitle || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Hire Date</div>
              <div class="info-value">${metadata.hireDate || 'N/A'}</div>
            </div>
          </div>
        </div>
      `}
      
      <div class="section">
        <div class="section-title">Report Details</div>
        <div class="content">${content}</div>
      </div>
      
      <div class="signatures">
        ${reportType === ReportType.DOCUMENT_APPROVAL ? `
          ${signatureHtml(metadata.preparedByName, metadata.preparedBySignature, metadata.preparedBySignedAt, 'Prepared By')}
          ${signatureHtml(metadata.reviewerName, metadata.reviewerSignature, metadata.reviewerSignedAt, 'Reviewed By')}
          ${signatureHtml(metadata.approverName, metadata.approverSignature, metadata.approverSignedAt, 'Approved By')}
        ` : `
          ${signatureHtml(metadata.reviewerName, metadata.reviewerSignature, metadata.reviewerSignedAt, 'Reviewed By')}
          ${signatureHtml(metadata.approverName, metadata.approverSignature, metadata.approverSignedAt, 'Approved By')}
        `}
      </div>
      
      <div class="footer">
        This is an official document generated by Sahih Certifications Quality Management System.<br/>
        Document ID: ${metadata.reportNumber} | Generated: ${formatDate(metadata.generatedAt)}
      </div>
    </body>
    </html>
  `;

  let browser;
  try {
    browser = await puppeteer.launch({ 
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
      ],
      timeout: 30000, // 30 second timeout for browser launch
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', right: '15mm', bottom: '25mm', left: '15mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9pt; font-family: 'Segoe UI', Arial, sans-serif; padding: 0 15mm; display: flex; justify-content: center; color: #333;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
      timeout: 30000, // 30 second timeout for PDF generation
    });
    
    await browser.close();

    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    return `data:application/pdf;base64,${pdfBase64}`;
  } catch (pdfError) {
    console.error('PDF generation error:', pdfError);
    if (browser) {
      await browser.close().catch(() => {});
    }
    throw pdfError;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Any successful change may create, move or finish someone's task: record it in the task ledger
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) scheduleReconcile();
      });
    }
    next();
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app, requireAuth);

  // Change requests, version records and the Records & Data Hive
  registerDocumentControlRoutes(app, { requireAuth, canViewDocument });

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
      
      // Update login and activity timestamps
      await storage.updateUser(user.id, { lastLogin: new Date() } as any);
      await storage.updateUserActivity(user.id);
      
      // Never send the password hash or Gmail tokens to the browser
      const {
        passwordHash, gmailAccessToken, gmailRefreshToken,
        ...userWithoutPassword
      } = user;
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

  // Accept user agreement (ISO 27001 compliance)
  app.post('/api/auth/accept-agreement', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    await storage.acceptUserAgreement(req.session.userId);
    
    // Log the action for audit trail
    await storage.createAuditLog({
      userId: req.session.userId,
      action: AuditAction.CREATE,
      entityType: 'user_agreement',
      entityId: req.session.userId,
      newValue: JSON.stringify({ acceptedAt: new Date().toISOString() }),
    });

    const user = await storage.getUser(req.session.userId);
    res.json({ success: true, user });
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
  
  // Get active users with online status
  app.get('/api/users/active', requireAuth, async (req, res) => {
    try {
      const activeUsers = await storage.getActiveUsers();
      res.json(activeUsers);
    } catch (err) {
      console.error('Error fetching active users:', err);
      res.status(500).json({ message: 'Failed to fetch active users' });
    }
  });

  // Activity heartbeat - clients should call this periodically
  app.post('/api/activity/heartbeat', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      await storage.updateUserActivity(userId);
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating activity:', err);
      res.status(500).json({ message: 'Failed to update activity' });
    }
  });

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
  app.get(api.documents.list.path, requireAuth, async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
    };
    const docs = await storage.getDocuments(filters);
    
    // Server-side access control for locked/approved documents
    const userId = getCurrentUserId(req);
    const currentUser = await storage.getUser(userId);
    const COO_EMAIL = 'coo@sahihcertify.com';
    
    // COO gets full access to all documents
    if (currentUser?.email === COO_EMAIL) {
      return res.json(docs.map(d => ({ ...d, viewerHasAccess: true })));
    }
    
    // For other users, filter out locked/approved documents unless they have explicit access.
    // A document under revision is shown to readers as its approved version still in force.
    const filteredDocs = await Promise.all(docs.map(async (rawDoc) => {
      const doc = currentUser ? await presentForReader(rawDoc, currentUser) : rawDoc;
      // Non-locked and non-approved docs are always visible
      if (!doc.isLocked && doc.status !== DocumentStatus.APPROVED) {
        return { ...doc, viewerHasAccess: true };
      }
      
      // For locked/approved docs, check if user has explicit access
      const hasAccess = isPublicHubDocument(doc) || await storage.hasDocumentAccess(doc.id, userId);
      
      // If user has access or is part of the workflow (creator, reviewer, approver), show full doc
      if (!isWithdrawnDocument(doc) && (hasAccess || doc.createdById === userId || doc.reviewerId === userId || doc.approverId === userId)) {
        return { ...doc, viewerHasAccess: true };
      }
      
      // Otherwise, return metadata only (no content) to allow access requests
      return {
        ...doc,
        content: null,
        fileUrl: null,
        finalPdfUrl: null,
        sourceFileUrl: null,
        viewerHasAccess: false,
      };
    }));
    
    res.json(filteredDocs);
  });

  app.get(api.documents.get.path, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }
    const rawDoc = await storage.getDocument(id);
    if (!rawDoc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Server-side access control for locked/approved documents
    const userId = getCurrentUserId(req);
    const currentUser = await storage.getUser(userId);
    const COO_EMAIL = 'coo@sahihcertify.com';
    // While under revision, readers see the approved version still in force
    const doc = currentUser ? await presentForReader(rawDoc, currentUser) : rawDoc;
    
    // COO gets full access
    if (currentUser?.email === COO_EMAIL) {
      return res.json(doc);
    }
    
    // Non-locked and non-approved docs are fully accessible
    if (!doc.isLocked && doc.status !== DocumentStatus.APPROVED) {
      return res.json(doc);
    }
    
    // For locked/approved docs, check access
    const hasAccess = isPublicHubDocument(doc) || await storage.hasDocumentAccess(doc.id, userId);
    
    // If user has access or is part of the workflow
    if (!isWithdrawnDocument(doc) && (hasAccess || doc.createdById === userId || doc.reviewerId === userId || doc.approverId === userId)) {
      return res.json(doc);
    }
    
    // Otherwise, return metadata only (no content)
    res.json({
      ...doc,
      content: null,
      fileUrl: null,
      finalPdfUrl: null,
      sourceFileUrl: null,
    });
  });

  app.post(api.documents.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.documents.create.input.parse(req.body);
      const prepareTarget = input.preparedById ? parseTargetDate(input.prepareTargetDate, 'prepare') : null;
      
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
        sourceType: input.sourceType || 'manual',
        sourceFileName: input.sourceFileName || null,
        sourceFileUrl: input.sourceFileUrl || null,
        sourceImportedAt: input.sourceType === 'upload' ? new Date() : null,
      } as any);

      if (input.linkedDocumentIds?.length) {
        await setDocumentLinks(doc.id, input.linkedDocumentIds, getCurrentUserId(req));
      }

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

      if (input.preparedById && prepareTarget) {
        await setTaskTarget(`prepare:${doc.id}`, { assigneeId: input.preparedById, initiatorId: getCurrentUserId(req), targetDate: prepareTarget });
      }

      // Update live performance report stats
      await storage.updateLiveReportStats(getCurrentUserId(req), 'document_created');

      res.status(201).json(doc);
    } catch (err: any) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'prepareTargetDate' });
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

  // Upload a Word (.docx) / text / HTML file: returns its content for the document editor
  app.post('/api/documents/convert-upload', requireAuth, async (req, res) => {
    const parsed = z.object({
      fileName: z.string().min(1).max(255),
      data: z.string().min(1), // base64
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Choose a file to upload' });
    try {
      const buffer = Buffer.from(parsed.data.data, 'base64');
      if (buffer.length > 7 * 1024 * 1024) return res.status(413).json({ message: 'The file is larger than 7 MB' });
      const html = await convertUploadedFile(parsed.data.fileName, buffer);
      res.json({ fileName: parsed.data.fileName, title: parsed.data.fileName.replace(/\.(docx?|txt|html?)$/i, ''), html });
    } catch (err: any) {
      if (err instanceof UnsupportedFileError) return res.status(415).json({ message: err.message });
      console.error('Error converting uploaded file:', err);
      res.status(422).json({ message: 'This file could not be read. Check it opens in Word and upload it again.' });
    }
  });

  // Register a document kept in Google (Docs / Sheets / Drive): only the audit details are entered here.
  // It goes straight to the COO's final approval in the Document Hub.
  app.post('/api/documents/register-link', requireAuth, async (req, res) => {
    const userId = getCurrentUserId(req);
    const parsed = z.object({
      documentCode: z.string().trim().min(1, 'Enter the doc ref no.'),
      title: z.string().trim().min(1, 'Enter the document name'),
      category: z.string().min(1),
      url: z.string().trim().refine(isGoogleFileUrl, 'Paste the link of a Google Doc, Sheet, Slides or Drive file (https://docs.google.com/... or https://drive.google.com/...)'),
      editionNumber: z.number().int().min(0).max(999),
      revisionNumber: z.number().int().min(0).max(999),
      issueDate: z.string().refine(v => !isNaN(Date.parse(v)), 'Enter the issue date'),
      preparedById: z.number({ required_error: 'Choose who prepared it' }).int().positive({ message: 'Choose who prepared it' }),
      reviewedById: z.number().int().positive().optional().nullable(),
      approvedById: z.number({ required_error: 'Choose who approved it' }).int().positive({ message: 'Choose who approved it' }),
      description: z.string().optional(),
      nextReviewDate: z.string().optional(),
      linkedDocumentIds: z.array(z.number().int().positive()).optional(),
      assignedStaffIds: z.array(z.number()).optional(),
      assignedDepartments: z.array(z.string()).optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.errors[0];
      return res.status(400).json({ message: issue.message, field: issue.path.join('.') });
    }
    const input = parsed.data;
    try {
      for (const id of [input.preparedById, input.reviewedById, input.approvedById]) {
        if (id && !(await storage.getUser(id))) return res.status(400).json({ message: 'One of the chosen signatories was not found' });
      }
      const issueDate = new Date(input.issueDate);
      const now = new Date();
      const doc = await storage.createDocument({
        documentCode: input.documentCode,
        title: input.title,
        description: input.description || null,
        category: input.category,
        content: null,
        fileUrl: input.url,
        versionNumber: `${input.editionNumber}.${input.revisionNumber}`,
        editionNumber: input.editionNumber,
        revisionNumber: input.revisionNumber,
        status: DocumentStatus.APPROVED,
        createdById: userId,
        nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
        preparedById: input.preparedById,
        reviewerId: input.reviewedById || null,
        reviewedById: input.reviewedById || null,
        approverId: input.approvedById,
        approvedById: input.approvedById,
        approvedAt: issueDate,
        issueDate,
        hubStatus: DocumentHubStatus.PENDING_COO_APPROVAL,
        transferredToHubAt: now,
        assignedStaffIds: input.assignedStaffIds?.length ? input.assignedStaffIds : null,
        assignedDepartments: input.assignedDepartments?.length ? input.assignedDepartments : null,
        sourceType: 'google_link',
        sourceFileName: input.title,
        sourceFileUrl: input.url,
      } as any);
      if (input.linkedDocumentIds?.length) await setDocumentLinks(doc.id, input.linkedDocumentIds, userId);

      await storage.createWorkflowLog({
        documentId: doc.id,
        fromStatus: null,
        toStatus: DocumentStatus.APPROVED,
        actionById: userId,
        comments: 'Registered from a Google file; sent to the COO for final approval in the Document Hub',
      });
      await storage.createAuditLog({
        userId, action: AuditAction.CREATE, entityType: 'document', entityId: doc.id,
        newValue: JSON.stringify({ ...input, source: 'google_link' }),
      });
      const coo = await storage.getUserByEmail('coo@sahihcertify.com');
      if (coo) {
        await setTaskTarget(`hub_approval:${doc.id}`, { assigneeId: coo.id, initiatorId: userId, targetDate: parseTargetDate(undefined, 'hub_approval') });
        if (coo.id !== userId) {
          await storage.createNotification({
            userId: coo.id,
            title: 'Document Awaiting Final Approval',
            message: `"${doc.documentCode} - ${doc.title}" (Google file) was registered and awaits your final approval in the Document Hub.`,
            urgencyLevel: UrgencyLevel.MEDIUM,
            relatedDocumentId: doc.id,
          });
        }
      }
      await storage.updateLiveReportStats(userId, 'document_created');
      res.status(201).json(doc);
    } catch (err: any) {
      if (err?.code === '23505' && err?.constraint === 'documents_document_code_unique') {
        return res.status(400).json({ message: 'A document with this doc ref no. already exists.', field: 'documentCode' });
      }
      console.error('Error registering Google document:', err);
      res.status(500).json({ message: 'Failed to register the document' });
    }
  });

  app.put(api.documents.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.documents.update.input.parse(req.body);
      const id = Number(req.params.id);
      
      const existing = await storage.getDocument(id);
      if (!existing) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Prevent editing locked documents, and signed-off documents awaiting the COO in the Document Hub
      if (existing.isLocked) {
        return res.status(403).json({ message: 'This document is locked and cannot be edited. Approved documents are read-only.' });
      }
      if (existing.status === DocumentStatus.APPROVED) {
        return res.status(403).json({ message: 'This document has been approved and is awaiting the COO\'s final approval in the Document Hub. It cannot be edited.' });
      }

      const updateData: any = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.fileUrl !== undefined) updateData.fileUrl = input.fileUrl;
      if (input.nextReviewDate) {
        updateData.nextReviewDate = new Date(input.nextReviewDate);
      }
      if (input.editionNumber !== undefined) updateData.editionNumber = input.editionNumber;
      if (input.revisionNumber !== undefined) updateData.revisionNumber = input.revisionNumber;
      if (input.requiresPreparedBy !== undefined) updateData.requiresPreparedBy = input.requiresPreparedBy;
      if (input.requiresReviewedBy !== undefined) updateData.requiresReviewedBy = input.requiresReviewedBy;
      if (input.requiresApprovedBy !== undefined) updateData.requiresApprovedBy = input.requiresApprovedBy;
      if (input.preparedById !== undefined) updateData.preparedById = input.preparedById;
      const prepareTarget = input.preparedById && input.preparedById !== existing.preparedById
        ? parseTargetDate(input.prepareTargetDate, 'prepare')
        : (input.prepareTargetDate ? parseTargetDate(input.prepareTargetDate, 'prepare') : null);
      if (input.reviewedById !== undefined) updateData.reviewerId = input.reviewedById;
      if (input.approvedById !== undefined) updateData.approverId = input.approvedById;

      const doc = await storage.updateDocument(id, updateData);
      if (prepareTarget && doc.preparedById) {
        await setTaskTarget(`prepare:${id}`, { assigneeId: doc.preparedById, initiatorId: getCurrentUserId(req), targetDate: prepareTarget });
      }

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
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'prepareTargetDate' });
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.documents.delete.path, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getDocument(id);
    if (!existing) {
      return res.status(404).json({ message: 'Document not found' });
    }
    // Anything that was ever approved is a controlled record and is kept for good
    const versions = await storage.getDocumentVersions(id);
    if (existing.isLocked || existing.status === DocumentStatus.APPROVED || existing.activeChangeRequestId || versions.length > 0) {
      return res.status(403).json({ message: 'Approved documents are permanent records and cannot be deleted. Raise a change request, or ask the COO to mark it Obsolete.' });
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

      const reviewTarget = parseTargetDate(input.reviewTargetDate, 'review');

      // Update document status to in_review
      const updateData: any = {
        status: DocumentStatus.IN_REVIEW,
        reviewerId: input.reviewerId,
        returnedAt: null,
        returnedById: null,
        returnNote: null,
      };

      if (input.approverId) {
        const approver = await storage.getUser(input.approverId);
        if (!approver) {
          return res.status(400).json({ message: 'Approver not found', field: 'approverId' });
        }
        updateData.approverId = input.approverId;
      }

      const doc = await storage.updateDocument(id, updateData);
      await setTaskTarget(`review:${id}`, { assigneeId: input.reviewerId, initiatorId: getCurrentUserId(req), targetDate: reviewTarget });

      // Create notification for reviewer
      await storage.createNotification({
        userId: input.reviewerId,
        title: 'Document Requires Review',
        message: `Document "${doc.title}" (${doc.documentCode}) requires your review by ${reviewTarget.toLocaleDateString('en-GB')}.`,
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
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'reviewTargetDate' });
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
      const { tasks } = await collectOpenTasks();
      const mine = tasks.filter(t => t.userId === userId);
      // Due dates come from the task record once it exists, so they do not move
      const records = new Map((await getOpenTaskRecords(userId)).map(r => [r.taskKey, r]));

      // Several comments on the same document are shown as one task
      const shown: OpenTask[] = [];
      const commentCounts = new Map<number, number>();
      for (const t of mine) {
        if (t.taskType === 'comment' && t.documentId) {
          commentCounts.set(t.documentId, (commentCounts.get(t.documentId) || 0) + 1);
          if (commentCounts.get(t.documentId)! > 1) continue;
        }
        shown.push(t);
      }

      const now = Date.now();
      const allUsers = await storage.getUsers();
      const result = shown.map((t, index) => {
        const record = records.get(t.key);
        const assignedAt = record?.assignedAt ?? t.assignedAt;
        const dueAt = record ? record.dueAt : t.dueAt;
        const commentCount = t.taskType === 'comment' && t.documentId ? commentCounts.get(t.documentId) : undefined;
        return {
          ...t.extra,
          id: index + 1,
          taskKey: t.key,
          taskType: t.taskType,
          typeLabel: TASK_TYPE_LABELS[t.taskType] || t.taskType,
          title: t.title,
          reference: t.reference,
          description: commentCount && commentCount > 1
            ? `You were mentioned in ${commentCount} open comments on this document.`
            : t.description,
          link: t.link,
          documentId: t.documentId,
          status: 'pending',
          createdAt: assignedAt,
          dueDate: dueAt,
          isOverdue: !!dueAt && dueAt.getTime() < now,
          hasTarget: t.dueSource !== 'default',
          initiatorId: t.initiatorId ?? null,
          initiatorName: t.initiatorId ? allUsers.find(u => u.id === t.initiatorId)?.name ?? null : null,
          commentCount,
        };
      });
      result.sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
      res.json(result);
    } catch (err) {
      console.error('Error fetching my tasks:', err);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Tasks this user assigned to others (initiator view). Managers can ask for every open task with ?all=1.
  app.get('/api/tasks/initiated', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const all = req.query.all === '1' && canManageTasks(user, null);
      const { tasks } = await collectOpenTasks();
      const users = await storage.getUsers();
      const nameOf = (id: number | null | undefined) => (id ? users.find(u => u.id === id)?.name ?? 'Unknown' : null);
      const now = Date.now();
      const result = tasks
        .filter(t => all ? true : t.initiatorId === user.id && t.userId !== user.id)
        .map(t => ({
          taskKey: t.key,
          taskType: t.taskType,
          typeLabel: TASK_TYPE_LABELS[t.taskType] || t.taskType,
          title: t.title,
          reference: t.reference,
          link: t.link,
          assigneeId: t.userId,
          assigneeName: nameOf(t.userId),
          initiatorId: t.initiatorId ?? null,
          initiatorName: nameOf(t.initiatorId),
          assignedAt: t.assignedAt,
          dueDate: t.dueAt,
          isOverdue: !!t.dueAt && t.dueAt.getTime() < now,
          canReassign: REASSIGNABLE_TASK_TYPES.has(t.taskType),
        }))
        .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
      res.json(result);
    } catch (err) {
      console.error('Error fetching initiated tasks:', err);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // The initiator (or an admin, QM or the COO) moves a task to another person and/or changes its target date
  app.post('/api/tasks/change', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsed = z.object({
        taskKey: z.string().min(1),
        assigneeId: z.number().int().positive().optional(), // current assignee, for tasks shared by several people
        newAssigneeId: z.number().int().positive().optional(),
        targetDate: z.string().optional(),
        reason: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request' });
      }
      const { taskKey, assigneeId, newAssigneeId, reason } = parsed.data;
      if (!newAssigneeId && !parsed.data.targetDate) {
        return res.status(400).json({ message: 'Choose a new person or a new target date' });
      }

      const { tasks } = await collectOpenTasks();
      const task = tasks.find(t => t.key === taskKey && (!assigneeId || t.userId === assigneeId));
      if (!task) {
        return res.status(404).json({ message: 'This task is no longer open' });
      }
      if (!canManageTasks(user, task.initiatorId ?? null)) {
        return res.status(403).json({ message: 'Only the person who assigned this task (or an admin, the Quality Manager or the COO) can change it' });
      }

      const previousTarget = await getTaskTarget(taskKey);
      const targetDate = parsed.data.targetDate
        ? parseTargetDate(parsed.data.targetDate, task.taskType)
        : (previousTarget?.targetDate ?? task.dueAt ?? parseTargetDate(undefined, task.taskType));

      const moving = !!newAssigneeId && newAssigneeId !== task.userId;
      if (moving) {
        if (!REASSIGNABLE_TASK_TYPES.has(task.taskType)) {
          return res.status(400).json({ message: 'This kind of task cannot be moved to another person here. You can still change its target date.' });
        }
        const newAssignee = await storage.getUser(newAssigneeId!);
        if (!newAssignee) {
          return res.status(404).json({ message: 'New assignee not found' });
        }
        const entityId = task.entityId;
        switch (task.taskType) {
          case 'prepare':
          case 'revise':
          case 'review':
          case 'approve': {
            const doc = await storage.getDocument(task.documentId!);
            if (!doc) return res.status(404).json({ message: 'Document not found' });
            await reassignDocumentTask(doc, task.taskType, newAssigneeId!, user.id, reason);
            break;
          }
          case 'employee_review':
          case 'employee_approve':
            await storage.updateEmployee(entityId, task.taskType === 'employee_review' ? { reviewerId: newAssigneeId } : { approverId: newAssigneeId });
            break;
          case 'comment': {
            const comment = await storage.getDocumentComment(entityId);
            if (!comment) return res.status(404).json({ message: 'Comment not found' });
            const assignees = Array.from(new Set(comment.assigneeIds.map(id => (id === task.userId ? newAssigneeId! : id))));
            await storage.updateDocumentComment(entityId, { assigneeIds: assignees });
            break;
          }
          case 'bug':
            await storage.updateBugReport(entityId, { assignedToId: newAssigneeId } as any);
            break;
          case 'lead_followup':
            await storage.updateLead(entityId, { assignedToId: newAssigneeId } as any);
            break;
        }
        if (!['prepare', 'revise', 'review', 'approve'].includes(task.taskType)) {
          await storage.createNotification({
            userId: newAssigneeId!,
            title: 'Task Assigned to You',
            message: `${user.name} assigned you: ${TASK_TYPE_LABELS[task.taskType] || task.taskType} - ${task.title}. Target: ${targetDate.toLocaleDateString('en-GB')}.${reason ? ` Reason: ${reason}` : ''}`,
            urgencyLevel: UrgencyLevel.HIGH,
            relatedDocumentId: task.documentId,
          });
          if (task.userId !== user.id) {
            await storage.createNotification({
              userId: task.userId,
              title: 'Task Reassigned',
              message: `${TASK_TYPE_LABELS[task.taskType] || task.taskType} - ${task.title} has been reassigned to ${newAssignee.name}.`,
              urgencyLevel: UrgencyLevel.MEDIUM,
              relatedDocumentId: task.documentId,
            });
          }
        }
      } else if (task.userId !== user.id) {
        await storage.createNotification({
          userId: task.userId,
          title: 'Target Date Changed',
          message: `${user.name} changed the target date of "${task.title}" to ${targetDate.toLocaleDateString('en-GB')}.${reason ? ` Reason: ${reason}` : ''}`,
          urgencyLevel: UrgencyLevel.MEDIUM,
          relatedDocumentId: task.documentId,
        });
      }

      await setTaskTarget(taskKey, {
        assigneeId: moving ? newAssigneeId : task.userId,
        initiatorId: task.initiatorId ?? user.id,
        targetDate,
        note: reason || null,
      });

      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.ASSIGN_TASK,
        entityType: 'task',
        entityId: task.entityId,
        previousValue: JSON.stringify({ taskKey, assigneeId: task.userId, targetDate: task.dueAt }),
        newValue: JSON.stringify({ taskKey, assigneeId: moving ? newAssigneeId : task.userId, targetDate, reason }),
      });

      res.json({ success: true, taskKey, assigneeId: moving ? newAssigneeId : task.userId, targetDate });
    } catch (err) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'targetDate' });
      console.error('Error changing task:', err);
      res.status(500).json({ message: 'Failed to change task' });
    }
  });

  // Task performance for one person and month (own figures, or anyone's for admins)
  app.get('/api/task-performance', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = req.query.userId ? Number(req.query.userId) : user.id;
      if (userId !== user.id && user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: 'You can only view your own task performance' });
      }
      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();
      await reconcileTasks();
      const { start, end } = monthRange(month, year);
      res.json({ userId, month, year, ...(await computeTaskMetrics(userId, start, end)) });
    } catch (err) {
      console.error('Error computing task performance:', err);
      res.status(500).json({ message: 'Failed to compute task performance' });
    }
  });

  // Complete a task from my-tasks (transitions document workflow)
  app.post('/api/my-tasks/:documentId/complete', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.documentId);
      const userId = getCurrentUserId(req);
      const { taskType, comments, approverId } = req.body;
      // Target for the next person: the approver after a review, the COO after an approval
      const nextTarget = parseTargetDate(req.body.nextTargetDate, taskType === 'review' ? 'approve' : 'hub_approval');

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
          returnedAt: null,
          returnedById: null,
          returnNote: null,
        };
        
        // If a new approver is selected, update the approver
        const finalApproverId = approverId || doc.approverId;
        if (approverId) {
          updateData.approverId = approverId;
        }

        const updated = await storage.updateDocument(documentId, updateData);
        if (finalApproverId) {
          await setTaskTarget(`approve:${documentId}`, { assigneeId: finalApproverId, initiatorId: userId, targetDate: nextTarget });
        }

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

        // Update live performance report stats
        await storage.updateLiveReportStats(userId, 'document_reviewed');

        res.json(updated);
      } else if (taskType === 'approve') {
        if (doc.approverId !== userId) {
          return res.status(403).json({ message: 'You are not the assigned approver' });
        }
        if (doc.status !== DocumentStatus.PENDING_APPROVAL) {
          return res.status(400).json({ message: 'Document is not pending approval' });
        }

        // Approve and move to the Document Hub. The document stays unlocked until
        // the COO gives final approval and classifies it (see /hub-approve).
        const updated = await storage.updateDocument(documentId, {
          status: DocumentStatus.APPROVED,
          approvedAt: new Date(),
          approvedBySignedAt: new Date(),
          hubStatus: DocumentHubStatus.PENDING_COO_APPROVAL,
          transferredToHubAt: new Date(),
          returnedAt: null,
          returnedById: null,
          returnNote: null,
        });

        const cooUser = await storage.getUserByEmail(COO_EMAIL);
        if (cooUser) {
          await setTaskTarget(`hub_approval:${documentId}`, { assigneeId: cooUser.id, initiatorId: userId, targetDate: nextTarget });
          await storage.createNotification({
            userId: cooUser.id,
            title: 'Document Awaiting Final Approval',
            message: `Document "${doc.title}" (${doc.documentCode}) has been approved and moved to the Document Hub. Your final approval and classification are required.`,
            urgencyLevel: UrgencyLevel.HIGH,
            relatedDocumentId: documentId,
          });
        }

        await storage.createAuditLog({
          userId,
          action: AuditAction.APPROVE,
          entityType: 'document',
          entityId: documentId,
          previousValue: JSON.stringify({ status: doc.status }),
          newValue: JSON.stringify({ status: updated.status, comments }),
        });

        // Generate Document Approval Report and send to Admin(s)
        try {
          const allUsers = await storage.getUsers();
          const preparedBy = allUsers.find(u => u.id === doc.preparedById);
          const reviewer = allUsers.find(u => u.id === doc.reviewerId);
          const approver = allUsers.find(u => u.id === doc.approverId);
          const admins = allUsers.filter(u => u.role === UserRole.ADMIN);

          const reportNumber = await storage.generateReportNumber(ReportType.DOCUMENT_APPROVAL);
          const reportTitle = 'Document Approval Completion Report';
          const reportContent = `
            <p>This report confirms the successful approval of document <strong>${doc.documentCode}</strong>.</p>
            <p><strong>Document Title:</strong> ${doc.title}</p>
            <p><strong>Category:</strong> ${doc.category}</p>
            <p><strong>Edition:</strong> Ed.${doc.editionNumber} Rev.${doc.revisionNumber}</p>
            <p><strong>Approval Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            ${comments ? `<p><strong>Approval Comments:</strong> ${comments}</p>` : ''}
            <p style="margin-top: 20px;">The document has been reviewed and approved according to the Quality Management System procedures.</p>
          `;

          const pdfDataUrl = await generateReportPdf(
            ReportType.DOCUMENT_APPROVAL,
            reportTitle,
            reportContent,
            {
              documentCode: doc.documentCode,
              documentTitle: doc.title,
              preparedByName: preparedBy?.name,
              preparedBySignature: preparedBy?.signatureDataUrl,
              preparedBySignedAt: doc.preparedBySignedAt,
              reviewerName: reviewer?.name,
              reviewerSignature: reviewer?.signatureDataUrl,
              reviewerSignedAt: doc.reviewedBySignedAt,
              approverName: approver?.name,
              approverSignature: approver?.signatureDataUrl,
              approverSignedAt: new Date(),
              reportNumber,
              generatedAt: new Date(),
            }
          );

          // Create user records for all admin users
          for (const admin of admins) {
            await storage.createUserRecord({
              userId: admin.id,
              reportType: ReportType.DOCUMENT_APPROVAL,
              reportTitle,
              reportNumber,
              relatedDocumentId: documentId,
              pdfDataUrl,
              reviewerId: reviewer?.id,
              reviewerName: reviewer?.name,
              reviewerSignatureDataUrl: reviewer?.signatureDataUrl,
              reviewerSignedAt: doc.reviewedBySignedAt,
              approverId: approver?.id,
              approverName: approver?.name,
              approverSignatureDataUrl: approver?.signatureDataUrl,
              approverSignedAt: new Date(),
              metadata: JSON.stringify({ 
                documentCode: doc.documentCode, 
                documentTitle: doc.title, 
                assignedBy: doc.createdById,
                assignedByName: allUsers.find(u => u.id === doc.createdById)?.name || 'Unknown'
              }),
            });

            await storage.createNotification({
              userId: admin.id,
              title: 'Document Approval Report Generated',
              message: `Document "${doc.title}" (${doc.documentCode}) has been approved. A completion report has been saved to your User Records.`,
              urgencyLevel: UrgencyLevel.LOW,
              relatedDocumentId: documentId,
            });
          }

          // Also create a record for the document creator (if not already an admin)
          const documentCreator = allUsers.find(u => u.id === doc.createdById);
          if (documentCreator && !admins.find(a => a.id === documentCreator.id)) {
            await storage.createUserRecord({
              userId: documentCreator.id,
              reportType: ReportType.DOCUMENT_APPROVAL,
              reportTitle,
              reportNumber,
              relatedDocumentId: documentId,
              pdfDataUrl,
              reviewerId: reviewer?.id,
              reviewerName: reviewer?.name,
              reviewerSignatureDataUrl: reviewer?.signatureDataUrl,
              reviewerSignedAt: doc.reviewedBySignedAt,
              approverId: approver?.id,
              approverName: approver?.name,
              approverSignatureDataUrl: approver?.signatureDataUrl,
              approverSignedAt: new Date(),
              metadata: JSON.stringify({ 
                documentCode: doc.documentCode, 
                documentTitle: doc.title, 
                assignedBy: doc.createdById,
                assignedByName: documentCreator.name
              }),
            });

            await storage.createNotification({
              userId: documentCreator.id,
              title: 'Your Document Has Been Approved',
              message: `Document "${doc.title}" (${doc.documentCode}) that you created has been approved. A completion report has been saved to your User Records.`,
              urgencyLevel: UrgencyLevel.LOW,
              relatedDocumentId: documentId,
            });
          }
        } catch (reportErr) {
          console.error('Error generating document approval report:', reportErr);
        }

        // Update live performance report stats
        await storage.updateLiveReportStats(userId, 'document_approved');

        res.json(updated);
      } else {
        return res.status(400).json({ message: 'Invalid task type' });
      }
    } catch (err) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'nextTargetDate' });
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

      const targetDate = parseTargetDate(input.targetDate, 'employee_review');
      const employee = await storage.submitEmployeeForReview(id, input.reviewerId, input.notes);
      await setTaskTarget(`employee_review:${id}`, { assigneeId: input.reviewerId, initiatorId: getCurrentUserId(req), targetDate });

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
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'targetDate' });
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

      const targetDate = parseTargetDate(input.targetDate, 'employee_approve');
      const employee = await storage.submitEmployeeForApproval(id, input.approverId, input.notes);
      await setTaskTarget(`employee_approve:${id}`, { assigneeId: input.approverId, initiatorId: getCurrentUserId(req), targetDate });

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
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'targetDate' });
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
      const approvedEmployee = await storage.approveEmployee(id, currentUserId, input.notes);

      // Create notification for creator
      if (existing.createdByUserId) {
        await storage.createNotification({
          userId: existing.createdByUserId,
          title: 'Employee Record Approved',
          message: `Employee record for "${approvedEmployee.name}" (${approvedEmployee.employeeNumber}) has been approved.`,
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

      // Generate Staff Confirmation Report and send to HR and employee
      try {
        const allUsers = await storage.getUsers();
        const reviewer = existing.reviewerId ? allUsers.find(u => u.id === existing.reviewerId) : undefined;
        const approver = allUsers.find(u => u.id === currentUserId);
        const hrUsers = allUsers.filter(u => u.email?.toLowerCase().includes('hr@') || u.role === UserRole.ADMIN);
        const linkedUser = approvedEmployee.userId ? allUsers.find(u => u.id === approvedEmployee.userId) : undefined;

        const reportNumber = await storage.generateReportNumber(ReportType.STAFF_CONFIRMATION);
        const reportTitle = 'Staff Confirmation Report';
        const reportContent = `
          <p>This report confirms the successful addition and approval of employee <strong>${approvedEmployee.name}</strong> to Sahih Certifications.</p>
          <p><strong>Employee Number:</strong> ${approvedEmployee.employeeNumber}</p>
          <p><strong>Job Title:</strong> ${approvedEmployee.jobTitle}</p>
          <p><strong>Department:</strong> ${approvedEmployee.department}</p>
          <p><strong>Employment Type:</strong> ${approvedEmployee.employmentType?.replace('_', ' ')}</p>
          <p><strong>Hire Date:</strong> ${approvedEmployee.hireDate ? new Date(approvedEmployee.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
          <p><strong>Approval Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          ${input.notes ? `<p><strong>Approval Notes:</strong> ${input.notes}</p>` : ''}
          <p style="margin-top: 20px;">The employee record has been verified and approved according to HR procedures.</p>
        `;

        const pdfDataUrl = await generateReportPdf(
          ReportType.STAFF_CONFIRMATION,
          reportTitle,
          reportContent,
          {
            employeeName: approvedEmployee.name,
            employeeNumber: approvedEmployee.employeeNumber,
            department: approvedEmployee.department,
            jobTitle: approvedEmployee.jobTitle,
            hireDate: approvedEmployee.hireDate ? new Date(approvedEmployee.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
            reviewerName: reviewer?.name,
            reviewerSignature: reviewer?.signatureDataUrl,
            reviewerSignedAt: existing.reviewedAt,
            approverName: approver?.name,
            approverSignature: approver?.signatureDataUrl,
            approverSignedAt: new Date(),
            reportNumber,
            generatedAt: new Date(),
          }
        );

        // Create user records for HR users
        for (const hrUser of hrUsers) {
          await storage.createUserRecord({
            userId: hrUser.id,
            reportType: ReportType.STAFF_CONFIRMATION,
            reportTitle,
            reportNumber,
            relatedEmployeeId: id,
            pdfDataUrl,
            reviewerId: reviewer?.id,
            reviewerName: reviewer?.name,
            reviewerSignatureDataUrl: reviewer?.signatureDataUrl,
            reviewerSignedAt: existing.reviewedAt,
            approverId: approver?.id,
            approverName: approver?.name,
            approverSignatureDataUrl: approver?.signatureDataUrl,
            approverSignedAt: new Date(),
            metadata: JSON.stringify({ 
              employeeName: approvedEmployee.name, 
              employeeNumber: approvedEmployee.employeeNumber,
              assignedBy: existing.createdById,
              assignedByName: allUsers.find(u => u.id === existing.createdById)?.name || 'Unknown'
            }),
          });

          await storage.createNotification({
            userId: hrUser.id,
            title: 'Staff Confirmation Report Generated',
            message: `Employee "${approvedEmployee.name}" (${approvedEmployee.employeeNumber}) has been confirmed. A Staff Confirmation report has been saved to your User Records.`,
            urgencyLevel: UrgencyLevel.LOW,
          });
        }

        // Also send to the employee if they have a linked user account
        if (linkedUser && !hrUsers.find(u => u.id === linkedUser.id)) {
          await storage.createUserRecord({
            userId: linkedUser.id,
            reportType: ReportType.STAFF_CONFIRMATION,
            reportTitle,
            reportNumber,
            relatedEmployeeId: id,
            pdfDataUrl,
            reviewerId: reviewer?.id,
            reviewerName: reviewer?.name,
            reviewerSignatureDataUrl: reviewer?.signatureDataUrl,
            reviewerSignedAt: existing.reviewedAt,
            approverId: approver?.id,
            approverName: approver?.name,
            approverSignatureDataUrl: approver?.signatureDataUrl,
            approverSignedAt: new Date(),
            metadata: JSON.stringify({ 
              employeeName: approvedEmployee.name, 
              employeeNumber: approvedEmployee.employeeNumber,
              assignedBy: existing.createdById,
              assignedByName: allUsers.find(u => u.id === existing.createdById)?.name || 'Unknown'
            }),
          });

          await storage.createNotification({
            userId: linkedUser.id,
            title: 'Your Staff Confirmation Report',
            message: `Your employee record has been confirmed. A Staff Confirmation report has been saved to your User Records.`,
            urgencyLevel: UrgencyLevel.LOW,
          });
        }
      } catch (reportErr) {
        console.error('Error generating staff confirmation report:', reportErr);
      }

      res.json(approvedEmployee);
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

  app.post(api.employees.reassign.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
      }

      const input = api.employees.reassign.input.parse(req.body);
      
      const existing = await storage.getEmployee(id);
      if (!existing) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      const newAssignee = await storage.getUser(input.newAssigneeId);
      if (!newAssignee) {
        return res.status(400).json({ message: 'New assignee not found', field: 'newAssigneeId' });
      }

      const currentUserId = getCurrentUserId(req);
      let updateData: { reviewerId?: number; approverId?: number } = {};
      let notificationTitle = '';
      let notificationMessage = '';

      if (input.taskType === 'employee_review') {
        if (existing.workflowStatus !== 'in_review') {
          return res.status(400).json({ message: 'Can only re-assign review task for employees in In-Review status' });
        }
        updateData = { reviewerId: input.newAssigneeId };
        notificationTitle = 'Employee Review Task Re-assigned';
        notificationMessage = `You have been assigned to review the employee record for "${existing.name}" (${existing.employeeNumber}).`;
      } else if (input.taskType === 'employee_approve') {
        if (existing.workflowStatus !== 'pending_approval') {
          return res.status(400).json({ message: 'Can only re-assign approval task for employees in Pending Approval status' });
        }
        updateData = { approverId: input.newAssigneeId };
        notificationTitle = 'Employee Approval Task Re-assigned';
        notificationMessage = `You have been assigned to approve the employee record for "${existing.name}" (${existing.employeeNumber}).`;
      }

      const targetDate = parseTargetDate(input.targetDate, input.taskType);
      const employee = await storage.updateEmployee(id, updateData);
      const previousTarget = await getTaskTarget(`${input.taskType}:${id}`);
      await setTaskTarget(`${input.taskType}:${id}`, {
        assigneeId: input.newAssigneeId,
        initiatorId: previousTarget?.initiatorId ?? getCurrentUserId(req),
        targetDate,
        note: input.notes,
      });

      // Create notification for new assignee
      await storage.createNotification({
        userId: input.newAssigneeId,
        title: notificationTitle,
        message: notificationMessage,
        urgencyLevel: 'medium',
      });

      // Audit log
      await storage.createAuditLog({
        userId: currentUserId,
        action: AuditAction.ASSIGN_TASK,
        entityType: 'employee',
        entityId: id,
        previousValue: JSON.stringify({ 
          reviewerId: existing.reviewerId, 
          approverId: existing.approverId 
        }),
        newValue: JSON.stringify({ 
          ...updateData, 
          taskType: input.taskType,
          notes: input.notes 
        }),
      });

      res.json(employee);
    } catch (err) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'targetDate' });
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

    // Access control for locked/approved documents
    const userId = getCurrentUserId(req);
    const currentUser = await storage.getUser(userId);
    const COO_EMAIL = 'coo@sahihcertify.com';
    
    if ((doc.isLocked || doc.status === DocumentStatus.APPROVED) && currentUser?.email !== COO_EMAIL) {
      const hasAccess = isPublicHubDocument(doc) || await storage.hasDocumentAccess(doc.id, userId);
      const isWorkflowMember = doc.createdById === userId || doc.reviewerId === userId || doc.approverId === userId;
      
      if (isWithdrawnDocument(doc) || (!hasAccess && !isWorkflowMember)) {
        return res.status(403).json({ message: 'Access denied. This document is locked.' });
      }
    }

    try {
      console.log(`PDF generation started for document ${doc.id}`);
      const users = await storage.getUsers();
      const preparedBy = users.find(u => u.id === doc.preparedById);
      const reviewedBy = users.find(u => u.id === doc.reviewerId);
      const approvedBy = users.find(u => u.id === doc.approverId);
      
      // Fetch revision history for the document
      const revisionHistoryEntries = await storage.getRevisionHistory(doc.id);

      // Proper Sahih Certifications logo (burgundy/maroon colored)
      const companyLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAflBMVEUAAAD///9DQ0P39/eXl5eMjIz09PT6+voeHh51dXXMzMyvr6/R0dEdHR3l5eUhISHb29txcXFYWFi2tranp6dISEiRkZHt7e3X19ecnJzIyMh/f39gYGBmZmbCwsLi4uJRUVELCwsTExM9PT2GhoYrKys1NTV9fX0vLy8REREaTdafAAAJA0lEQVR4nO2dB5eqvBZAc0ThAxlEql0s43j//x9854QyFlTUJOC87FnrWoDANpCeXMY0Go1Go9FoNBqNRqPRaDQajUaj0Wg0Go00Ist4Ayv9fnyKAdw4Gkby/RgbwjsYjQRv8p98vzcNzQaRcEew+4bGm4KdNzS+Hgd/V7Drhm/HYNcN30xkum8oQrDThgJu0W4bmm8nMhwlOX70kqCQGASQr0e47QnG8u04TyuKeQbVCT6t+HmCTyoaDRLArgk+pfhpz2BJY8VPFWys+LmCDRUFJTJWG4KNFN+vLuUM5dvU8lBRVDYBEMm3qeWBoimiNtGyonNXUFgMtql4JxbFCnZQUVB1qbuKomOwc4riUtGOKgppk+myopwYJJS0YtRwkWmIKslcs5LvcoOzWJSRyLQteKb4NwVPFP+qYKUoL5GZyXd4gPvXBbmiPMG2b9Ec968LMiapJNMdwQa8JghpgzJEN3hRsFke1AVeFvwUxTcEm/UNtM1bghiLnVd8U7D7im8Ldv1ZFCCoTNF+5SAhgqgoWqaWcPL8MYIEAZTk/ENwnj1EmKAqw2cVxQkqM3xOUaCgOsNn6qMiBRUaNo9FoYJKx7U1VBQrqHbknttkZ8GCisfqN4hF0YKqZyM8VBQuqHy+xYMUVbwgNGgJEmp4X1GCoHrDezeqDME2xgjfVJQiCBsVhheXfkNRjqCaUdD2xUlrFSUJqqkfxpenrUluJAmCr8SQXZ33KhZlCUKoxnD9SFGaIMzVGNZMuDi7UeUJqskOGQtqTn0SixIFPTWCjBn3FCUKqhswVDvzyZEvCAdVhrva0zvSBRXlFcSk9gJmkgVhrM6wLq1BVnupgqk6QcZ8qSo3+FFpeFVyU4DSKGRspd4wUGu4VS6ofMCJ3ETlGku14K0cQxoKc4qSjaVSUFG16ZwbmaIUlBW5z+mrM2xriMJMlaDijOKE69q+FPatCTKWqhBsaxoJZ1RXGRZMW/NHC47S84zWB8/KVmxdkLFvqYodEMRn0ZQn2PIzWLLxZAlO21tareGFFeujfIb/LUyxr8H8PTfJYYjlUuukd7oyxIp8/9pwSpOFasYzU+NawMeRrsBLlmF9bZa+u7FJGiFYYZietBv+xuF8yq4MPaziO+n1stEhL6wMqBRqUDnmi1oVr+A1xfpN8jDpehgNUd7ZcypxDLAMEsypxSTORmjo4aeqUSbMm3Co5jAaj+klyFhg09I2vWDLsuyLfRkwCNhXltH+mb2kMttibn/zoGf49SiLi030EgdsM7Z5pC7shYyh0mlRY/niU9V8ugyPhpCMSX5MhjTBqxyF/juceUq74wewsOKUrxjSYzR5Oa88LakyNvJ4kAn/6icvwpkYpIVlVdpkLeimWPFvWVY0AQlnXg6RnA0WYwuWNIQ0nHtUmEzxkw2wmq/zRga8iuoRGkN6yMgCL8ud0eyhXvCPWWgYG7DP2JIueg3pfL9n49DOQrzbjzOYxRkeanKxY0TH+2D08Sewsf4//Q6kjOenqU3rokruwz5/Dvf0+OWGKelYpVdZN5hQ/PmQsXzOeZBvIMP8vifD3kmSElAQIb9fyDDm+1so5lMN0ocEQ3SkTYmK+CIxNp+jXhjOzwyXpWFWLa2WgmGYwA13F4YGHsYN5+WaCSHdgMapoc0rjj5MuRzaJXxtHGmOGPhuSY+e/8CQAfRLw+lyuRx/3TO0ixUfMXYOwblhHqKPoVWGbBtZUpY6if/xPpjvIXXKPDQc8iotizHTC0tnMlzUGX4DLPNdFvgjcsNVYbjlNzf9UxluyuNFM4G1T2kYJinR8OZdWlXNcd/Ut9b0jPmh65eG+HHiLfOHsjA0+IpFrj/BBGed+PQjYfrreHlKE4IRefSjrsmQItPxI9xfQq9c4ltgUusJ3iOrmfnD5qaDD6WJaalvLtjYRIuF+bsISYKPa4qJQ+ZTIyH+DCbvbMAfx93hhwyvGQ/DQyj5jUwK++CD2acgNvgmZMtqE7WZOuYe03FzwBIqTPy9JgCNRqPRaDQajUaj0Wg0Go1Go9FoNBqNRqPRaBj7H1jSihu7Sk26AAAAAElFTkSuQmCC';

      // Structure to hold TOC entries
      interface TocEntry {
        level: number;
        number: string;
        title: string;
        id: string;
      }
      
      // Process content to add automatic numbering, IDs to headings, and build TOC
      const processContentWithToc = (content: string): { processedContent: string; tocEntries: TocEntry[] } => {
        if (!content) return { processedContent: '', tocEntries: [] };
        
        const tocEntries: TocEntry[] = [];
        let h1Counter = 0;
        let h2Counter = 0;
        let h3Counter = 0;
        let h4Counter = 0;
        
        // First pass: collect all headings and assign IDs
        let processed = content;
        
        // Handle h1 tags
        processed = processed.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/gi, (match, attrs, text) => {
          h1Counter++;
          h2Counter = 0;
          h3Counter = 0;
          h4Counter = 0;
          const cleanText = text.replace(/<[^>]*>/g, '').replace(/^[\d.]+\s*/, '').trim();
          const sectionNum = `${h1Counter}`;
          const anchorId = `section-${sectionNum.replace(/\./g, '-')}`;
          tocEntries.push({ level: 1, number: sectionNum, title: cleanText, id: anchorId });
          return `<h1${attrs} id="${anchorId}"><span class="section-number">${sectionNum}.</span> ${cleanText}</h1>`;
        });
        
        // Handle h2 tags
        processed = processed.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (match, attrs, text) => {
          h2Counter++;
          h3Counter = 0;
          h4Counter = 0;
          const cleanText = text.replace(/<[^>]*>/g, '').replace(/^[\d.]+\s*/, '').trim();
          const sectionNum = `${h1Counter}.${h2Counter}`;
          const anchorId = `section-${sectionNum.replace(/\./g, '-')}`;
          tocEntries.push({ level: 2, number: sectionNum, title: cleanText, id: anchorId });
          return `<h2${attrs} id="${anchorId}"><span class="section-number">${sectionNum}</span> ${cleanText}</h2>`;
        });
        
        // Handle h3 tags
        processed = processed.replace(/<h3([^>]*)>([\s\S]*?)<\/h3>/gi, (match, attrs, text) => {
          h3Counter++;
          h4Counter = 0;
          const cleanText = text.replace(/<[^>]*>/g, '').replace(/^[\d.]+\s*/, '').trim();
          const sectionNum = `${h1Counter}.${h2Counter}.${h3Counter}`;
          const anchorId = `section-${sectionNum.replace(/\./g, '-')}`;
          tocEntries.push({ level: 3, number: sectionNum, title: cleanText, id: anchorId });
          return `<h3${attrs} id="${anchorId}"><span class="section-number">${sectionNum}</span> ${cleanText}</h3>`;
        });
        
        // Handle h4 tags
        processed = processed.replace(/<h4([^>]*)>([\s\S]*?)<\/h4>/gi, (match, attrs, text) => {
          h4Counter++;
          const cleanText = text.replace(/<[^>]*>/g, '').replace(/^[\d.]+\s*/, '').trim();
          const sectionNum = `${h1Counter}.${h2Counter}.${h3Counter}.${h4Counter}`;
          const anchorId = `section-${sectionNum.replace(/\./g, '-')}`;
          tocEntries.push({ level: 4, number: sectionNum, title: cleanText, id: anchorId });
          return `<h4${attrs} id="${anchorId}"><span class="section-number">${sectionNum}</span> ${cleanText}</h4>`;
        });
        
        return { processedContent: processed, tocEntries };
      };
      
      // Generate Table of Contents HTML
      const generateTocHtml = (entries: TocEntry[]): string => {
        if (entries.length === 0) return '';
        
        let tocHtml = `
          <div class="toc">
            <h2 class="toc-title">TABLE OF CONTENTS</h2>
            <div class="toc-entries">
        `;
        
        entries.forEach(entry => {
          const indent = (entry.level - 1) * 20;
          tocHtml += `
            <div class="toc-entry toc-level-${entry.level}" style="padding-left: ${indent}px;">
              <a href="#${entry.id}" class="toc-link">
                <span class="toc-number">${entry.number}</span>
                <span class="toc-text">${entry.title}</span>
                <span class="toc-dots"></span>
              </a>
            </div>
          `;
        });
        
        tocHtml += `
            </div>
          </div>
          <div class="page-break"></div>
        `;
        
        return tocHtml;
      };
      
      const { processedContent, tocEntries } = processContentWithToc(doc.content || '');
      const tocHtml = generateTocHtml(tocEntries);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            /* A4 Paper Size: 210mm x 297mm */
            @page { 
              size: A4 portrait; 
              margin: 25mm 20mm 30mm 20mm;
            }
            
            * { box-sizing: border-box; }
            
            body { 
              font-family: 'Times New Roman', Times, serif; 
              font-size: 11pt; 
              line-height: 1.5; 
              margin: 0; 
              padding: 0;
              color: #000;
            }
            
            /* Page border wrapper */
            .page-wrapper {
              border: 2px solid #000;
              padding: 15px 20px;
              min-height: 100%;
            }
            
            /* Header styling */
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              border-bottom: 2px solid #000; 
              padding-bottom: 10px; 
              margin-bottom: 15px; 
            }
            .logo-container { display: flex; align-items: center; gap: 12px; }
            .logo-img { height: 112px; width: auto; }
            .company-name { font-weight: bold; font-size: 14pt; }
            .doc-info { text-align: right; font-size: 9pt; }
            
            /* Document title */
            .doc-title {
              text-align: center;
              font-size: 16pt;
              font-weight: bold;
              margin: 15px 0 25px 0;
              text-transform: uppercase;
              border: none;
            }
            
            /* Table of Contents styling */
            .toc {
              margin: 20px 0;
              page-break-after: always;
            }
            
            .toc-title {
              text-align: center;
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 20px;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            
            .toc-entries {
              margin-top: 15px;
            }
            
            .toc-entry {
              margin: 8px 0;
              display: flex;
              align-items: baseline;
            }
            
            .toc-link {
              display: flex;
              width: 100%;
              text-decoration: none;
              color: #000;
              align-items: baseline;
            }
            
            .toc-link:hover {
              color: #0066cc;
            }
            
            .toc-number {
              font-weight: bold;
              min-width: 50px;
              flex-shrink: 0;
            }
            
            .toc-text {
              flex-shrink: 0;
            }
            
            .toc-dots {
              flex-grow: 1;
              border-bottom: 1px dotted #666;
              margin: 0 8px 4px 8px;
              min-width: 20px;
            }
            
            .toc-level-1 { font-weight: bold; font-size: 11pt; }
            .toc-level-2 { font-size: 10pt; }
            .toc-level-3 { font-size: 10pt; }
            .toc-level-4 { font-size: 9pt; font-style: italic; }
            
            /* Content area */
            .content { 
              min-height: 400px;
            }
            
            /* Automatic section numbering styles */
            .section-number {
              font-weight: bold;
              margin-right: 8px;
            }
            
            .content h1 {
              font-size: 14pt;
              font-weight: bold;
              margin: 20px 0 10px 0;
              padding-bottom: 5px;
              border-bottom: 1px solid #333;
              page-break-after: avoid;
            }
            
            .content h2 {
              font-size: 12pt;
              font-weight: bold;
              margin: 15px 0 8px 0;
              page-break-after: avoid;
            }
            
            .content h3 {
              font-size: 11pt;
              font-weight: bold;
              margin: 12px 0 6px 0;
              page-break-after: avoid;
            }
            
            .content h4 {
              font-size: 11pt;
              font-weight: bold;
              font-style: italic;
              margin: 10px 0 5px 0;
              page-break-after: avoid;
            }
            
            .content p {
              margin: 8px 0;
              text-align: justify;
            }
            
            /* Table styling - proper alignment */
            .content table { 
              border-collapse: collapse; 
              width: 100%; 
              margin: 15px 0; 
              font-size: 10pt;
              page-break-inside: avoid;
            }
            
            .content table th { 
              border: 1.5px solid #000; 
              padding: 8px 10px; 
              background-color: #e8e8e8;
              font-weight: bold;
              text-align: left;
              vertical-align: middle;
            }
            
            .content table td { 
              border: 1px solid #000; 
              padding: 6px 10px; 
              text-align: left;
              vertical-align: top;
            }
            
            /* Numeric columns aligned right */
            .content table td.numeric,
            .content table th.numeric {
              text-align: right;
            }
            
            /* Center aligned columns */
            .content table td.center,
            .content table th.center {
              text-align: center;
            }
            
            /* Alternating row colors for readability */
            .content table tbody tr:nth-child(even) {
              background-color: #f5f5f5;
            }
            
            /* Table caption */
            .content table caption {
              font-weight: bold;
              margin-bottom: 8px;
              text-align: left;
              font-size: 10pt;
            }
            
            /* List styling with proper indentation */
            .content ul, .content ol {
              margin: 10px 0;
              padding-left: 25px;
            }
            
            .content li {
              margin: 5px 0;
            }
            
            /* Nested lists */
            .content ul ul, .content ol ol, .content ul ol, .content ol ul {
              margin: 5px 0;
            }
            
            /* Images */
            .content img { 
              max-width: 100%; 
              height: auto;
              page-break-inside: avoid;
            }
            
            /* Signature section */
            .signatures { 
              margin-top: 40px; 
              display: flex; 
              justify-content: space-between; 
              border-top: 1px solid #000; 
              padding-top: 20px;
              page-break-inside: avoid;
            }
            .signature-block { 
              width: 30%; 
              text-align: center; 
            }
            .signature-line { 
              border-top: 1px solid #000; 
              margin-top: 40px; 
              padding-top: 5px; 
            }
            
            /* Page break controls */
            .page-break { page-break-before: always; }
            .no-break { page-break-inside: avoid; }
            
            /* Page number footer */
            .page-footer {
              position: fixed;
              bottom: 10mm;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 9pt;
              color: #333;
            }
            
            /* Document info in footer */
            .footer-info {
              display: flex;
              justify-content: space-between;
              font-size: 8pt;
              color: #666;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #ccc;
            }
            /* Revision History Table */
            .revision-history {
              margin-top: 30px;
              page-break-inside: avoid;
            }
            .revision-history-title {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .revision-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9pt;
            }
            .revision-table th {
              background-color: #8b1538;
              color: white;
              padding: 8px 6px;
              text-align: left;
              border: 1px solid #000;
              font-weight: bold;
            }
            .revision-table td {
              padding: 6px;
              border: 1px solid #000;
              vertical-align: top;
            }
            .revision-table tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            
            /* Status badge */
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 10pt;
            }
            .status-current {
              background-color: #22c55e;
              color: white;
            }
            .status-draft {
              background-color: #f59e0b;
              color: white;
            }
            .status-review {
              background-color: #3b82f6;
              color: white;
            }
          </style>
        </head>
        <body>
          <div class="page-wrapper">
            <div class="header">
              <div class="logo-container">
                <img src="${companyLogoBase64}" alt="Sahih Certifications" class="logo-img" />
                <div class="company-name">SAHIH CERTIFICATIONS</div>
              </div>
              <div class="doc-info">
                <div><strong>${doc.documentCode}</strong></div>
                <div>Edition: ${doc.editionNumber || 1} | Revision: ${doc.revisionNumber || 0}</div>
                <div>Status: <span class="status-badge ${doc.status === 'approved' ? 'status-current' : doc.status === 'draft' ? 'status-draft' : 'status-review'}">${doc.status === 'approved' ? 'CURRENT' : doc.status.toUpperCase().replace('_', ' ')}</span></div>
              </div>
            </div>
            
            <h1 class="doc-title">${doc.title}</h1>
            
            <!-- Document Info Table -->
            <table class="revision-table" style="margin-bottom: 20px;">
              <tr>
                <th style="width: 25%;">REVISION DETAILS</th>
                <th style="width: 75%;">${doc.title}</th>
              </tr>
              <tr>
                <td><strong>Document Code</strong></td>
                <td>${doc.documentCode}</td>
              </tr>
              <tr>
                <td><strong>Edition / Revision</strong></td>
                <td>Ed.${doc.editionNumber || 1} Rev.${doc.revisionNumber || 0}</td>
              </tr>
              <tr>
                <td><strong>Status</strong></td>
                <td>${doc.status === 'approved' ? 'CURRENT' : doc.status.toUpperCase().replace('_', ' ')}</td>
              </tr>
              <tr>
                <td><strong>Category</strong></td>
                <td>${doc.category || 'N/A'}</td>
              </tr>
              <tr>
                <td><strong>Issue Date</strong></td>
                <td>${doc.approvedBySignedAt ? new Date(doc.approvedBySignedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</td>
              </tr>
              <tr>
                <td><strong>Next Review Date</strong></td>
                <td>${doc.nextReviewDate ? new Date(doc.nextReviewDate).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
            </table>
            
            <!-- Signatories Table -->
            <table class="revision-table" style="margin-bottom: 20px;">
              <tr>
                <th>PREPARED BY</th>
                <th>REVIEWED BY</th>
                <th>APPROVED BY</th>
              </tr>
              <tr>
                <td style="text-align: center; padding: 15px;">
                  <div>${preparedBy?.name || 'N/A'}</div>
                  <div style="font-size: 8pt; color: #666; margin-top: 5px;">${doc.preparedBySignedAt ? new Date(doc.preparedBySignedAt).toLocaleDateString('en-GB') : '-'}</div>
                </td>
                <td style="text-align: center; padding: 15px;">
                  <div>${reviewedBy?.name || 'N/A'}</div>
                  <div style="font-size: 8pt; color: #666; margin-top: 5px;">${doc.reviewedBySignedAt ? new Date(doc.reviewedBySignedAt).toLocaleDateString('en-GB') : '-'}</div>
                </td>
                <td style="text-align: center; padding: 15px;">
                  <div>${approvedBy?.name || 'N/A'}</div>
                  <div style="font-size: 8pt; color: #666; margin-top: 5px;">${doc.approvedBySignedAt ? new Date(doc.approvedBySignedAt).toLocaleDateString('en-GB') : '-'}</div>
                </td>
              </tr>
            </table>
            
            <!-- Revision History Table -->
            <div class="revision-history">
              <div class="revision-history-title">REVISION HISTORY</div>
              <table class="revision-table">
                <thead>
                  <tr>
                    <th style="width: 8%;">ISSUE NO</th>
                    <th style="width: 10%;">REV NO</th>
                    <th style="width: 12%;">DATE</th>
                    <th style="width: 35%;">DESCRIPTION OF AMENDMENT</th>
                    <th style="width: 20%;">REASON</th>
                    <th style="width: 15%;">APPROVED BY</th>
                  </tr>
                </thead>
                <tbody>
                  ${revisionHistoryEntries.length > 0 ? revisionHistoryEntries.map((entry, index) => {
                    const approver = users.find(u => u.id === entry.approvedById);
                    return `
                      <tr>
                        <td style="text-align: center;">${doc.editionNumber || 1}</td>
                        <td style="text-align: center;">${entry.revisionNumber}</td>
                        <td>${entry.amendmentDate ? new Date(entry.amendmentDate).toLocaleDateString('en-GB') : '-'}</td>
                        <td>${entry.description || '-'}</td>
                        <td>${entry.reason || '-'}</td>
                        <td>${approver?.name || '-'}</td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr>
                      <td style="text-align: center;">${doc.editionNumber || 1}</td>
                      <td style="text-align: center;">${doc.revisionNumber || 0}</td>
                      <td>${doc.approvedBySignedAt ? new Date(doc.approvedBySignedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</td>
                      <td>Initial Release</td>
                      <td>New Document</td>
                      <td>${approvedBy?.name || '-'}</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
            
            <div class="page-break"></div>
            
            ${tocHtml}
            
            <div class="content">${processedContent}</div>
            
            <div class="signatures">
              <div class="signature-block">
                <div><strong>Prepared By</strong></div>
                <div class="signature-line">${preparedBy?.name || 'N/A'}</div>
              </div>
              <div class="signature-block">
                <div><strong>Reviewed By</strong></div>
                <div class="signature-line">${reviewedBy?.name || 'N/A'}</div>
              </div>
              <div class="signature-block">
                <div><strong>Approved By</strong></div>
                <div class="signature-line">${approvedBy?.name || 'N/A'}</div>
              </div>
            </div>
            
            <div class="footer-info">
              <span>Document: ${doc.documentCode}</span>
              <span>Controlled Document - Sahih Certifications</span>
              <span>Ed.${doc.editionNumber || 1} Rev.${doc.revisionNumber || 0}</span>
            </div>
          </div>
        </body>
        </html>
      `;

      console.log('Finding Chromium executable...');
      const chromiumPath = findChromiumPath();
      console.log(`Chromium path: ${chromiumPath || 'Not found, using bundled'}`);
      
      console.log('Launching Puppeteer browser...');
      const launchOptions: any = { 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ],
        timeout: 60000
      };
      
      if (chromiumPath) {
        launchOptions.executablePath = chromiumPath;
      }
      
      const browser = await puppeteer.launch(launchOptions);
      console.log('Puppeteer browser launched successfully');
      const page = await browser.newPage();
      
      // Block all external network requests to prevent SSRF vulnerabilities
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = request.url();
        // Only allow data: URLs (for embedded base64 images like the logo)
        if (url.startsWith('data:')) {
          request.continue();
        } else {
          request.abort();
        }
      });
      
      console.log('Setting page content...');
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      console.log('Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '25mm', right: '20mm', bottom: '30mm', left: '20mm' },
        printBackground: true,
        timeout: 60000,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width: 100%; font-size: 8pt; font-family: 'Times New Roman', serif; padding: 0 20mm; display: flex; justify-content: space-between; color: #666;">
            <span>${doc.documentCode}</span>
            <span>SAHIH CERTIFICATIONS</span>
            <span>Ed.${doc.editionNumber || 1} Rev.${doc.revisionNumber || 0}</span>
          </div>
        `,
        footerTemplate: `
          <div style="width: 100%; font-size: 9pt; font-family: 'Times New Roman', serif; padding: 0 20mm; display: flex; justify-content: center; color: #333; border-top: 1px solid #ccc; padding-top: 5px;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `
      });
      
      console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
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

  // LIGHTWEIGHT PDF GENERATION (Fast version without Puppeteer)
  app.post('/api/documents/:id/generate-pdf-light', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const doc = await storage.getDocument(id);
    
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const userId = getCurrentUserId(req);
    const currentUser = await storage.getUser(userId);
    const COO_EMAIL = 'coo@sahihcertify.com';
    
    if ((doc.isLocked || doc.status === DocumentStatus.APPROVED) && currentUser?.email !== COO_EMAIL) {
      const hasAccess = isPublicHubDocument(doc) || await storage.hasDocumentAccess(doc.id, userId);
      const isWorkflowMember = doc.createdById === userId || doc.reviewerId === userId || doc.approverId === userId;
      
      if (isWithdrawnDocument(doc) || (!hasAccess && !isWorkflowMember)) {
        return res.status(403).json({ message: 'Access denied. This document is locked.' });
      }
    }

    try {
      console.log(`Lightweight PDF generation started for document ${doc.id}`);
      const users = await storage.getUsers();
      const preparedBy = users.find(u => u.id === doc.preparedById);
      const reviewedBy = users.find(u => u.id === doc.reviewerId);
      const approvedBy = users.find(u => u.id === doc.approverId);

      // Create PDF document
      const pdfDoc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        bufferPages: true 
      });
      
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);
      });

      // Header
      pdfDoc.fontSize(10).fillColor('#666');
      pdfDoc.text('SAHIH CERTIFICATIONS', 50, 30, { align: 'center' });
      pdfDoc.text(`${doc.documentCode} | Ed.${doc.editionNumber || 2} Rev.${doc.revisionNumber || 0}`, 50, 42, { align: 'center' });
      
      // Horizontal line
      pdfDoc.moveTo(50, 55).lineTo(545, 55).stroke('#000');
      
      // Title
      pdfDoc.moveDown(1);
      pdfDoc.fontSize(16).fillColor('#000');
      pdfDoc.text(doc.title, { align: 'center' });
      
      // Document info
      pdfDoc.moveDown(0.5);
      pdfDoc.fontSize(10).fillColor('#666');
      pdfDoc.text(`Category: ${doc.category || 'N/A'} | Status: ${doc.status}`, { align: 'center' });
      
      pdfDoc.moveDown(1);
      pdfDoc.moveTo(50, pdfDoc.y).lineTo(545, pdfDoc.y).stroke('#ccc');
      
      // Content - Strip HTML tags and render as plain text
      pdfDoc.moveDown(1);
      pdfDoc.fontSize(11).fillColor('#000');
      
      if (doc.content) {
        // Strip HTML tags and decode entities
        let plainText = doc.content
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/h[1-6]>/gi, '\n\n')
          .replace(/<li>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        pdfDoc.text(plainText, {
          align: 'left',
          lineGap: 3
        });
      } else {
        pdfDoc.text('No content available.', { align: 'center' });
      }
      
      // Signature section - ensure it's at the bottom
      const pageHeight = 841.89; // A4 height in points
      const signatureY = pageHeight - 150;
      
      if (pdfDoc.y < signatureY - 50) {
        pdfDoc.y = signatureY;
      } else {
        pdfDoc.addPage();
        pdfDoc.y = signatureY;
      }
      
      pdfDoc.moveTo(50, pdfDoc.y).lineTo(545, pdfDoc.y).stroke('#ccc');
      pdfDoc.moveDown(0.5);
      
      // Signature blocks
      pdfDoc.fontSize(9).fillColor('#333');
      const sigY = pdfDoc.y;
      
      // Prepared By
      pdfDoc.text('Prepared By:', 50, sigY);
      pdfDoc.text(preparedBy?.name || 'N/A', 50, sigY + 12);
      pdfDoc.text(doc.preparedBySignedAt ? new Date(doc.preparedBySignedAt).toLocaleDateString() : '-', 50, sigY + 24);
      
      // Reviewed By
      pdfDoc.text('Reviewed By:', 220, sigY);
      pdfDoc.text(reviewedBy?.name || 'N/A', 220, sigY + 12);
      pdfDoc.text(doc.reviewedBySignedAt ? new Date(doc.reviewedBySignedAt).toLocaleDateString() : '-', 220, sigY + 24);
      
      // Approved By
      pdfDoc.text('Approved By:', 390, sigY);
      pdfDoc.text(approvedBy?.name || 'N/A', 390, sigY + 12);
      pdfDoc.text(doc.approvedBySignedAt ? new Date(doc.approvedBySignedAt).toLocaleDateString() : '-', 390, sigY + 24);
      
      // Footer
      pdfDoc.fontSize(8).fillColor('#666');
      pdfDoc.text(`Document: ${doc.documentCode} | Controlled Document - Sahih Certifications | Ed.${doc.editionNumber || 2} Rev.${doc.revisionNumber || 0}`, 50, pageHeight - 50, { align: 'center' });
      
      // Finalize
      pdfDoc.end();
      
      const pdfBuffer = await pdfPromise;
      console.log(`Lightweight PDF generated successfully, size: ${pdfBuffer.length} bytes`);

      const pdfBase64 = pdfBuffer.toString('base64');
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
        newValue: JSON.stringify({ action: 'PDF generated (lightweight)' }),
      });

      res.json({ success: true, pdfUrl: pdfDataUrl });
    } catch (error) {
      console.error('Lightweight PDF generation error:', error);
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

    // Access control for locked/approved documents
    const userId = getCurrentUserId(req);
    const currentUser = await storage.getUser(userId);
    const COO_EMAIL = 'coo@sahihcertify.com';
    
    if ((doc.isLocked || doc.status === DocumentStatus.APPROVED) && currentUser?.email !== COO_EMAIL) {
      const hasAccess = isPublicHubDocument(doc) || await storage.hasDocumentAccess(doc.id, userId);
      const isWorkflowMember = doc.createdById === userId || doc.reviewerId === userId || doc.approverId === userId;
      
      if (isWithdrawnDocument(doc) || (!hasAccess && !isWorkflowMember)) {
        return res.status(403).json({ message: 'Access denied. This document is locked.' });
      }
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
  // TASK REASSIGNMENT
  // ============================================
  
  // Reassign a document task to a different user
  app.post('/api/documents/:id/reassign', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const userId = getCurrentUserId(req);
      const { taskType, newAssigneeId, newApproverId, reason } = req.body;
      
      if (!taskType || !newAssigneeId) {
        return res.status(400).json({ message: 'Task type and new assignee are required' });
      }
      
      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      const currentUser = await storage.getUser(userId);
      const newAssignee = await storage.getUser(newAssigneeId);
      
      if (!newAssignee) {
        return res.status(404).json({ message: 'New assignee not found' });
      }
      
      // Check permission - user must be assigned to this task or be admin/quality_manager
      const isAssigned = 
        (taskType === 'review' && doc.reviewerId === userId) ||
        (taskType === 'approve' && doc.approverId === userId) ||
        (taskType === 'prepare' && doc.preparedById === userId);
      
      const hasPermission = isAssigned ||
        currentUser?.role === 'admin' ||
        currentUser?.role === 'quality_manager' ||
        currentUser?.email === COO_EMAIL ||
        (await taskInitiatorId(`${taskType}:${documentId}`)) === userId;
      
      if (!hasPermission) {
        return res.status(403).json({ message: 'You do not have permission to reassign this task' });
      }
      
      const targetDate = parseTargetDate(req.body.targetDate, taskType);
      const updated = await reassignDocumentTask(doc, taskType, newAssigneeId, userId, reason, newApproverId);
      const existingTarget = await getTaskTarget(`${taskType}:${documentId}`);
      await setTaskTarget(`${taskType}:${documentId}`, {
        assigneeId: newAssigneeId,
        initiatorId: existingTarget?.initiatorId ?? userId,
        targetDate,
        note: reason || null,
      });

      res.json({ 
        success: true, 
        document: updated,
        message: `Task reassigned to ${newAssignee.name}` 
      });
    } catch (err) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message });
      console.error('Error reassigning task:', err);
      res.status(500).json({ message: 'Failed to reassign task' });
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
  // Who may see every access request / access grant (others only see their own)
  const seesAllDocumentAccess = async (req: Request) => {
    const user = await storage.getUser(getCurrentUserId(req));
    return !!user && (user.email === COO_EMAIL || user.role === UserRole.ADMIN || user.role === UserRole.QUALITY_MANAGER);
  };

  app.get(api.documentAccessRequests.list.path, requireAuth, async (req, res) => {
    const documentId = req.query.documentId ? Number(req.query.documentId) : undefined;
    const requesterId = (await seesAllDocumentAccess(req))
      ? (req.query.requesterId ? Number(req.query.requesterId) : undefined)
      : getCurrentUserId(req);
    const status = req.query.status as string | undefined;
    
    const requests = await storage.getDocumentAccessRequests({ documentId, requesterId, status });
    res.json(requests);
  });

  app.get(api.documentAccessRequests.get.path, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await storage.getDocumentAccessRequest(id);
    if (!request || (request.requesterId !== getCurrentUserId(req) && !(await seesAllDocumentAccess(req)))) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    res.json(request);
  });

  app.post(api.documentAccessRequests.create.path, requireAuth, async (req, res) => {
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

  app.post(api.documentAccessRequests.approve.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }
      
      const input = api.documentAccessRequests.approve.input.parse(req.body);
      const userId = getCurrentUserId(req);
      const currentUser = await storage.getUser(userId);
      
      // Only COO (coo@sahihcertify.com) can approve access requests
      const COO_EMAIL = 'coo@sahihcertify.com';
      if (currentUser?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can approve document access requests' });
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

  app.post(api.documentAccessRequests.reject.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }
      
      const input = api.documentAccessRequests.reject.input.parse(req.body);
      const userId = getCurrentUserId(req);
      const currentUser = await storage.getUser(userId);
      
      // Only COO (coo@sahihcertify.com) can reject access requests
      const COO_EMAIL = 'coo@sahihcertify.com';
      if (currentUser?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can reject document access requests' });
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
  app.get(api.documentAccess.list.path, requireAuth, async (req, res) => {
    const documentId = req.query.documentId ? Number(req.query.documentId) : undefined;
    const userId = (await seesAllDocumentAccess(req))
      ? (req.query.userId ? Number(req.query.userId) : undefined)
      : getCurrentUserId(req);
    
    const accessList = await storage.getDocumentAccess({ documentId, userId });
    res.json(accessList);
  });

  app.get(api.documentAccess.check.path, requireAuth, async (req, res) => {
    const documentId = Number(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }
    
    const userId = getCurrentUserId(req);
    const currentUser = await storage.getUser(userId);
    
    const COO_EMAIL = 'coo@sahihcertify.com';
    
    // COO always has access to all approved documents
    if (currentUser?.email === COO_EMAIL) {
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
    
    // For approved (locked) documents, check explicit access grant from COO
    const hasAccess = !isWithdrawnDocument(document) && (isPublicHubDocument(document) || await storage.hasDocumentAccess(documentId, userId));
    res.json({ hasAccess });
  });

  app.post(api.documentAccess.grant.path, requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }
      
      const input = api.documentAccess.grant.input.parse(req.body);
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Only COO (coo@sahihcertify.com) can grant access
      const COO_EMAIL = 'coo@sahihcertify.com';
      if (currentUser?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can grant document access' });
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

  // Grant access to multiple users at once
  app.post(api.documentAccess.grantMultiple.path, requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }
      
      const input = api.documentAccess.grantMultiple.input.parse(req.body);
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Only COO (coo@sahihcertify.com) can grant access
      const COO_EMAIL = 'coo@sahihcertify.com';
      if (currentUser?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can grant document access' });
      }
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      const results = [];
      for (const userId of input.userIds) {
        try {
          // Check if user already has access
          const hasAccess = await storage.hasDocumentAccess(documentId, userId);
          if (hasAccess) {
            continue; // Skip users who already have access
          }
          
          const access = await storage.grantDocumentAccess({
            documentId,
            userId,
            grantedById: currentUserId,
          });
          
          results.push(access);
          
          // Notify the user
          await storage.createNotification({
            userId,
            title: 'Document Access Granted',
            message: `You have been granted access to document "${document.documentCode} - ${document.title}"`,
            urgencyLevel: UrgencyLevel.LOW,
            relatedDocumentId: documentId,
          });
          
          // Audit log
          await storage.createAuditLog({
            userId: currentUserId,
            action: AuditAction.CREATE,
            entityType: 'document_access',
            entityId: access.id,
            newValue: JSON.stringify({ documentId, userId }),
          });
        } catch (err) {
          console.error(`Failed to grant access to user ${userId}:`, err);
        }
      }
      
      res.status(201).json({ granted: results.length, results });
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

  app.post(api.documentAccess.revoke.path, requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }
      
      const input = api.documentAccess.revoke.input.parse(req.body);
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Only COO (coo@sahihcertify.com) can revoke access
      const COO_EMAIL = 'coo@sahihcertify.com';
      if (currentUser?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can revoke document access' });
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

  // ============================================
  // DOCUMENT COMMENTS (inline, with @mentioned assignees)
  // ============================================
  app.get('/api/documents/:id/comments', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const user = (req as any).user;
      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (!user || !(await canViewDocument(doc, user))) {
        return res.status(403).json({ message: 'You do not have access to this document' });
      }
      const isCoo = user.email === COO_EMAIL;
      const inWorkflow = [doc.createdById, doc.preparedById, doc.reviewerId, doc.approverId].includes(user.id);
      const visible = (await storage.getDocumentComments(documentId)).filter(c => {
        const involved = c.authorId === user.id || c.mentionedIds.includes(user.id) || c.assigneeIds.includes(user.id);
        // Change-request points: the initiator and the COO; the people revising see the accepted request's points
        if (c.kind === 'change_request') return involved || isCoo || (inWorkflow && c.changeRequestId === doc.activeChangeRequestId);
        // Comments on a locked document are private to the author and the people tagged
        if (c.isPrivate) return involved;
        return true;
      });
      res.json(visible);
    } catch (err) {
      console.error('Error fetching document comments:', err);
      res.status(500).json({ message: 'Failed to fetch comments' });
    }
  });

  app.post('/api/documents/:id/comments', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const user = (req as any).user;
      const parseResult = z.object({
        content: z.string().trim().min(1, 'Comment cannot be empty'),
        quotedText: z.string().min(1, 'Select the text you are commenting on'),
        anchorFrom: z.number().int().nonnegative(),
        anchorTo: z.number().int().positive(),
        mentionedIds: z.array(z.number().int().positive()).optional().default([]), // tagged: notified only
        assigneeIds: z.array(z.number().int().positive()).optional().default([]), // assigned: becomes a task
        targetDate: z.string().optional(),
      }).safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0].message });
      }
      const input = parseResult.data;

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (!user || !(await canViewDocument(doc, user))) {
        return res.status(403).json({ message: 'You do not have access to this document' });
      }
      // A locked document is a permanent record: comments on it are for reference and discussion only,
      // visible to the author and the people tagged, and never create tasks
      if (doc.isLocked && input.assigneeIds.length > 0) {
        return res.status(400).json({ message: 'Comments on an approved document cannot assign tasks. Tag people to notify them, or raise a change request.' });
      }

      const validUsers = async (ids: number[]) => {
        const out: number[] = [];
        for (const id of Array.from(new Set(ids))) if (await storage.getUser(id)) out.push(id);
        return out;
      };
      const assigneeIds = await validUsers(input.assigneeIds);
      const mentionedIds = (await validUsers([...input.mentionedIds, ...assigneeIds]));

      const commentTarget = assigneeIds.length > 0 ? parseTargetDate(input.targetDate, 'comment') : null;
      const comment = await storage.createDocumentComment({
        documentId,
        authorId: user.id,
        content: input.content,
        quotedText: input.quotedText,
        anchorFrom: input.anchorFrom,
        anchorTo: input.anchorTo,
        assigneeIds,
        mentionedIds,
        isPrivate: !!doc.isLocked,
        documentStatus: doc.status,
      });

      if (commentTarget) {
        await setTaskTarget(`comment:${comment.id}`, { initiatorId: user.id, targetDate: commentTarget });
      }
      for (const taggedId of mentionedIds) {
        if (taggedId === user.id) continue;
        const assigned = assigneeIds.includes(taggedId);
        await storage.createNotification({
          userId: taggedId,
          title: assigned ? 'A comment was assigned to you' : 'You were tagged in a document comment',
          message: `${user.name} ${assigned ? 'assigned you a comment' : 'tagged you'} on "${doc.documentCode} - ${doc.title}": ${input.content.slice(0, 200)}`,
          urgencyLevel: assigned ? UrgencyLevel.MEDIUM : UrgencyLevel.LOW,
          relatedDocumentId: documentId,
        });
      }

      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'document_comment',
        entityId: comment.id,
        newValue: JSON.stringify({ documentId, quotedText: input.quotedText, content: input.content, mentionedIds, assigneeIds, private: !!doc.isLocked }),
      });

      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'targetDate' });
      console.error('Error creating document comment:', err);
      res.status(500).json({ message: 'Failed to add comment' });
    }
  });

  // Opening a document marks the reader's notifications about it (tags, assignments) as read
  app.post('/api/documents/:id/seen', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const count = await storage.markDocumentNotificationsRead(user.id, Number(req.params.id));
    res.json({ cleared: count });
  });

  app.post('/api/document-comments/:id/resolve', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const comment = await storage.getDocumentComment(id);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      const canResolve = comment.authorId === user?.id ||
        comment.assigneeIds.includes(user?.id) ||
        comment.mentionedIds.includes(user?.id) ||
        user?.email === COO_EMAIL ||
        user?.role === UserRole.ADMIN ||
        user?.role === UserRole.QUALITY_MANAGER;
      if (!canResolve) {
        return res.status(403).json({ message: 'Only the author, a mentioned user, an admin or the Quality Manager can resolve this comment' });
      }
      if (comment.status === DocumentCommentStatus.RESOLVED) {
        return res.json(comment);
      }

      const updated = await storage.updateDocumentComment(id, {
        status: DocumentCommentStatus.RESOLVED,
        resolvedById: user.id,
        resolvedAt: new Date(),
      });

      if (comment.authorId !== user.id) {
        const doc = await storage.getDocument(comment.documentId);
        await storage.createNotification({
          userId: comment.authorId,
          title: 'Your comment was resolved',
          message: `${user.name} resolved your comment on "${doc?.documentCode} - ${doc?.title}": "${comment.quotedText.slice(0, 80)}"`,
          urgencyLevel: UrgencyLevel.LOW,
          relatedDocumentId: comment.documentId,
        });
      }

      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'document_comment',
        entityId: id,
        previousValue: JSON.stringify({ status: comment.status }),
        newValue: JSON.stringify({ status: DocumentCommentStatus.RESOLVED }),
      });

      res.json(updated);
    } catch (err) {
      console.error('Error resolving document comment:', err);
      res.status(500).json({ message: 'Failed to resolve comment' });
    }
  });

  app.delete('/api/document-comments/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const comment = await storage.getDocumentComment(id);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      if (comment.authorId !== user?.id) {
        return res.status(403).json({ message: 'Only the author can delete a comment' });
      }
      if (comment.status !== DocumentCommentStatus.OPEN) {
        return res.status(400).json({ message: 'Resolved comments are kept for the audit trail' });
      }
      await storage.deleteDocumentComment(id);
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.DELETE,
        entityType: 'document_comment',
        entityId: id,
        previousValue: JSON.stringify(comment),
      });
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting document comment:', err);
      res.status(500).json({ message: 'Failed to delete comment' });
    }
  });

  // ============================================
  // RETURN FOR REVISION (one step back in the workflow)
  // reviewer -> preparer (draft), approver -> reviewer, COO -> approver
  // ============================================
  app.post('/api/documents/:id/return', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const user = (req as any).user;
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      let toStatus: string;
      let returnToId: number | null;
      let returnToRole: string;
      const updateData: any = {};

      if (doc.status === DocumentStatus.IN_REVIEW && doc.reviewerId === user?.id) {
        toStatus = DocumentStatus.DRAFT;
        returnToId = doc.preparedById ?? doc.createdById;
        returnToRole = 'preparer';
        updateData.preparerConfirmedAt = null;
        updateData.preparedBySignedAt = null;
      } else if (doc.status === DocumentStatus.PENDING_APPROVAL && doc.approverId === user?.id) {
        toStatus = DocumentStatus.IN_REVIEW;
        returnToId = doc.reviewerId;
        returnToRole = 'reviewer';
        updateData.reviewedBySignedAt = null;
      } else if (doc.status === DocumentStatus.APPROVED && doc.hubStatus === DocumentHubStatus.PENDING_COO_APPROVAL && user?.email === COO_EMAIL) {
        toStatus = DocumentStatus.PENDING_APPROVAL;
        returnToId = doc.approverId;
        returnToRole = 'approver';
        updateData.approvedAt = null;
        updateData.approvedBySignedAt = null;
        updateData.hubStatus = null;
        updateData.transferredToHubAt = null;
      } else {
        return res.status(403).json({ message: 'Only the person currently responsible for this document (reviewer, approver, or the COO in the Document Hub) can return it' });
      }

      const returnedTaskType = toStatus === DocumentStatus.DRAFT ? 'revise' : toStatus === DocumentStatus.IN_REVIEW ? 'review' : 'approve';
      const returnTarget = parseTargetDate(req.body?.targetDate, returnedTaskType);

      // The reason must be written in the document itself, as comments
      const comments = await storage.getDocumentComments(documentId);
      const myOpenComments = comments.filter(c => c.authorId === user.id && c.status === DocumentCommentStatus.OPEN);
      if (myOpenComments.length === 0) {
        return res.status(400).json({ message: 'Add at least one comment in the document explaining what needs to change before returning it (select text, right-click, Comment)' });
      }

      const updated = await storage.updateDocument(documentId, {
        ...updateData,
        status: toStatus,
        returnedAt: new Date(),
        returnedById: user.id,
        returnNote: note || null,
      });

      await setTaskTarget(`${returnedTaskType}:${documentId}`, { assigneeId: returnToId, initiatorId: user.id, targetDate: returnTarget, note: note || null });

      await storage.createWorkflowLog({
        documentId,
        fromStatus: doc.status,
        toStatus,
        assignedToId: returnToId,
        actionById: user.id,
        comments: `Returned for revision to ${returnToRole}${note ? `: ${note}` : ''}`,
      });

      if (returnToId) {
        await storage.createNotification({
          userId: returnToId,
          title: 'Document Returned for Revision',
          message: `${user.name} returned "${doc.documentCode} - ${doc.title}" to you with ${myOpenComments.length} comment${myOpenComments.length > 1 ? 's' : ''}.${note ? ` Note: ${note}` : ''}`,
          urgencyLevel: UrgencyLevel.HIGH,
          relatedDocumentId: documentId,
        });
      }

      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.RETURN_FOR_REVISION,
        entityType: 'document',
        entityId: documentId,
        previousValue: JSON.stringify({ status: doc.status, hubStatus: doc.hubStatus }),
        newValue: JSON.stringify({ status: toStatus, returnedTo: returnToId, returnToRole, note, commentIds: myOpenComments.map(c => c.id) }),
      });

      res.json({ document: updated, returnedToId: returnToId, returnToRole });
    } catch (err) {
      if (err instanceof TargetDateError) return res.status(400).json({ message: err.message, field: 'targetDate' });
      console.error('Error returning document:', err);
      res.status(500).json({ message: 'Failed to return document' });
    }
  });

  // COO final approval: classify an approved document, lock it and store it in the Sahih Hub
  const classificationSchema = z.enum([
    DocumentClassification.CONFIDENTIAL,
    DocumentClassification.CONTROLLED_COPY,
    DocumentClassification.PUBLIC_INFORMATION,
    DocumentClassification.LEGAL,
  ]);

  app.post('/api/documents/:id/hub-approve', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }

      const parseResult = z.object({
        classification: classificationSchema,
        userIds: z.array(z.number().int().positive()).optional().default([]),
        comments: z.string().optional(),
        // for a revised document: new revision (Rev+1) or new edition (Ed+1, Rev.0)
        versionChange: z.enum(['revision', 'edition']).optional(),
      }).safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: 'Please choose a classification for the document', errors: parseResult.error.errors });
      }
      const { classification, userIds, comments, versionChange } = parseResult.data;

      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      if (currentUser?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can give final approval in the Document Hub' });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (document.status !== DocumentStatus.APPROVED || document.hubStatus !== DocumentHubStatus.PENDING_COO_APPROVAL) {
        return res.status(400).json({ message: 'Only approved documents awaiting final approval can be stored in the Document Hub' });
      }

      // Record this as the current approved version; a previous version becomes obsolete (and is kept)
      const version = await recordApprovedVersion(document, currentUserId, versionChange, classification);
      const updated = await storage.updateDocument(documentId, {
        isLocked: true,
        hubStatus: DocumentHubStatus.STORED,
        lifecycleStatus: DocumentLifecycleStatus.CURRENT,
        classification,
        hubApprovedById: currentUserId,
        hubApprovedAt: new Date(),
        // Issue date: the date entered for a registered Google file, otherwise the date of this approval
        issueDate: (document as any).issueDate && !version.previousVersion ? (document as any).issueDate : new Date(),
        editionNumber: version.editionNumber,
        revisionNumber: version.revisionNumber,
        versionNumber: version.versionNumber,
        activeChangeRequestId: null,
      } as any);

      const accessGrantedTo: number[] = [];
      for (const userId of userIds) {
        if (userId === currentUserId) continue;
        const user = await storage.getUser(userId);
        if (!user || await storage.hasDocumentAccess(documentId, userId)) continue;
        await storage.grantDocumentAccess({ documentId, userId, grantedById: currentUserId });
        accessGrantedTo.push(userId);
        await storage.createNotification({
          userId,
          title: 'Document Hub Access Granted',
          message: `You have been granted access to document "${document.documentCode} - ${document.title}" in the Document Hub`,
          urgencyLevel: UrgencyLevel.LOW,
          relatedDocumentId: documentId,
        });
      }

      // Let the document's creator and approver know it is now stored
      const classificationLabel = classification.replace(/_/g, ' ');
      for (const userId of Array.from(new Set([document.createdById, document.approverId]))) {
        if (!userId || userId === currentUserId) continue;
        await storage.createNotification({
          userId,
          title: 'Document Stored in Sahih Hub',
          message: `Document "${document.documentCode} - ${document.title}" received the COO's final approval and is stored as ${classificationLabel}.`,
          urgencyLevel: UrgencyLevel.LOW,
          relatedDocumentId: documentId,
        });
      }

      await storage.createAuditLog({
        userId: currentUserId,
        action: AuditAction.APPROVE,
        entityType: 'document',
        entityId: documentId,
        previousValue: JSON.stringify({ hubStatus: document.hubStatus, isLocked: document.isLocked }),
        newValue: JSON.stringify({ hubStatus: DocumentHubStatus.STORED, isLocked: true, classification, grantedAccessTo: accessGrantedTo, comments, version: version.versionNumber, supersedes: version.previousVersion }),
      });

      res.json({ document: updated, accessGrantedTo: accessGrantedTo.length });
    } catch (err) {
      console.error('Error giving final approval in Document Hub:', err);
      res.status(500).json({ message: 'Failed to store document in the Document Hub' });
    }
  });

  // COO changes the classification of a document already stored in the Hub
  app.post('/api/documents/:id/classification', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }
      const parseResult = z.object({ classification: classificationSchema }).safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: 'Invalid classification' });
      }

      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      if (currentUser?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can change a document classification' });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (!document.isLocked) {
        return res.status(400).json({ message: 'Only documents stored in the Document Hub can be classified' });
      }

      const updated = await storage.updateDocument(documentId, {
        classification: parseResult.data.classification,
        hubStatus: DocumentHubStatus.STORED,
      });

      await storage.createAuditLog({
        userId: currentUserId,
        action: AuditAction.UPDATE,
        entityType: 'document',
        entityId: documentId,
        previousValue: JSON.stringify({ classification: document.classification }),
        newValue: JSON.stringify({ classification: parseResult.data.classification }),
      });

      res.json(updated);
    } catch (err) {
      console.error('Error changing document classification:', err);
      res.status(500).json({ message: 'Failed to change classification' });
    }
  });

  // COO sets the lifecycle status of a stored document: current, under revision, obsolete or quarantine
  app.post('/api/documents/:id/lifecycle-status', requireAuth, async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const parseResult = z.object({
        lifecycleStatus: z.enum([
          DocumentLifecycleStatus.CURRENT,
          DocumentLifecycleStatus.UNDER_REVISION,
          DocumentLifecycleStatus.OBSOLETE,
          DocumentLifecycleStatus.QUARANTINE,
        ]),
        reason: z.string().optional(),
      }).safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const { lifecycleStatus, reason } = parseResult.data;

      const user = (req as any).user;
      if (user?.email !== COO_EMAIL) {
        return res.status(403).json({ message: 'Only the COO can change the status of a stored document' });
      }
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (!document.isLocked) {
        return res.status(400).json({ message: 'Only documents stored in the Document Hub have a status' });
      }

      const updated = await storage.updateDocument(documentId, { lifecycleStatus });

      // Tell everyone who can open it, so nobody keeps using an obsolete or quarantined copy
      const accessList = (await storage.getDocumentAccess({ documentId })).filter(a => !a.isRevoked);
      const label = lifecycleStatus.replace(/_/g, ' ');
      for (const userId of Array.from(new Set([...accessList.map(a => a.userId), document.createdById]))) {
        if (userId === user.id) continue;
        await storage.createNotification({
          userId,
          title: 'Document Status Changed',
          message: `"${document.documentCode} - ${document.title}" is now ${label}.${reason ? ` Reason: ${reason}` : ''}`,
          urgencyLevel: lifecycleStatus === DocumentLifecycleStatus.QUARANTINE ? UrgencyLevel.HIGH : UrgencyLevel.MEDIUM,
          relatedDocumentId: documentId,
        });
      }

      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'document',
        entityId: documentId,
        previousValue: JSON.stringify({ lifecycleStatus: document.lifecycleStatus }),
        newValue: JSON.stringify({ lifecycleStatus, reason }),
      });

      res.json(updated);
    } catch (err) {
      console.error('Error changing document status:', err);
      res.status(500).json({ message: 'Failed to change document status' });
    }
  });

  // ============================================
  // USER RECORDS (Completion Reports)
  // ============================================
  app.get('/api/user-records', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const records = await storage.getUserRecords(userId);
      res.json(records);
    } catch (err) {
      console.error('Error fetching user records:', err);
      res.status(500).json({ message: 'Failed to fetch user records' });
    }
  });

  app.get('/api/user-records/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = getCurrentUserId(req);
      
      const record = await storage.getUserRecord(id);
      if (!record) {
        return res.status(404).json({ message: 'Record not found' });
      }
      
      // Only allow users to access their own records
      if (record.userId !== userId) {
        const user = await storage.getUser(userId);
        if (user?.role !== UserRole.ADMIN) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }
      
      res.json(record);
    } catch (err) {
      console.error('Error fetching user record:', err);
      res.status(500).json({ message: 'Failed to fetch user record' });
    }
  });

  app.get('/api/user-records/:id/pdf', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = getCurrentUserId(req);
      
      const record = await storage.getUserRecord(id);
      if (!record) {
        return res.status(404).json({ message: 'Record not found' });
      }
      
      // Only allow users to access their own records
      if (record.userId !== userId) {
        const user = await storage.getUser(userId);
        if (user?.role !== UserRole.ADMIN) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }
      
      if (!record.pdfDataUrl) {
        return res.status(404).json({ message: 'PDF not available' });
      }
      
      res.json({ pdfUrl: record.pdfDataUrl });
    } catch (err) {
      console.error('Error fetching user record PDF:', err);
      res.status(500).json({ message: 'Failed to fetch PDF' });
    }
  });

  // ============================================
  // BUDDY STATUS ENDPOINTS
  // ============================================
  
  app.get('/api/buddy/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get fresh task counts directly from database
      const taskStats = await storage.getUserTaskStats(userId);
      const compliance = await storage.calculateUserCompliance(userId);
      const buddyStatus = await storage.getOrCreateBuddyStatus(userId);
      const pendingDialogues = await storage.getBuddyDialogues(userId, true);
      
      const buddyName = `Buddy ${user.name.split(' ')[0]}`;
      
      let colorClass = 'text-green-500';
      let bgColorClass = 'bg-green-50 dark:bg-green-900/20';
      let animationClass = '';
      
      if (compliance.score < 60) {
        colorClass = 'text-red-500';
        bgColorClass = 'bg-red-50 dark:bg-red-900/20';
        animationClass = 'animate-pulse';
      } else if (compliance.score < 70) {
        colorClass = 'text-orange-500';
        bgColorClass = 'bg-orange-50 dark:bg-orange-900/20';
        animationClass = 'animate-slow-blink';
      } else if (compliance.score < 90) {
        colorClass = 'text-yellow-500';
        bgColorClass = 'bg-yellow-50 dark:bg-yellow-900/20';
      }
      
      res.json({
        buddyName,
        compliance: {
          score: compliance.score,
          state: compliance.state,
        },
        stats: {
          totalTasks: taskStats.totalTasks,
          completedTasks: taskStats.completedTasks,
          overdueTasks: taskStats.overdueTasks,
        },
        style: {
          colorClass,
          bgColorClass,
          animationClass,
        },
        pendingDialogues,
        lastUpdated: buddyStatus.updatedAt,
      });
    } catch (err) {
      console.error('Error fetching buddy status:', err);
      res.status(500).json({ message: 'Failed to fetch buddy status' });
    }
  });

  // System-wide compliance status for Buddy Avatar (shows overall system compliance)
  app.get('/api/buddy/system-status', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get SYSTEM-WIDE task stats (all users combined)
      const taskStats = await storage.getSystemTaskStats();
      const compliance = await storage.calculateSystemCompliance();
      const pendingDialogues = await storage.getBuddyDialogues(userId, true);
      
      const buddyName = 'Hub-eeeebi';
      
      let colorClass = 'text-green-500';
      let bgColorClass = 'bg-green-50 dark:bg-green-900/20';
      let animationClass = '';
      
      if (compliance.score < 60) {
        colorClass = 'text-red-500';
        bgColorClass = 'bg-red-50 dark:bg-red-900/20';
        animationClass = 'animate-pulse';
      } else if (compliance.score < 70) {
        colorClass = 'text-orange-500';
        bgColorClass = 'bg-orange-50 dark:bg-orange-900/20';
        animationClass = 'animate-slow-blink';
      } else if (compliance.score < 90) {
        colorClass = 'text-yellow-500';
        bgColorClass = 'bg-yellow-50 dark:bg-yellow-900/20';
      }
      
      res.json({
        buddyName,
        compliance: {
          score: compliance.score,
          state: compliance.state,
        },
        stats: {
          totalTasks: taskStats.totalTasks,
          completedTasks: taskStats.completedTasks,
          overdueTasks: taskStats.overdueTasks,
        },
        style: {
          colorClass,
          bgColorClass,
          animationClass,
        },
        pendingDialogues,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error fetching system buddy status:', err);
      res.status(500).json({ message: 'Failed to fetch system buddy status' });
    }
  });

  app.get('/api/buddy/dialogues', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const unacknowledgedOnly = req.query.unacknowledged === 'true';
      const dialogues = await storage.getBuddyDialogues(userId, unacknowledgedOnly);
      res.json(dialogues);
    } catch (err) {
      console.error('Error fetching buddy dialogues:', err);
      res.status(500).json({ message: 'Failed to fetch dialogues' });
    }
  });

  app.post('/api/buddy/dialogues/:id/acknowledge', requireAuth, async (req: Request, res: Response) => {
    try {
      const dialogueId = parseInt(req.params.id);
      const dialogue = await storage.acknowledgeBuddyDialogue(dialogueId);
      res.json(dialogue);
    } catch (err) {
      console.error('Error acknowledging dialogue:', err);
      res.status(500).json({ message: 'Failed to acknowledge dialogue' });
    }
  });

  app.post('/api/buddy/subscribe', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const { endpoint, keys } = req.body;
      
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: 'Invalid subscription data' });
      }
      
      const subscription = await storage.savePushSubscription({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      
      res.json({ success: true, subscriptionId: subscription.id });
    } catch (err) {
      console.error('Error saving push subscription:', err);
      res.status(500).json({ message: 'Failed to save subscription' });
    }
  });

  app.delete('/api/buddy/subscribe', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const { endpoint } = req.body;
      
      await storage.removePushSubscription(userId, endpoint);
      res.json({ success: true });
    } catch (err) {
      console.error('Error removing push subscription:', err);
      res.status(500).json({ message: 'Failed to remove subscription' });
    }
  });

  app.post('/api/buddy/refresh', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const compliance = await storage.calculateUserCompliance(userId);
      res.json(compliance);
    } catch (err) {
      console.error('Error refreshing compliance:', err);
      res.status(500).json({ message: 'Failed to refresh compliance' });
    }
  });

  // ============================================
  // MONTHLY PERFORMANCE REPORTS (ADMIN ONLY)
  // ============================================
  
  // Get all monthly reports (Admin only)
  app.get('/api/performance-reports', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const filters = {
        userId: req.query.userId ? Number(req.query.userId) : undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        status: req.query.status as string | undefined,
      };
      
      // Bring the task ledger and draft reports up to date before showing them
      await reconcileTasks();
      await refreshPerformanceReports();
      const reports = await storage.getMonthlyPerformanceReports(filters);
      
      // Enrich with user names
      const enrichedReports = await Promise.all(reports.map(async (report) => {
        const user = await storage.getUser(report.userId);
        const reviewer = report.reviewerId ? await storage.getUser(report.reviewerId) : null;
        const approver = report.approverId ? await storage.getUser(report.approverId) : null;
        return {
          ...report,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          reviewerName: reviewer?.name || null,
          approverName: approver?.name || null,
        };
      }));
      
      res.json(enrichedReports);
    } catch (err) {
      console.error('Error fetching performance reports:', err);
      res.status(500).json({ message: 'Failed to fetch reports' });
    }
  });

  // Get single report
  app.get('/api/performance-reports/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const id = Number(req.params.id);
      const report = await storage.getMonthlyPerformanceReport(id);
      
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      
      const user = await storage.getUser(report.userId);
      const reviewer = report.reviewerId ? await storage.getUser(report.reviewerId) : null;
      const approver = report.approverId ? await storage.getUser(report.approverId) : null;
      
      res.json({
        ...report,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || '',
        reviewerName: reviewer?.name || null,
        approverName: approver?.name || null,
      });
    } catch (err) {
      console.error('Error fetching performance report:', err);
      res.status(500).json({ message: 'Failed to fetch report' });
    }
  });

  // Generate reports for all users for a specific month (Admin only)
  app.post('/api/performance-reports/generate', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { month, year } = req.body;
      if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required' });
      }

      const allUsers = await storage.getUsers();
      const reports = [];

      for (const user of allUsers) {
        const report = await storage.generateMonthlyReport(user.id, month, year);
        reports.push(report);
      }

      res.json({ message: `Generated ${reports.length} reports`, reports });
    } catch (err) {
      console.error('Error generating reports:', err);
      res.status(500).json({ message: 'Failed to generate reports' });
    }
  });

  // Submit report for review (sends to COO)
  app.post('/api/performance-reports/:id/submit', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const id = Number(req.params.id);
      const report = await storage.submitReportForReview(id);
      
      // Notify COO
      const coo = await storage.getUserByEmail('coo@sahihcertify.com');
      if (coo) {
        const user = await storage.getUser(report.userId);
        await storage.createNotification({
          userId: coo.id,
          title: 'Performance Report Requires Review',
          message: `Monthly performance report for ${user?.name || 'Unknown'} (${report.reportMonth}/${report.reportYear}) is ready for your review.`,
          urgencyLevel: 'medium',
        });
      }

      res.json(report);
    } catch (err) {
      console.error('Error submitting report:', err);
      res.status(500).json({ message: 'Failed to submit report' });
    }
  });

  // Review report (COO reviews, sends to CEO for approval)
  app.post('/api/performance-reports/:id/review', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Check if user is COO
      if (!currentUser || currentUser.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: 'Only COO can review performance reports' });
      }

      const id = Number(req.params.id);
      const { comments } = req.body;
      
      const report = await storage.reviewReport(id, currentUserId, comments);
      
      // Notify CEO
      const ceo = await storage.getUserByEmail('ceo@sahihcertify.com');
      if (ceo) {
        const user = await storage.getUser(report.userId);
        await storage.createNotification({
          userId: ceo.id,
          title: 'Performance Report Requires Approval',
          message: `Monthly performance report for ${user?.name || 'Unknown'} (${report.reportMonth}/${report.reportYear}) has been reviewed and requires your approval.`,
          urgencyLevel: 'medium',
        });
      }

      res.json(report);
    } catch (err) {
      console.error('Error reviewing report:', err);
      res.status(500).json({ message: 'Failed to review report' });
    }
  });

  // Approve report (CEO approves and attaches to user records)
  app.post('/api/performance-reports/:id/approve', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Check if user is CEO
      if (!currentUser || currentUser.email !== 'ceo@sahihcertify.com') {
        return res.status(403).json({ message: 'Only CEO can approve performance reports' });
      }

      const id = Number(req.params.id);
      const { comments } = req.body;
      
      const report = await storage.approveReport(id, currentUserId, comments);
      
      // Create user record for the approved report
      const user = await storage.getUser(report.userId);
      if (user) {
        await storage.createUserRecord({
          userId: report.userId,
          recordType: 'monthly_performance',
          recordTitle: `Monthly Performance Report - ${report.reportMonth}/${report.reportYear}`,
          documentId: null,
          employeeId: null,
          recordData: JSON.stringify({
            totalActiveHours: report.totalActiveHours,
            totalOnlineHours: report.totalOnlineHours,
            totalDaysActive: report.totalDaysActive,
            documentsCreated: report.documentsCreated,
            documentsReviewed: report.documentsReviewed,
            documentsApproved: report.documentsApproved,
            tasksCompleted: report.tasksCompleted,
            tasksOverdue: report.tasksOverdue,
            tasksPending: report.tasksPending,
            reviewedBy: report.reviewerId,
            approvedBy: report.approverId,
          }),
        });

        // Notify the user
        await storage.createNotification({
          userId: report.userId,
          title: 'Performance Report Approved',
          message: `Your monthly performance report for ${report.reportMonth}/${report.reportYear} has been approved and added to your records.`,
          urgencyLevel: 'low',
        });
      }

      res.json(report);
    } catch (err) {
      console.error('Error approving report:', err);
      res.status(500).json({ message: 'Failed to approve report' });
    }
  });

  // Reject report
  app.post('/api/performance-reports/:id/reject', requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUserId = getCurrentUserId(req);
      const currentUser = await storage.getUser(currentUserId);
      
      // Check if user is COO or CEO
      if (!currentUser || (currentUser.email !== 'coo@sahihcertify.com' && currentUser.email !== 'ceo@sahihcertify.com')) {
        return res.status(403).json({ message: 'Only COO or CEO can reject performance reports' });
      }

      const id = Number(req.params.id);
      const { comments } = req.body;
      
      if (!comments) {
        return res.status(400).json({ message: 'Rejection comments are required' });
      }
      
      const report = await storage.rejectReport(id, comments);

      res.json(report);
    } catch (err) {
      console.error('Error rejecting report:', err);
      res.status(500).json({ message: 'Failed to reject report' });
    }
  });

  // Update activity heartbeat to also track session (enhanced version)
  app.post('/api/activity/session-heartbeat', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      await storage.updateUserHeartbeat(userId);
      await storage.updateUserActivity(userId);
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating session heartbeat:', err);
      res.status(500).json({ message: 'Failed to update heartbeat' });
    }
  });

  // Start user session on login
  app.post('/api/activity/start-session', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const session = await storage.startUserSession(userId);
      res.json(session);
    } catch (err) {
      console.error('Error starting session:', err);
      res.status(500).json({ message: 'Failed to start session' });
    }
  });

  // End user session on logout
  app.post('/api/activity/end-session', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      await storage.endUserSession(userId);
      res.json({ success: true });
    } catch (err) {
      console.error('Error ending session:', err);
      res.status(500).json({ message: 'Failed to end session' });
    }
  });

  // ============================================
  // BUG REPORTS / FEEDBACK SYSTEM
  // ============================================

  // Get all bug reports (COO/Admin only for all, users see their own)
  app.get('/api/bug-reports', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      const status = req.query.status as string | undefined;
      
      // COO or Admin can see all bug reports
      if (user?.email === 'coo@sahihcertify.com' || user?.role === 'admin') {
        const reports = await storage.getBugReports(status ? { status } : undefined);
        res.json(reports);
      } else {
        // Regular users only see their own reports
        const reports = await storage.getBugReports({ reportedById: userId, ...(status ? { status } : {}) });
        res.json(reports);
      }
    } catch (err) {
      console.error('Error fetching bug reports:', err);
      res.status(500).json({ message: 'Failed to fetch bug reports' });
    }
  });

  // Get single bug report
  app.get('/api/bug-reports/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const report = await storage.getBugReport(id);
      if (!report) {
        return res.status(404).json({ message: 'Bug report not found' });
      }
      res.json(report);
    } catch (err) {
      console.error('Error fetching bug report:', err);
      res.status(500).json({ message: 'Failed to fetch bug report' });
    }
  });

  // Create bug report
  app.post('/api/bug-reports', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const { title, description, screenshotUrl, priority } = req.body;
      
      // Find COO user to auto-assign bug reports
      const allUsers = await storage.getUsers();
      const coo = allUsers.find(u => u.email === 'coo@sahihcertify.com');
      
      const report = await storage.createBugReport({
        title,
        description,
        screenshotUrl,
        priority: priority || 'medium',
        reportedById: userId,
        assignedToId: coo?.id || null,
        status: 'open',
      });

      // Notify COO about new bug report assigned to them
      if (coo) {
        await storage.createNotification({
          userId: coo.id,
          title: 'New Bug Report Assigned',
          message: `A new bug report has been assigned to you: ${report.ticketNumber} - ${title}`,
          urgencyLevel: priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'medium',
          isRead: false,
        });
      }

      res.status(201).json(report);
    } catch (err) {
      console.error('Error creating bug report:', err);
      res.status(500).json({ message: 'Failed to create bug report' });
    }
  });

  // Update bug report status (COO or Admin)
  app.patch('/api/bug-reports/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      const id = parseInt(req.params.id);
      
      if (user?.email !== 'coo@sahihcertify.com' && user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only COO or Admin can update bug reports' });
      }

      const updated = await storage.updateBugReport(id, req.body);
      res.json(updated);
    } catch (err) {
      console.error('Error updating bug report:', err);
      res.status(500).json({ message: 'Failed to update bug report' });
    }
  });

  // Resolve bug report (COO or Admin)
  app.post('/api/bug-reports/:id/resolve', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      const id = parseInt(req.params.id);
      
      if (user?.email !== 'coo@sahihcertify.com' && user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only COO or Admin can resolve bug reports' });
      }

      const { resolutionNotes, resolutionEvidenceUrl } = req.body;
      const updated = await storage.resolveBugReport(id, userId, resolutionNotes || 'Issue resolved', resolutionEvidenceUrl);
      res.json(updated);
    } catch (err) {
      console.error('Error resolving bug report:', err);
      res.status(500).json({ message: 'Failed to resolve bug report' });
    }
  });

  // Close bug report (COO or Admin - triggers congratulation message)
  app.post('/api/bug-reports/:id/close', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      const id = parseInt(req.params.id);
      
      if (user?.email !== 'coo@sahihcertify.com' && user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only COO or Admin can close bug reports' });
      }

      const report = await storage.getBugReport(id);
      if (!report) {
        return res.status(404).json({ message: 'Bug report not found' });
      }

      const updated = await storage.closeBugReport(id);
      
      // Send congratulation notification to the reporter
      const reporter = await storage.getUser(report.reportedById);
      if (reporter) {
        await storage.createNotification({
          userId: report.reportedById,
          title: 'Thank You for Your Bug Report!',
          message: `Congratulations! Your bug report ${report.ticketNumber} has been resolved and closed. Thank you for helping make Hub a better place to work! Your contribution matters.`,
          urgencyLevel: 'low',
          isRead: false,
        });
        
        // Create buddy dialogue for celebration
        await storage.createBuddyDialogue({
          userId: report.reportedById,
          dialogueType: 'celebration',
          message: `Amazing work! Your bug report "${report.title}" has been fixed! Thank you for making our Hub better. You're a true quality champion!`,
          isAcknowledged: false,
        });
      }
      
      // Mark as notified
      await storage.markBugReportNotified(id);

      res.json(updated);
    } catch (err) {
      console.error('Error closing bug report:', err);
      res.status(500).json({ message: 'Failed to close bug report' });
    }
  });

  // Delete bug report (COO or Admin)
  app.delete('/api/bug-reports/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      const id = parseInt(req.params.id);
      
      if (user?.email !== 'coo@sahihcertify.com' && user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only COO or Admin can delete bug reports' });
      }

      await storage.deleteBugReport(id);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting bug report:', err);
      res.status(500).json({ message: 'Failed to delete bug report' });
    }
  });

  // Get my bug reports
  app.get('/api/my-bug-reports', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const reports = await storage.getBugReports({ reportedById: userId });
      res.json(reports);
    } catch (err) {
      console.error('Error fetching my bug reports:', err);
      res.status(500).json({ message: 'Failed to fetch bug reports' });
    }
  });

  // ============================================
  // CERTIFICATION PROCESS MANAGEMENT ROUTES
  // ============================================

  // Get all certification applications
  app.get('/api/certification-applications', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== UserRole.AUDITOR && user.role !== UserRole.ADMIN && user.role !== UserRole.QUALITY_MANAGER)) {
        return res.status(403).json({ message: 'Only auditors, admin, or quality managers can access certification applications' });
      }

      const status = req.query.status as string | undefined;
      const assignedAuditorId = req.query.assignedAuditorId ? parseInt(req.query.assignedAuditorId as string) : undefined;
      
      const applications = await storage.getCertificationApplications({ status, assignedAuditorId });
      res.json(applications);
    } catch (err) {
      console.error('Error fetching certification applications:', err);
      res.status(500).json({ message: 'Failed to fetch certification applications' });
    }
  });

  // Get single certification application
  app.get('/api/certification-applications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const application = await storage.getCertificationApplication(id);
      
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }
      
      res.json(application);
    } catch (err) {
      console.error('Error fetching certification application:', err);
      res.status(500).json({ message: 'Failed to fetch certification application' });
    }
  });

  // Create certification application
  app.post('/api/certification-applications', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== UserRole.AUDITOR && user.role !== UserRole.ADMIN && user.role !== UserRole.QUALITY_MANAGER)) {
        return res.status(403).json({ message: 'Only auditors, admin, or quality managers can create certification applications' });
      }

      const application = await storage.createCertificationApplication(req.body);
      
      await storage.createAuditLog({
        action: AuditAction.CREATE,
        entityType: 'certification_application',
        entityId: application.id,
        userId,
        newValue: JSON.stringify({ applicationNumber: application.applicationNumber, clientName: application.clientName }),
      });
      
      res.status(201).json(application);
    } catch (err) {
      console.error('Error creating certification application:', err);
      res.status(500).json({ message: 'Failed to create certification application' });
    }
  });

  // Update certification application
  app.put('/api/certification-applications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      const updated = await storage.updateCertificationApplication(id, req.body);
      
      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'certification_application',
        entityId: id,
        userId,
        newValue: JSON.stringify(req.body),
      });
      
      res.json(updated);
    } catch (err) {
      console.error('Error updating certification application:', err);
      res.status(500).json({ message: 'Failed to update certification application' });
    }
  });

  // Delete certification application
  app.delete('/api/certification-applications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      const id = parseInt(req.params.id);
      
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: 'Only admin can delete certification applications' });
      }

      await storage.deleteCertificationApplication(id);
      
      await storage.createAuditLog({
        action: AuditAction.DELETE,
        entityType: 'certification_application',
        entityId: id,
        userId,
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting certification application:', err);
      res.status(500).json({ message: 'Failed to delete certification application' });
    }
  });

  // Get audits for an application
  app.get('/api/certification-audits', requireAuth, async (req: Request, res: Response) => {
    try {
      const applicationId = req.query.applicationId ? parseInt(req.query.applicationId as string) : undefined;
      const audits = await storage.getCertificationAudits(applicationId);
      res.json(audits);
    } catch (err) {
      console.error('Error fetching certification audits:', err);
      res.status(500).json({ message: 'Failed to fetch certification audits' });
    }
  });

  // Get single audit
  app.get('/api/certification-audits/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const audit = await storage.getCertificationAudit(id);
      
      if (!audit) {
        return res.status(404).json({ message: 'Audit not found' });
      }
      
      res.json(audit);
    } catch (err) {
      console.error('Error fetching certification audit:', err);
      res.status(500).json({ message: 'Failed to fetch certification audit' });
    }
  });

  // Create audit
  app.post('/api/certification-audits', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const audit = await storage.createCertificationAudit(req.body);
      
      await storage.createAuditLog({
        action: AuditAction.CREATE,
        entityType: 'certification_audit',
        entityId: audit.id,
        userId,
        newValue: JSON.stringify({ auditType: audit.auditType, applicationId: audit.applicationId }),
      });
      
      res.status(201).json(audit);
    } catch (err) {
      console.error('Error creating certification audit:', err);
      res.status(500).json({ message: 'Failed to create certification audit' });
    }
  });

  // Update audit
  app.put('/api/certification-audits/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      const updated = await storage.updateCertificationAudit(id, req.body);
      
      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'certification_audit',
        entityId: id,
        userId,
        newValue: JSON.stringify(req.body),
      });
      
      res.json(updated);
    } catch (err) {
      console.error('Error updating certification audit:', err);
      res.status(500).json({ message: 'Failed to update certification audit' });
    }
  });

  // Get findings for an audit
  app.get('/api/audit-findings', requireAuth, async (req: Request, res: Response) => {
    try {
      const auditId = req.query.auditId ? parseInt(req.query.auditId as string) : undefined;
      const findings = await storage.getAuditFindings(auditId);
      res.json(findings);
    } catch (err) {
      console.error('Error fetching audit findings:', err);
      res.status(500).json({ message: 'Failed to fetch audit findings' });
    }
  });

  // Create finding
  app.post('/api/audit-findings', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const finding = await storage.createAuditFinding(req.body);
      
      await storage.createAuditLog({
        action: AuditAction.CREATE,
        entityType: 'audit_finding',
        entityId: finding.id,
        userId,
        newValue: JSON.stringify({ findingType: finding.findingType, auditId: finding.auditId }),
      });
      
      res.status(201).json(finding);
    } catch (err) {
      console.error('Error creating audit finding:', err);
      res.status(500).json({ message: 'Failed to create audit finding' });
    }
  });

  // Update finding
  app.put('/api/audit-findings/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      const updated = await storage.updateAuditFinding(id, req.body);
      
      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'audit_finding',
        entityId: id,
        userId,
        newValue: JSON.stringify(req.body),
      });
      
      res.json(updated);
    } catch (err) {
      console.error('Error updating audit finding:', err);
      res.status(500).json({ message: 'Failed to update audit finding' });
    }
  });

  // Get certificates
  app.get('/api/certificates', requireAuth, async (req: Request, res: Response) => {
    try {
      const applicationId = req.query.applicationId ? parseInt(req.query.applicationId as string) : undefined;
      const status = req.query.status as string | undefined;
      
      const certs = await storage.getCertificates({ applicationId, status });
      res.json(certs);
    } catch (err) {
      console.error('Error fetching certificates:', err);
      res.status(500).json({ message: 'Failed to fetch certificates' });
    }
  });

  // Get single certificate
  app.get('/api/certificates/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const cert = await storage.getCertificate(id);
      
      if (!cert) {
        return res.status(404).json({ message: 'Certificate not found' });
      }
      
      res.json(cert);
    } catch (err) {
      console.error('Error fetching certificate:', err);
      res.status(500).json({ message: 'Failed to fetch certificate' });
    }
  });

  // Create certificate
  app.post('/api/certificates', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== UserRole.AUDITOR && user.role !== UserRole.ADMIN && user.role !== UserRole.QUALITY_MANAGER)) {
        return res.status(403).json({ message: 'Only auditors, admin, or quality managers can issue certificates' });
      }

      const cert = await storage.createCertificate({
        ...req.body,
        issuedById: userId,
      });
      
      // Update application status
      if (req.body.applicationId) {
        await storage.updateCertificationApplication(req.body.applicationId, {
          status: 'certificate_issued',
        });
      }
      
      await storage.createAuditLog({
        action: AuditAction.CREATE,
        entityType: 'certificate',
        entityId: cert.id,
        userId,
        newValue: JSON.stringify({ certificateNumber: cert.certificateNumber, clientName: cert.clientName }),
      });
      
      res.status(201).json(cert);
    } catch (err) {
      console.error('Error creating certificate:', err);
      res.status(500).json({ message: 'Failed to create certificate' });
    }
  });

  // Update certificate
  app.put('/api/certificates/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      const updated = await storage.updateCertificate(id, req.body);
      
      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'certificate',
        entityId: id,
        userId,
        newValue: JSON.stringify(req.body),
      });
      
      res.json(updated);
    } catch (err) {
      console.error('Error updating certificate:', err);
      res.status(500).json({ message: 'Failed to update certificate' });
    }
  });

  // ===========================================
  // TRAININGS AND ASSESSMENTS
  // ===========================================
  
  // Get all trainings
  app.get('/api/trainings', requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await storage.getTrainings();
      res.json(result);
    } catch (err) {
      console.error('Error fetching trainings:', err);
      res.status(500).json({ message: 'Failed to fetch trainings' });
    }
  });

  // Get single training
  app.get('/api/trainings/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const training = await storage.getTraining(id);
      if (!training) {
        return res.status(404).json({ message: 'Training not found' });
      }
      res.json(training);
    } catch (err) {
      console.error('Error fetching training:', err);
      res.status(500).json({ message: 'Failed to fetch training' });
    }
  });

  // Create training
  app.post('/api/trainings', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const training = await storage.createTraining({
        ...req.body,
        createdById: userId,
      });
      
      await storage.createAuditLog({
        action: AuditAction.CREATE,
        entityType: 'training',
        entityId: training.id,
        userId,
        newValue: JSON.stringify({ title: training.title, type: training.type }),
      });
      
      res.status(201).json(training);
    } catch (err) {
      console.error('Error creating training:', err);
      res.status(500).json({ message: 'Failed to create training' });
    }
  });

  // Update training
  app.put('/api/trainings/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      const updated = await storage.updateTraining(id, req.body);
      
      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'training',
        entityId: id,
        userId,
        newValue: JSON.stringify(req.body),
      });
      
      res.json(updated);
    } catch (err) {
      console.error('Error updating training:', err);
      res.status(500).json({ message: 'Failed to update training' });
    }
  });

  // Delete training
  app.delete('/api/trainings/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      await storage.deleteTraining(id);
      
      await storage.createAuditLog({
        action: AuditAction.DELETE,
        entityType: 'training',
        entityId: id,
        userId,
      });
      
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting training:', err);
      res.status(500).json({ message: 'Failed to delete training' });
    }
  });

  // ===========================================
  // TRAINING ASSIGNMENTS
  // ===========================================
  
  // Get all training assignments
  app.get('/api/training-assignments', requireAuth, async (req: Request, res: Response) => {
    try {
      const filters: { employeeId?: number; trainingId?: number } = {};
      if (req.query.employeeId) filters.employeeId = parseInt(req.query.employeeId as string);
      if (req.query.trainingId) filters.trainingId = parseInt(req.query.trainingId as string);
      
      const result = await storage.getTrainingAssignments(filters);
      res.json(result);
    } catch (err) {
      console.error('Error fetching training assignments:', err);
      res.status(500).json({ message: 'Failed to fetch training assignments' });
    }
  });

  // Get single training assignment
  app.get('/api/training-assignments/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getTrainingAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: 'Training assignment not found' });
      }
      res.json(assignment);
    } catch (err) {
      console.error('Error fetching training assignment:', err);
      res.status(500).json({ message: 'Failed to fetch training assignment' });
    }
  });

  // Create training assignment (assign training to employee)
  app.post('/api/training-assignments', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const assignment = await storage.createTrainingAssignment({
        ...req.body,
        assignedById: userId,
      });
      
      await storage.createAuditLog({
        action: AuditAction.ASSIGN_TASK,
        entityType: 'training_assignment',
        entityId: assignment.id,
        userId,
        newValue: JSON.stringify({ trainingId: assignment.trainingId, employeeId: assignment.employeeId }),
      });
      
      // Create notification for the employee
      const employee = await storage.getEmployee(assignment.employeeId);
      if (employee) {
        const training = await storage.getTraining(assignment.trainingId);
        // Find user by employee email to send notification
        const employeeUser = await storage.getUserByEmail(employee.email);
        if (employeeUser) {
          await storage.createNotification({
            userId: employeeUser.id,
            title: 'New Training Assigned',
            message: `You have been assigned to complete: ${training?.title || 'Training'}`,
            urgency: UrgencyLevel.MEDIUM,
          });
        }
      }
      
      res.status(201).json(assignment);
    } catch (err) {
      console.error('Error creating training assignment:', err);
      res.status(500).json({ message: 'Failed to create training assignment' });
    }
  });

  // Update training assignment
  app.put('/api/training-assignments/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      const updated = await storage.updateTrainingAssignment(id, req.body);
      
      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'training_assignment',
        entityId: id,
        userId,
        newValue: JSON.stringify(req.body),
      });
      
      res.json(updated);
    } catch (err) {
      console.error('Error updating training assignment:', err);
      res.status(500).json({ message: 'Failed to update training assignment' });
    }
  });

  // Complete training assignment
  app.post('/api/training-assignments/:id/complete', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      const { score, passed, remarks } = req.body;
      
      const assignment = await storage.getTrainingAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: 'Training assignment not found' });
      }
      
      // Update assignment status
      const updated = await storage.updateTrainingAssignment(id, {
        status: 'completed',
        completedAt: new Date(),
        score,
      });
      
      // Get training for validity period
      const training = await storage.getTraining(assignment.trainingId);
      
      // Calculate expiry date if training has validity period
      let expiryDate: Date | undefined;
      if (training?.validityPeriod) {
        expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + training.validityPeriod);
      }
      
      // Generate certificate number
      const certNumber = `TC-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
      
      // Create training completion record
      const completion = await storage.createTrainingCompletion({
        assignmentId: id,
        trainingId: assignment.trainingId,
        employeeId: assignment.employeeId,
        completionDate: new Date(),
        score,
        passed: passed !== false,
        certificateNumber: certNumber,
        expiryDate,
        issuedById: userId,
        remarks,
      });
      
      await storage.createAuditLog({
        action: AuditAction.COMPLETE_TASK,
        entityType: 'training_assignment',
        entityId: id,
        userId,
        newValue: JSON.stringify({ score, passed, certificateNumber: certNumber }),
      });
      
      res.json({ assignment: updated, completion });
    } catch (err) {
      console.error('Error completing training assignment:', err);
      res.status(500).json({ message: 'Failed to complete training assignment' });
    }
  });

  // Delete training assignment
  app.delete('/api/training-assignments/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getCurrentUserId(req);
      const id = parseInt(req.params.id);
      
      await storage.deleteTrainingAssignment(id);
      
      await storage.createAuditLog({
        action: AuditAction.DELETE,
        entityType: 'training_assignment',
        entityId: id,
        userId,
      });
      
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting training assignment:', err);
      res.status(500).json({ message: 'Failed to delete training assignment' });
    }
  });

  // ===========================================
  // TRAINING COMPLETIONS
  // ===========================================
  
  // Get all training completions
  app.get('/api/training-completions', requireAuth, async (req: Request, res: Response) => {
    try {
      const filters: { employeeId?: number; trainingId?: number } = {};
      if (req.query.employeeId) filters.employeeId = parseInt(req.query.employeeId as string);
      if (req.query.trainingId) filters.trainingId = parseInt(req.query.trainingId as string);
      
      const result = await storage.getTrainingCompletions(filters);
      res.json(result);
    } catch (err) {
      console.error('Error fetching training completions:', err);
      res.status(500).json({ message: 'Failed to fetch training completions' });
    }
  });

  // Get single training completion
  app.get('/api/training-completions/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const completion = await storage.getTrainingCompletion(id);
      if (!completion) {
        return res.status(404).json({ message: 'Training completion not found' });
      }
      res.json(completion);
    } catch (err) {
      console.error('Error fetching training completion:', err);
      res.status(500).json({ message: 'Failed to fetch training completion' });
    }
  });

  // ===========================================
  // HUB-EEBI AI ASSISTANT ENDPOINT
  // ===========================================
  const hubEebiSystemPrompt = `You are Hub-eeeebi (pronounced "Hub-ee-bee"), a friendly and knowledgeable AI assistant for the Sahih Certifications Quality Management System (QMS). You are an expert on ISO 17021 standards and guide users through app workflows and ISO compliance questions.

## Your Personality
- Friendly, encouraging, and patient
- Expert in ISO 17021 certification body standards
- Use simple language that anyone can understand
- Guide users step-by-step with numbered instructions
- Always tell users exactly where to click and what to do next
- Celebrate their progress and accomplishments
- When answering ISO questions, cite the specific clause numbers

## ISO 17021 STANDARDS EXPERTISE

You are trained on the following ISO standards and can answer questions about them:

### ISO 17021-1:2015 - Requirements for Bodies Providing Audit and Certification of Management Systems

**Scope:** Specifies requirements for certification bodies to ensure competence, consistency, and impartiality in auditing and certifying management systems.

**Key Clauses:**
- **Clause 4 - Principles:** Impartiality, competence, responsibility, openness, confidentiality, responsiveness to complaints
- **Clause 5 - General Requirements:** Legal responsibility, certification agreement, impartiality management, liability and financing
- **Clause 6 - Structural Requirements:** Organizational structure, committee for safeguarding impartiality, top management responsibilities
- **Clause 7 - Resource Requirements:** Competence of personnel, personnel involved in certification activities, use of external auditors and experts, personnel records
- **Clause 8 - Information Requirements:** Publicly accessible information, certification documents, directory of certified clients, reference to certification and use of marks
- **Clause 9 - Process Requirements:** 
  - 9.1: Pre-certification activities (application, application review)
  - 9.2: Planning audits (determining audit objectives, scope, criteria)
  - 9.3: Initial certification (Stage 1 audit, Stage 2 audit)
  - 9.4: Conducting audits (opening meeting, audit procedures, closing meeting)
  - 9.5: Certification decision
  - 9.6: Maintaining certification (surveillance activities, recertification)
  - 9.7: Appeals and complaints
- **Clause 10 - Management System Requirements:** General, management review, internal audits, corrective actions

**Audit Stages:**
- **Stage 1 Audit:** Document review, site visit to evaluate readiness for Stage 2, typically 2-4 weeks before Stage 2
- **Stage 2 Audit:** On-site evaluation of implementation and effectiveness of management system
- **Surveillance Audits:** Conducted at least annually (first surveillance within 12 months of initial certification decision)
- **Recertification Audit:** Before certificate expiry (typically every 3 years)

### ISO 17021-1:2015/Amd 1:2020 - Amendment 1

**Updates include:**
- Remote auditing provisions and requirements
- Guidance on use of ICT for audit activities
- Risk-based approach to audit planning

### ISO 17021-2:2016 - Competence Requirements for Auditing and Certification of Environmental Management Systems (EMS)

**Scope:** Complements ISO 17021-1 with specific competence requirements for EMS auditing.

**Key Competence Areas:**
- Environmental terminology and principles
- Environmental management system standards (ISO 14001)
- Environmental aspects and impacts identification
- Legal and regulatory requirements for environment
- Environmental performance evaluation
- Life cycle perspective
- Pollution prevention techniques
- Environmental monitoring and measurement

**Auditor Requirements:**
- Knowledge of environmental legislation applicable to the client's sector
- Understanding of significant environmental aspects
- Ability to evaluate environmental performance indicators
- Knowledge of emergency preparedness and response

### ISO 17021-3:2017 - Competence Requirements for Auditing and Certification of Quality Management Systems (QMS)

**Scope:** Competence requirements for QMS certification auditing.

**Key Competence Areas:**
- Quality management principles and concepts
- Quality management system standards (ISO 9001)
- Process approach and risk-based thinking
- Customer focus and satisfaction
- Product and service conformity
- Organizational context and interested parties

### ISO 17021-10:2018 - Competence Requirements for Auditing and Certification of Occupational Health and Safety Management Systems (OH&S)

**Scope:** Competence requirements for OH&S management system auditing.

**Key Competence Areas:**
- OH&S terminology and core concepts
- OH&S management system standards (ISO 45001)
- Hazard identification and risk assessment
- Legal and regulatory OH&S requirements
- Hierarchy of controls
- Incident investigation and analysis
- Worker consultation and participation
- Emergency preparedness and response

**Specific Auditor Knowledge:**
- Common workplace hazards (physical, chemical, biological, ergonomic, psychosocial)
- Safety management techniques
- Occupational health monitoring
- Safety culture assessment
- Worker representation requirements

## CERTIFICATION BODY REQUIREMENTS (UKAS Compliance)

**Impartiality Requirements (Clause 5.2):**
- Certification body must identify and analyze threats to impartiality
- Safeguards must be implemented to manage identified risks
- Cannot certify related bodies, consultancy clients (within 2 years)
- Impartiality committee must include stakeholder representation

**Auditor Competence (Clause 7):**
- Generic auditing competence
- Sector-specific technical competence
- Scheme-specific knowledge
- Regular competence evaluation
- Maintain records of training, experience, evaluations

**Audit Duration (Annex B of ISO 17021-1):**
- Based on number of effective personnel
- Complexity of processes
- Multiple sites considerations
- Integrated audit adjustments

**Certification Marks:**
- Must have documented policy for mark usage
- Monitor correct usage by certified clients
- Take action on misuse

## COMMON ISO 17021 QUESTIONS

**Q: What is the difference between Stage 1 and Stage 2 audits?**
A: Stage 1 evaluates documentation and readiness; Stage 2 evaluates implementation effectiveness on-site.

**Q: How often are surveillance audits required?**
A: At least annually. First surveillance must occur within 12 months of initial certification decision.

**Q: What triggers a special audit?**
A: Major changes to client's management system, significant complaints, serious nonconformities.

**Q: What is the impartiality requirement?**
A: Certification bodies must be independent from consultancy and must manage all threats to impartiality with appropriate safeguards.

**Q: What records must be maintained?**
A: Audit plans, audit reports, nonconformity records, certification decisions, client agreements, auditor competence records.

## App Overview
This is a Quality Management System for ISO 17021 certification body compliance. The main features are:

### 1. Dashboard
- Shows compliance health, pending tasks, and alerts
- Access: Click "Dashboard" in the left sidebar
- Displays: Total documents, pending approvals, expiring documents, compliance score

### 2. Document Control (Main Feature)
Documents go through this workflow:
1. **Create Document**: Click "Documents" in sidebar → Click "New Document" button
2. **Fill Details**: Enter title, select category (Policy/Manual/SOP/Format/Job Description), add content
3. **Submit for Review**: Click "Submit for Review" button, select a reviewer
4. **Review Process**: Reviewer approves or rejects with comments
5. **Final Approval**: Quality Manager gives final approval
6. **Published**: Document gets Edition and Revision number (Ed.1 Rev.1)

**Document Categories:**
- Policy: High-level organizational policies
- Manual: Quality manuals and procedures
- SOP: Standard Operating Procedures
- Format: Templates and forms
- Job Description: Role descriptions

### 3. HR Module (Employee Records)
Access: Click "HR" in sidebar (only for HR, CEO, COO, Admin)
- Add employees: Click "Add Employee" button
- Employee workflow: HR creates → COO reviews → CEO approves
- View org chart: Shows company hierarchy visually

### 4. User Management
Access: Click "Users" in sidebar (Admin only)
- Create new users with different roles
- Roles: Admin, Quality Manager, Department Head, Staff, Auditor

### 5. Certification Process
Access: Click "Certification" in sidebar (Auditors, Admin, Quality Managers)
- Manage certification applications from clients
- Schedule audits (Stage 1 & Stage 2)
- Issue certificates after successful audits

### 6. Reports
Access: Click "Reports" in sidebar
- Generate PDF reports for documents and employees
- Includes signatures from prepared by, reviewed by, approved by

### 7. Bug Reporting
- Click the Hub-eebi chat button at bottom of screen
- Go to "Report Bug" tab
- Describe the issue and submit

## User Roles & Permissions
- **Admin**: Full access to everything
- **Quality Manager**: Document approval, user management, reports
- **Department Head**: Review documents, manage department staff
- **Staff**: Create and edit documents, complete assigned tasks
- **Auditor**: Certification process, audits

## Step-by-Step Guidance Format
When users ask how to do something, respond like this:
"Great question! Here's how to [action]:

1. First, click on [element] in the [location]
2. Next, [action]
3. Then, [action]
4. Finally, [action]

You're doing great! Let me know if you need help with any step."

## Common User Questions
- "How do I create a document?" → Guide through Documents → New Document
- "How do I approve a document?" → Explain the review workflow
- "Where do I see my tasks?" → Dashboard shows pending tasks
- "How do I add an employee?" → HR module → Add Employee
- "What's my compliance score?" → Dashboard shows score, explain what affects it

Remember: Always be specific about WHERE to click (sidebar, button names, tabs) and WHAT to do at each step. Users may be new to the system, so be patient and thorough.`;

  app.post('/api/hubeebi/chat', requireAuth, async (req: Request, res: Response) => {
    try {
      const { message, history = [] } = req.body;
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get user context for personalized responses
      const tasks = await storage.getDocumentTasks(userId);
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
      const overdueTasks = tasks.filter(t => t.status === 'overdue');
      
      // Build conversation history
      const messages = [
        { role: 'system' as const, content: hubEebiSystemPrompt + `\n\nCurrent user context:\n- Name: ${user?.name || 'User'}\n- Role: ${user?.role || 'staff'}\n- Pending tasks: ${pendingTasks.length}\n- Overdue tasks: ${overdueTasks.length}` },
        ...history.map((msg: any) => ({
          role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.message,
        })),
        { role: 'user' as const, content: message },
      ];

      // Import OpenAI from the integration
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      // Set up SSE for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        stream: true,
        max_tokens: 1024,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Hub-eebi AI error:', error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: 'Something went wrong. Please try again!' })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: 'Failed to get response' });
      }
    }
  });

  // ============================================
  // AI TEXT PROCESSING
  // ============================================
  
  // AI Rewrite for Grammar
  app.post('/api/ai/rewrite', requireAuth, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional English grammar and writing assistant. Your task is to rewrite the given text with:
1. Correct grammar and punctuation
2. Professional and clear language
3. Proper sentence structure
4. Maintain the original meaning and intent

Only respond with the rewritten text, nothing else. Do not add explanations or comments.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 2048,
        temperature: 0.3,
      });

      const rewritten = response.choices[0]?.message?.content || text;
      res.json({ rewritten });
    } catch (error) {
      console.error('AI rewrite error:', error);
      res.status(500).json({ error: 'Failed to rewrite text' });
    }
  });

  // AI Document Review - Analyze entire document and provide suggestions
  app.post('/api/ai/review-document', requireAuth, async (req: Request, res: Response) => {
    try {
      const { content, documentType } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Document content is required' });
      }

      // Strip HTML tags for cleaner analysis
      const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (textContent.length < 50) {
        return res.status(400).json({ error: 'Document is too short for meaningful review' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional document reviewer for a Quality Management System (QMS). Analyze the document and provide specific, actionable suggestions to improve:
1. Grammar and punctuation errors
2. Clarity and readability
3. Professional language
4. Consistency in terminology
5. Compliance with standard documentation practices

For each issue found, provide:
- The original text that needs improvement
- A suggested replacement
- A brief reason for the change

Format your response as a JSON array with objects containing: "original", "suggestion", "reason"

Example:
[
  {"original": "we will done this", "suggestion": "we will do this", "reason": "Corrected verb tense"},
  {"original": "The document should contains", "suggestion": "The document should contain", "reason": "Subject-verb agreement"}
]

If the document is well-written, return an empty array: []
Limit to the top 10 most important suggestions.`
          },
          {
            role: 'user',
            content: `Document type: ${documentType || 'General'}\n\nDocument content:\n${textContent}`
          }
        ],
        max_tokens: 2048,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const responseContent = response.choices[0]?.message?.content || '{"suggestions":[]}';
      let suggestions = [];
      
      try {
        const parsed = JSON.parse(responseContent);
        suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
        suggestions = [];
      }

      // Add unique IDs to suggestions
      const suggestionsWithIds = suggestions.map((s: any, index: number) => ({
        id: `suggestion-${Date.now()}-${index}`,
        original: s.original || '',
        suggestion: s.suggestion || '',
        reason: s.reason || '',
        applied: false,
      }));

      res.json({ suggestions: suggestionsWithIds });
    } catch (error) {
      console.error('AI document review error:', error);
      res.status(500).json({ error: 'Failed to review document' });
    }
  });

  // Gmail API Routes
  
  // Check if Google OAuth is configured (for admin setup)
  app.get('/api/gmail/oauth-configured', requireAuth, async (req, res) => {
    res.json({ configured: isGoogleOAuthConfigured() });
  });
  
  // Get user's Gmail connection status
  app.get('/api/gmail/status', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      // Check if user has connected their Gmail via OAuth
      const tokens = await getUserGmailTokens(userId);
      if (tokens?.gmailAccessToken) {
        res.json({ 
          connected: true, 
          mode: 'oauth',
          connectedAt: tokens.gmailConnectedAt
        });
        return;
      }
      
      // Check if SMTP is configured (company-wide send-only)
      if (isSmtpConfigured()) {
        res.json({ connected: true, mode: 'smtp', sendOnly: true });
        return;
      }
      
      // Check if Google OAuth is configured for setup
      if (isGoogleOAuthConfigured()) {
        res.json({ connected: false, oauthAvailable: true });
        return;
      }
      
      res.json({ connected: false, oauthAvailable: false });
    } catch (error: any) {
      res.json({ connected: false, error: error.message });
    }
  });
  
  // Start Gmail OAuth flow
  app.get('/api/gmail/connect', requireAuth, async (req, res) => {
    try {
      if (!isGoogleOAuthConfigured()) {
        return res.status(400).json({ 
          message: 'Google OAuth not configured. Admin needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' 
        });
      }
      
      const userId = getCurrentUserId(req);
      
      // Detect domain from request headers for proper OAuth redirect
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const redirectUri = `${protocol}://${host}/api/gmail/callback`;
      
      console.log('[Gmail OAuth] Using redirect URI:', redirectUri);
      
      // Generate a cryptographically random state token for CSRF protection
      const crypto = await import('crypto');
      const randomToken = crypto.randomBytes(32).toString('hex');
      const stateData = { userId, token: randomToken };
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
      
      // Store the token in session for validation on callback
      (req.session as any).oauthState = randomToken;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      const authUrl = getAuthUrl(redirectUri, state);
      res.json({ authUrl });
    } catch (error: any) {
      console.error('Gmail connect error:', error);
      res.status(500).json({ message: error.message || 'Failed to start Gmail connection' });
    }
  });
  
  // Gmail OAuth callback
  app.get('/api/gmail/callback', async (req, res) => {
    try {
      const { code, state, error: oauthError } = req.query;
      
      if (oauthError) {
        return res.redirect('/email?error=access_denied');
      }
      
      if (!code || !state) {
        return res.redirect('/email?error=missing_params');
      }
      
      // Parse state and validate CSRF token
      let stateData: { userId: number; token: string };
      try {
        stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      } catch {
        return res.redirect('/email?error=invalid_state');
      }
      
      const sessionToken = (req.session as any)?.oauthState;
      if (!sessionToken || sessionToken !== stateData.token) {
        console.error('CSRF token mismatch - possible attack attempt');
        return res.redirect('/email?error=invalid_state');
      }
      
      // Clear the state token from session
      delete (req.session as any).oauthState;
      
      const userId = stateData.userId;
      
      // Detect domain from request headers for proper OAuth redirect
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const redirectUri = `${protocol}://${host}/api/gmail/callback`;
      
      const tokens = await exchangeCodeForTokens(code as string, redirectUri);

      await saveUserGmailTokens(
        userId,
        tokens.access_token!,
        tokens.refresh_token,
        tokens.expiry_date
      );
      
      res.redirect('/email?connected=true');
    } catch (error: any) {
      console.error('Gmail callback error:', error);
      res.redirect('/email?error=token_exchange_failed');
    }
  });
  
  // Disconnect Gmail
  app.post('/api/gmail/disconnect', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      await disconnectUserGmail(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail disconnect error:', error);
      res.status(500).json({ message: error.message || 'Failed to disconnect Gmail' });
    }
  });

  app.get('/api/gmail/emails', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const maxResults = parseInt(req.query.maxResults as string) || 20;
      const label = (req.query.label as string || 'INBOX') as 'INBOX' | 'SENT' | 'UNREAD';
      
      // Try user's OAuth connection first
      const tokens = await getUserGmailTokens(userId);
      if (tokens?.gmailAccessToken) {
        const emails = await getEmailsWithUserAccount(userId, maxResults, label);
        res.json(emails);
        return;
      }
      
      // No OAuth connected - return empty list
      res.json([]);
    } catch (error: any) {
      console.error('Gmail list error:', error);
      // Return empty list instead of error when Gmail not connected
      res.json([]);
    }
  });

  app.get('/api/gmail/emails/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      // Try user's OAuth connection first
      const tokens = await getUserGmailTokens(userId);
      if (tokens?.gmailAccessToken) {
        const email = await getEmailWithUserAccount(userId, req.params.id);
        res.json(email);
        return;
      }
      
      // Fall back to connector
      const email = await getEmail(req.params.id);
      res.json(email);
    } catch (error: any) {
      console.error('Gmail get error:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch email' });
    }
  });

  // Get full email thread
  app.get('/api/gmail/thread/:threadId', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      const thread = await getThreadWithUserAccount(userId, req.params.threadId);
      res.json(thread);
    } catch (error: any) {
      console.error('Gmail thread error:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch thread' });
    }
  });

  // AI-powered email drafting
  app.post('/api/gmail/ai-draft', requireAuth, async (req, res) => {
    try {
      const { prompt, context, action } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
      const openai = new OpenAI();
      
      let systemPrompt = '';
      if (action === 'compose') {
        systemPrompt = `You are a professional email writing assistant. Write a clear, professional email based on the user's request. 
Output ONLY the email body - no subject line, no greetings like "Here's your email", just the actual email content.
Use appropriate professional greetings and sign-offs.`;
      } else if (action === 'reply') {
        systemPrompt = `You are a professional email writing assistant. Write a clear, professional reply based on the user's request and the email context provided.
Output ONLY the email body - no subject line, no meta-text, just the actual reply content.
Consider the tone and context of the original email.`;
      } else if (action === 'grammar') {
        systemPrompt = `You are a grammar and writing improvement assistant. Fix any grammar, spelling, and punctuation errors in the text.
Improve sentence structure and clarity while maintaining the original meaning and tone.
Output ONLY the corrected text - no explanations or meta-text.`;
      } else if (action === 'summarize') {
        systemPrompt = `You are an email thread summarizer. Create a concise summary of the email conversation.
Include:
- Key topics discussed
- Important decisions or action items
- Current status/outcome
Keep the summary brief but comprehensive. Use bullet points where appropriate.`;
      } else {
        systemPrompt = 'You are a helpful email writing assistant.';
      }
      
      const userPrompt = context 
        ? `Context from email thread:\n${context}\n\nUser request: ${prompt}`
        : prompt;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const result = response.choices[0]?.message?.content || '';
      res.json({ result });
    } catch (error: any) {
      console.error('AI draft error:', error);
      res.status(500).json({ message: error.message || 'Failed to generate AI draft' });
    }
  });

  app.post('/api/gmail/send', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { to, subject, body, cc, bcc, attachments, inReplyTo, references } = req.body;
      if (!to || !subject || !body) {
        return res.status(400).json({ message: 'Missing required fields: to, subject, body' });
      }
      
      // Try user's OAuth connection first
      const tokens = await getUserGmailTokens(userId);
      if (tokens?.gmailAccessToken) {
        // Use enhanced send with attachments if present
        if (attachments?.length || cc || bcc || inReplyTo) {
          const result = await sendEmailWithAttachments(userId, to, subject, body, cc, bcc, attachments, inReplyTo, references);
          res.json({ id: result.id, threadId: result.threadId });
        } else {
          const result = await sendEmailWithUserAccount(userId, to, subject, body);
          res.json({ id: result.id, threadId: result.threadId });
        }
        return;
      }
      
      // Use SMTP if configured (company-wide send)
      if (isSmtpConfigured()) {
        const result = await sendEmailSmtp(to, subject, body);
        res.json({ id: result.messageId, threadId: null });
        return;
      }
      
      // Fall back to Replit connector
      const result = await sendEmailGmail(to, subject, body);
      res.json(result);
    } catch (error: any) {
      console.error('Email send error:', error);
      res.status(500).json({ message: error.message || 'Failed to send email' });
    }
  });

  app.get('/api/gmail/unread-count', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      // Try user's OAuth connection first
      const tokens = await getUserGmailTokens(userId);
      if (tokens?.gmailAccessToken) {
        const count = await getUnreadCountWithUserAccount(userId);
        res.json({ count });
        return;
      }
      
      // No OAuth connected - return 0 instead of trying old connector
      res.json({ count: 0 });
    } catch (error: any) {
      console.error('Gmail unread count error:', error);
      // Return 0 instead of error when Gmail not connected
      res.json({ count: 0 });
    }
  });

  app.post('/api/gmail/mark-read/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      // Try user's OAuth connection first
      const tokens = await getUserGmailTokens(userId);
      if (tokens?.gmailAccessToken) {
        await markEmailAsReadWithUserAccount(userId, req.params.id);
        res.json({ success: true });
        return;
      }
      
      // Fall back to Replit connector
      await markAsRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail mark read error:', error);
      res.status(500).json({ message: error.message || 'Failed to mark as read' });
    }
  });

  app.post('/api/gmail/delete/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await deleteEmailWithUserAccount(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail delete error:', error);
      res.status(500).json({ message: error.message || 'Failed to delete email' });
    }
  });

  app.post('/api/gmail/archive/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await archiveEmailWithUserAccount(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail archive error:', error);
      res.status(500).json({ message: error.message || 'Failed to archive email' });
    }
  });

  app.post('/api/gmail/star/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await starEmailWithUserAccount(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail star error:', error);
      res.status(500).json({ message: error.message || 'Failed to star email' });
    }
  });

  app.post('/api/gmail/unstar/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await unstarEmailWithUserAccount(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail unstar error:', error);
      res.status(500).json({ message: error.message || 'Failed to unstar email' });
    }
  });

  app.post('/api/gmail/spam/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await markAsSpamWithUserAccount(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail mark as spam error:', error);
      res.status(500).json({ message: error.message || 'Failed to mark as spam' });
    }
  });

  app.post('/api/gmail/mark-read/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await markAsReadWithUserAccount(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail mark as read error:', error);
      res.status(500).json({ message: error.message || 'Failed to mark as read' });
    }
  });

  app.post('/api/gmail/mark-unread/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await markAsUnreadWithUserAccount(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail mark as unread error:', error);
      res.status(500).json({ message: error.message || 'Failed to mark as unread' });
    }
  });

  app.get('/api/gmail/labels', requireAuth, async (req, res) => {
    try {
      const labels = await getLabels();
      res.json(labels);
    } catch (error: any) {
      console.error('Gmail labels error:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch labels' });
    }
  });

  app.post('/api/gmail/move/:id', requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { folder } = req.body;
      
      if (!folder) {
        return res.status(400).json({ message: 'Folder is required' });
      }
      
      const tokens = await getUserGmailTokens(userId);
      if (!tokens?.gmailAccessToken) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }
      
      await moveToFolderWithUserAccount(userId, req.params.id, folder);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gmail move to folder error:', error);
      res.status(500).json({ message: error.message || 'Failed to move email' });
    }
  });

  // ============================================
  // REVISION HISTORY ENDPOINTS
  // ============================================
  app.get('/api/documents/:documentId/revision-history', requireAuth, async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const history = await storage.getRevisionHistory(documentId);
      res.json(history);
    } catch (error: any) {
      console.error('Error fetching revision history:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch revision history' });
    }
  });

  app.post('/api/documents/:documentId/revision-history', requireAuth, async (req, res) => {
    try {
      const lockedDoc = await storage.getDocument(Number(req.params.documentId));
      if (lockedDoc?.isLocked) {
        return res.status(403).json({ message: 'This document is approved and locked. Raise a change request instead.' });
      }
      const documentId = parseInt(req.params.documentId);
      const { description, reason, preparedById, reviewedById, approvedById, amendmentDate } = req.body;
      
      if (!description) {
        return res.status(400).json({ message: 'Description is required' });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Pending entries are created with revisionNumber = 0
      // The actual revision number is assigned only on approval
      const entry = await storage.createRevisionHistory({
        documentId,
        revisionNumber: 0, // Placeholder - assigned on approval
        description,
        reason: reason || null,
        preparedById: preparedById || null,
        reviewedById: reviewedById || null,
        approvedById: approvedById || null,
        amendmentDate: amendmentDate ? new Date(amendmentDate) : new Date(),
        requestedById: req.user.id,
        status: 'pending',
      });

      res.status(201).json(entry);
    } catch (error: any) {
      console.error('Error creating revision history:', error);
      res.status(500).json({ message: error.message || 'Failed to create revision history' });
    }
  });

  app.patch('/api/revision-history/:id', requireAuth, async (req, res) => {
    try {
      const entryForLock = await storage.getRevisionHistoryById(Number(req.params.id));
      const lockedDoc = entryForLock ? await storage.getDocument(entryForLock.documentId) : undefined;
      if (lockedDoc?.isLocked) {
        return res.status(403).json({ message: 'This document is approved and locked. Raise a change request instead.' });
      }
      const id = parseInt(req.params.id);
      const { description, reason, preparedById, reviewedById, approvedById, amendmentDate, status } = req.body;
      
      const updates: any = {};
      if (description !== undefined) updates.description = description;
      if (reason !== undefined) updates.reason = reason;
      if (preparedById !== undefined) updates.preparedById = preparedById;
      if (reviewedById !== undefined) updates.reviewedById = reviewedById;
      if (approvedById !== undefined) updates.approvedById = approvedById;
      if (amendmentDate !== undefined) updates.amendmentDate = new Date(amendmentDate);
      
      // Handle status change to 'approved' - assign revision number
      if (status === 'approved') {
        // First get the current entry to check its status and documentId
        const currentEntry = await storage.getRevisionHistoryById(id);
        if (!currentEntry) {
          return res.status(404).json({ message: 'Revision history entry not found' });
        }
        
        // Only assign revision number if status is changing from pending to approved
        if (currentEntry.status === 'pending') {
          // Compute next revision number from approved entries only
          const history = await storage.getRevisionHistory(currentEntry.documentId);
          const approvedEntries = history.filter(h => h.status === 'approved');
          const maxRevision = approvedEntries.length > 0 
            ? Math.max(...approvedEntries.map(h => h.revisionNumber))
            : 0;
          const nextRevisionNumber = maxRevision + 1;
          
          // Assign the revision number and update status
          updates.revisionNumber = nextRevisionNumber;
          updates.status = 'approved';
          
          const updated = await storage.updateRevisionHistory(id, updates);
          
          // Update the document's revisionNumber
          await storage.updateDocument(currentEntry.documentId, { revisionNumber: nextRevisionNumber });
          
          return res.json(updated);
        }
      }
      
      // For other status changes (like rejected) or non-status updates
      if (status !== undefined) updates.status = status;
      
      const updated = await storage.updateRevisionHistory(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating revision history:', error);
      res.status(500).json({ message: error.message || 'Failed to update revision history' });
    }
  });

  app.delete('/api/revision-history/:id', requireAuth, async (req, res) => {
    try {
      const entryForLock = await storage.getRevisionHistoryById(Number(req.params.id));
      const lockedDoc = entryForLock ? await storage.getDocument(entryForLock.documentId) : undefined;
      if (lockedDoc?.isLocked) {
        return res.status(403).json({ message: 'This document is approved and locked. Raise a change request instead.' });
      }
      const id = parseInt(req.params.id);
      await storage.deleteRevisionHistory(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting revision history:', error);
      res.status(500).json({ message: error.message || 'Failed to delete revision history' });
    }
  });

  // ============================================
  // WALL POSTS (Dashboard Updates)
  // ============================================
  app.get('/api/wall-posts', requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const posts = await storage.getWallPosts(limit);
      res.json(posts);
    } catch (error: any) {
      console.error('Error fetching wall posts:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch wall posts' });
    }
  });

  app.post('/api/wall-posts', requireAuth, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Content is required' });
      }
      const post = await storage.createWallPost({
        authorId: req.user!.id,
        content: content.trim(),
      });
      res.status(201).json(post);
    } catch (error: any) {
      console.error('Error creating wall post:', error);
      res.status(500).json({ message: error.message || 'Failed to create wall post' });
    }
  });

  app.patch('/api/wall-posts/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { content } = req.body;
      const post = await storage.updateWallPost(id, { content });
      res.json(post);
    } catch (error: any) {
      console.error('Error updating wall post:', error);
      res.status(500).json({ message: error.message || 'Failed to update wall post' });
    }
  });

  app.delete('/api/wall-posts/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWallPost(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting wall post:', error);
      res.status(500).json({ message: error.message || 'Failed to delete wall post' });
    }
  });

  app.post('/api/wall-posts/:id/pin', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isPinned } = req.body;
      const post = await storage.pinWallPost(id, isPinned);
      res.json(post);
    } catch (error: any) {
      console.error('Error pinning wall post:', error);
      res.status(500).json({ message: error.message || 'Failed to pin wall post' });
    }
  });

  // ============================================
  // DOCUGENIE FORMS API
  // ============================================

  // Get all DocuGenie forms (for authenticated users)
  app.get("/api/docugenie/forms", requireAuth, async (req: Request, res: Response) => {
    try {
      const filters: { status?: string; createdById?: number } = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.createdById) filters.createdById = parseInt(req.query.createdById as string);
      
      const forms = await storage.getDocuGenieForms(filters);
      res.json(forms);
    } catch (error) {
      console.error('Error getting DocuGenie forms:', error);
      res.status(500).json({ message: 'Error retrieving forms' });
    }
  });

  // Get a single DocuGenie form by ID
  app.get("/api/docugenie/forms/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const form = await storage.getDocuGenieForm(id);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }
      res.json(form);
    } catch (error) {
      console.error('Error getting DocuGenie form:', error);
      res.status(500).json({ message: 'Error retrieving form' });
    }
  });

  // Get a form by share token (public access for form completion)
  app.get("/api/docugenie/share/:token", async (req: Request, res: Response) => {
    try {
      const form = await storage.getDocuGenieFormByToken(req.params.token);
      if (!form) {
        return res.status(404).json({ message: 'Form not found or link expired' });
      }
      if (form.status !== DocuGenieFormStatus.PUBLISHED) {
        return res.status(403).json({ message: 'This form is not available for submissions' });
      }
      if (form.expiresAt && new Date(form.expiresAt) < new Date()) {
        return res.status(410).json({ message: 'This form link has expired' });
      }
      res.json(form);
    } catch (error) {
      console.error('Error getting shared form:', error);
      res.status(500).json({ message: 'Error retrieving form' });
    }
  });

  // Create a new DocuGenie form
  app.post("/api/docugenie/forms", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const validated = insertDocuGenieFormSchema.parse({
        ...req.body,
        createdById: userId,
      });

      const form = await storage.createDocuGenieForm(validated);
      
      await storage.createAuditLog({
        action: AuditAction.CREATE,
        entityType: 'docugenie_form',
        entityId: form.id,
        userId,
        details: `Created DocuGenie form: ${form.title}`,
      });

      res.status(201).json(form);
    } catch (error) {
      console.error('Error creating DocuGenie form:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid form data', errors: error.errors });
      }
      res.status(500).json({ message: 'Error creating form' });
    }
  });

  // Update a DocuGenie form
  app.patch("/api/docugenie/forms/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      
      const existingForm = await storage.getDocuGenieForm(id);
      if (!existingForm) {
        return res.status(404).json({ message: 'Form not found' });
      }

      const updated = await storage.updateDocuGenieForm(id, req.body);
      
      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'docugenie_form',
        entityId: id,
        userId,
        details: `Updated DocuGenie form: ${updated.title}`,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating DocuGenie form:', error);
      res.status(500).json({ message: 'Error updating form' });
    }
  });

  // Publish a form (generate share token and set status to published)
  app.post("/api/docugenie/forms/:id/publish", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      
      const form = await storage.getDocuGenieForm(id);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }

      // Generate a unique share token
      const crypto = await import('crypto');
      const shareToken = crypto.randomBytes(16).toString('hex');

      const updated = await storage.updateDocuGenieForm(id, {
        status: DocuGenieFormStatus.PUBLISHED,
        shareToken,
        expiresAt: req.body.expiresAt || null,
      });

      await storage.createAuditLog({
        action: AuditAction.UPDATE,
        entityType: 'docugenie_form',
        entityId: id,
        userId,
        details: `Published DocuGenie form: ${form.title}`,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error publishing form:', error);
      res.status(500).json({ message: 'Error publishing form' });
    }
  });

  // Delete a DocuGenie form
  app.delete("/api/docugenie/forms/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      
      const form = await storage.getDocuGenieForm(id);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }

      await storage.deleteDocuGenieForm(id);
      
      await storage.createAuditLog({
        action: AuditAction.DELETE,
        entityType: 'docugenie_form',
        entityId: id,
        userId,
        details: `Deleted DocuGenie form: ${form.title}`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting DocuGenie form:', error);
      res.status(500).json({ message: 'Error deleting form' });
    }
  });

  // AI conversion endpoint - convert pasted content to HTML form
  app.post("/api/docugenie/convert", requireAuth, async (req: Request, res: Response) => {
    try {
      const { content, title } = req.body;
      if (!content) {
        return res.status(400).json({ message: 'Content is required' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at converting document/form content into clean, semantic HTML forms. 
            
Your task is to analyze the provided text content (which may be from a Google Doc, Google Form, or pasted text) and convert it into a well-structured HTML form.

Guidelines:
1. Identify form fields from the content (text inputs, textareas, checkboxes, radio buttons, select dropdowns, date inputs, file uploads)
2. Use semantic HTML5 form elements with proper labels
3. Add appropriate input types (text, email, tel, number, date, etc.)
4. Use Tailwind CSS classes for styling (the form will be rendered in a Tailwind-enabled environment)
5. Make required fields have the 'required' attribute based on context
6. Group related fields using fieldset and legend when appropriate
7. Add placeholder text where helpful
8. Preserve any instructions or help text as paragraph elements
9. Include a submit button at the end

Return ONLY the HTML form code (starting with <form> and ending with </form>), no explanation or markdown.
The form should have class="space-y-4 p-6" for proper spacing.
Input fields should have classes like "w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
Labels should have class "block text-sm font-medium mb-1"
Submit button should have class "w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"`
          },
          {
            role: "user",
            content: `Convert the following content into an HTML form:\n\n${title ? `Form Title: ${title}\n\n` : ''}${content}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const htmlForm = response.choices[0]?.message?.content?.trim() || '';
      
      // Extract form fields metadata for validation
      const fieldMatches = htmlForm.matchAll(/<(input|select|textarea)[^>]*name="([^"]+)"[^>]*>/gi);
      const formFields = Array.from(fieldMatches).map(match => ({
        type: match[1],
        name: match[2],
      }));

      res.json({ 
        htmlForm,
        formFields: JSON.stringify(formFields),
      });
    } catch (error) {
      console.error('Error converting content to form:', error);
      res.status(500).json({ message: 'Error converting content. Please try again.' });
    }
  });

  // Get form submissions
  app.get("/api/docugenie/forms/:id/submissions", requireAuth, async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id);
      const submissions = await storage.getDocuGenieFormSubmissions(formId);
      res.json(submissions);
    } catch (error) {
      console.error('Error getting submissions:', error);
      res.status(500).json({ message: 'Error retrieving submissions' });
    }
  });

  // Submit a form (public access via share token)
  app.post("/api/docugenie/submit/:token", async (req: Request, res: Response) => {
    try {
      const form = await storage.getDocuGenieFormByToken(req.params.token);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }
      if (form.status !== DocuGenieFormStatus.PUBLISHED) {
        return res.status(403).json({ message: 'This form is not accepting submissions' });
      }
      if (form.expiresAt && new Date(form.expiresAt) < new Date()) {
        return res.status(410).json({ message: 'This form link has expired' });
      }

      const { formData, submitterName, submitterEmail } = req.body;
      
      const submission = await storage.createDocuGenieFormSubmission({
        formId: form.id,
        formData: typeof formData === 'string' ? formData : JSON.stringify(formData),
        submitterName: submitterName || null,
        submitterEmail: submitterEmail || null,
        submittedById: (req as any).session?.userId || null,
      });

      // Notify form creator
      if (form.createdById) {
        await storage.createNotification({
          userId: form.createdById,
          title: 'New Form Submission',
          message: `Someone submitted the form: ${form.title}`,
          type: 'document_update',
          urgency: UrgencyLevel.NORMAL,
        });
      }

      res.status(201).json({ success: true, submissionId: submission.id });
    } catch (error) {
      console.error('Error submitting form:', error);
      res.status(500).json({ message: 'Error submitting form' });
    }
  });

  // ============================================
  // CRM - LEADS ROUTES
  // ============================================

  // Get all leads
  app.get("/api/leads", requireAuth, async (req: Request, res: Response) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Error fetching leads" });
    }
  });

  // Get single lead
  app.get("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const lead = await storage.getLead(parseInt(req.params.id));
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Error fetching lead" });
    }
  });

  // Create new lead
  app.post("/api/leads", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const validatedData = insertLeadSchema.parse({
        ...req.body,
        createdById: user.id,
        nextFollowUpDate: req.body.nextFollowUpDate ? new Date(req.body.nextFollowUpDate) : undefined,
      });

      const lead = await storage.createLead(validatedData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'lead',
        entityId: lead.id,
        newValue: `Created new lead: ${lead.leadName}`,
      });

      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message, field: error.errors[0].path[0] });
      }
      res.status(500).json({ message: "Error creating lead" });
    }
  });

  // Update lead
  app.put("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const leadId = parseInt(req.params.id);
      
      const existingLead = await storage.getLead(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const updateData = {
        ...req.body,
        nextFollowUpDate: req.body.nextFollowUpDate ? new Date(req.body.nextFollowUpDate) : undefined,
        updatedAt: new Date(),
      };

      const updatedLead = await storage.updateLead(leadId, updateData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'lead',
        entityId: leadId,
        newValue: `Updated lead: ${updatedLead?.leadName}`,
      });

      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Error updating lead" });
    }
  });

  // Delete lead
  app.delete("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const leadId = parseInt(req.params.id);
      
      const existingLead = await storage.getLead(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      await storage.deleteLead(leadId);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.DELETE,
        entityType: 'lead',
        entityId: leadId,
        newValue: `Deleted lead: ${existingLead.leadName}`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ message: "Error deleting lead" });
    }
  });

  // ============================================
  // CRM - LEAD STATUS HISTORY ROUTES
  // ============================================

  // Get lead status history
  app.get("/api/leads/:id/status-history", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const leadId = parseInt(req.params.id);
      const history = await storage.getLeadStatusHistory(leadId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching lead status history:", error);
      res.status(500).json({ message: "Error fetching status history" });
    }
  });

  // Update lead status with history tracking
  app.post("/api/leads/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const leadId = parseInt(req.params.id);
      const { newStatus, reason, evidenceUrl, evidenceFileName } = req.body;
      
      if (!newStatus || !(Object.values(LeadStatus) as string[]).includes(newStatus)) {
        return res.status(400).json({ message: "Choose a valid new status" });
      }
      if (typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ message: "Give a reason for the status change" });
      }
      
      const existingLead = await storage.getLead(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // The column is leadStatus (reading .status gave undefined, and writing status: was ignored)
      const previousStatus = existingLead.leadStatus;
      
      // Create status history entry
      await storage.createLeadStatusHistory({
        leadId,
        previousStatus,
        newStatus,
        reason: reason.trim(),
        evidenceUrl: evidenceUrl || null,
        evidenceFileName: evidenceFileName || null,
        changedById: user.id,
      });
      
      // Update the lead status
      const updatedLead = await storage.updateLead(leadId, { leadStatus: newStatus });
      
      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'lead',
        entityId: leadId,
        newValue: `Changed lead status from "${previousStatus}" to "${newStatus}" for: ${existingLead.leadName}`,
      });
      
      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead status:", error);
      res.status(500).json({ message: "Error updating lead status" });
    }
  });

  // ============================================
  // CRM - LEAD UPDATE REQUESTS ROUTES
  // ============================================

  // Get update requests for a lead
  app.get("/api/leads/:id/update-requests", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const leadId = parseInt(req.params.id);
      const requests = await storage.getLeadUpdateRequests(leadId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching lead update requests:", error);
      res.status(500).json({ message: "Error fetching update requests" });
    }
  });

  // Get pending update requests for current user
  app.get("/api/lead-update-requests/pending", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const requests = await storage.getPendingLeadUpdateRequests(user.id);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching pending update requests:", error);
      res.status(500).json({ message: "Error fetching pending update requests" });
    }
  });

  // Create update request (COO/CEO asking for update)
  app.post("/api/leads/:id/update-requests", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      // Only COO and Admin can request updates
      if (user.email !== 'coo@sahihcertify.com' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only COO and Admin can request updates" });
      }
      
      const leadId = parseInt(req.params.id);
      const { requestedFromId, message } = req.body;
      
      if (!requestedFromId || !message) {
        return res.status(400).json({ message: "requestedFromId and message are required" });
      }
      
      const existingLead = await storage.getLead(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      const updateRequest = await storage.createLeadUpdateRequest({
        leadId,
        requestedById: user.id,
        requestedFromId,
        message,
      });
      
      // Create notification for the assigned user
      await storage.createNotification({
        userId: requestedFromId,
        title: 'Lead Update Requested',
        message: `Update requested on lead: ${existingLead.leadName}. Message: ${message}`,
        type: 'warning',
      });
      
      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'lead_update_request',
        entityId: updateRequest.id,
        newValue: `Requested update on lead: ${existingLead.leadName}`,
      });
      
      res.json(updateRequest);
    } catch (error) {
      console.error("Error creating update request:", error);
      res.status(500).json({ message: "Error creating update request" });
    }
  });

  // Resolve an update request
  app.post("/api/lead-update-requests/:id/resolve", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const requestId = parseInt(req.params.id);
      
      const resolved = await storage.resolveLeadUpdateRequest(requestId);
      if (!resolved) {
        return res.status(404).json({ message: "Update request not found" });
      }
      
      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'lead_update_request',
        entityId: requestId,
        newValue: `Resolved lead update request`,
      });
      
      res.json(resolved);
    } catch (error) {
      console.error("Error resolving update request:", error);
      res.status(500).json({ message: "Error resolving update request" });
    }
  });

  // ============================================
  // CRM - CUSTOMERS ROUTES
  // ============================================

  // Get all customers
  app.get("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      // Only Admin, Quality Manager, or COO can access customers
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Error fetching customers" });
    }
  });

  // Get single customer
  app.get("/api/customers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      const customer = await storage.getCustomer(parseInt(req.params.id));
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Error fetching customer" });
    }
  });

  // Create new customer
  app.post("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertCustomerSchema.parse({
        ...req.body,
        createdById: user.id,
      });

      const customer = await storage.createCustomer(validatedData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'customer',
        entityId: customer.id,
        newValue: `Created new customer: ${customer.customerName}`,
      });

      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message, field: error.errors[0].path[0] });
      }
      res.status(500).json({ message: "Error creating customer" });
    }
  });

  // Update customer
  app.put("/api/customers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const customerId = parseInt(req.params.id);
      
      const existingCustomer = await storage.getCustomer(customerId);
      if (!existingCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const updatedCustomer = await storage.updateCustomer(customerId, updateData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'customer',
        entityId: customerId,
        newValue: `Updated customer: ${updatedCustomer?.customerName}`,
      });

      res.json(updatedCustomer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Error updating customer" });
    }
  });

  // Delete customer
  app.delete("/api/customers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const customerId = parseInt(req.params.id);
      
      const existingCustomer = await storage.getCustomer(customerId);
      if (!existingCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      await storage.deleteCustomer(customerId);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.DELETE,
        entityType: 'customer',
        entityId: customerId,
        newValue: `Deleted customer: ${existingCustomer.customerName}`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Error deleting customer" });
    }
  });

  // Upload contract file for customer
  app.post("/api/customers/:id/contract", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const customerId = parseInt(req.params.id);
      const { fileUrl, fileName } = req.body;
      
      const existingCustomer = await storage.getCustomer(customerId);
      if (!existingCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const updatedCustomer = await storage.updateCustomer(customerId, {
        contractFileUrl: fileUrl,
        contractFileName: fileName,
        updatedAt: new Date(),
      });

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'customer',
        entityId: customerId,
        newValue: `Uploaded contract file for customer: ${existingCustomer.customerName}`,
      });

      res.json(updatedCustomer);
    } catch (error) {
      console.error("Error uploading contract:", error);
      res.status(500).json({ message: "Error uploading contract" });
    }
  });

  // ============================================
  // CRM - OPPORTUNITIES ROUTES
  // ============================================

  // Get all opportunities
  app.get("/api/opportunities", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      const opportunities = await storage.getOpportunities();
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ message: "Error fetching opportunities" });
    }
  });

  // Get single opportunity
  app.get("/api/opportunities/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      const opportunity = await storage.getOpportunity(parseInt(req.params.id));
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      res.json(opportunity);
    } catch (error) {
      console.error("Error fetching opportunity:", error);
      res.status(500).json({ message: "Error fetching opportunity" });
    }
  });

  // Create new opportunity
  app.post("/api/opportunities", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const bodyData = {
        ...req.body,
        createdById: user.id,
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : undefined,
      };

      const validatedData = insertOpportunitySchema.parse(bodyData);

      const opportunity = await storage.createOpportunity(validatedData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'opportunity',
        entityId: opportunity.id,
        newValue: `Created new opportunity: ${opportunity.opportunityName}`,
      });

      res.status(201).json(opportunity);
    } catch (error) {
      console.error("Error creating opportunity:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message, field: error.errors[0].path[0] });
      }
      res.status(500).json({ message: "Error creating opportunity" });
    }
  });

  // Update opportunity
  app.put("/api/opportunities/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const opportunityId = parseInt(req.params.id);
      
      const existingOpportunity = await storage.getOpportunity(opportunityId);
      if (!existingOpportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : undefined,
      };

      const updatedOpportunity = await storage.updateOpportunity(opportunityId, updateData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'opportunity',
        entityId: opportunityId,
        newValue: `Updated opportunity: ${updatedOpportunity?.opportunityName}`,
      });

      res.json(updatedOpportunity);
    } catch (error) {
      console.error("Error updating opportunity:", error);
      res.status(500).json({ message: "Error updating opportunity" });
    }
  });

  // Delete opportunity
  app.delete("/api/opportunities/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const opportunityId = parseInt(req.params.id);
      
      const existingOpportunity = await storage.getOpportunity(opportunityId);
      if (!existingOpportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }

      await storage.deleteOpportunity(opportunityId);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.DELETE,
        entityType: 'opportunity',
        entityId: opportunityId,
        newValue: `Deleted opportunity: ${existingOpportunity.opportunityName}`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting opportunity:", error);
      res.status(500).json({ message: "Error deleting opportunity" });
    }
  });

  // Upload proposal file for opportunity
  app.post("/api/opportunities/:id/proposal", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const opportunityId = parseInt(req.params.id);
      const { fileUrl, fileName } = req.body;
      
      const existingOpportunity = await storage.getOpportunity(opportunityId);
      if (!existingOpportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }

      const updatedOpportunity = await storage.updateOpportunity(opportunityId, {
        proposalFileUrl: fileUrl,
        proposalFileName: fileName,
        updatedAt: new Date(),
      });

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'opportunity',
        entityId: opportunityId,
        newValue: `Uploaded proposal file for opportunity: ${existingOpportunity.opportunityName}`,
      });

      res.json(updatedOpportunity);
    } catch (error) {
      console.error("Error uploading proposal:", error);
      res.status(500).json({ message: "Error uploading proposal" });
    }
  });

  // ============================================
  // HISTORICAL PERFORMANCE DATA ROUTES
  // ============================================

  // Get all historical data
  app.get("/api/historical-data", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const data = await storage.getHistoricalData(year ? { year } : undefined);
      res.json(data);
    } catch (error) {
      console.error("Error fetching historical data:", error);
      res.status(500).json({ message: "Error fetching historical data" });
    }
  });

  // Get single historical data entry
  app.get("/api/historical-data/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }
      const entry = await storage.getHistoricalDataEntry(parseInt(req.params.id));
      if (!entry) {
        return res.status(404).json({ message: "Historical data entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error fetching historical data entry:", error);
      res.status(500).json({ message: "Error fetching historical data entry" });
    }
  });

  // Create historical data entry
  app.post("/api/historical-data", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertHistoricalDataSchema.parse({
        ...req.body,
        createdById: user.id,
      });

      const data = await storage.createHistoricalData(validatedData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'historical_data',
        entityId: data.id,
        newValue: `Created historical data entry for ${validatedData.month} ${validatedData.year}`,
      });

      res.status(201).json(data);
    } catch (error) {
      console.error("Error creating historical data:", error);
      res.status(500).json({ message: "Error creating historical data" });
    }
  });

  // Update historical data entry
  app.put("/api/historical-data/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const entryId = parseInt(req.params.id);
      
      const existingEntry = await storage.getHistoricalDataEntry(entryId);
      if (!existingEntry) {
        return res.status(404).json({ message: "Historical data entry not found" });
      }

      const validatedData = insertHistoricalDataSchema.partial().parse(req.body);
      const updatedEntry = await storage.updateHistoricalData(entryId, validatedData);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'historical_data',
        entityId: entryId,
        newValue: `Updated historical data entry for ${existingEntry.month} ${existingEntry.year}`,
      });

      res.json(updatedEntry);
    } catch (error) {
      console.error("Error updating historical data:", error);
      res.status(500).json({ message: "Error updating historical data" });
    }
  });

  // Delete historical data entry
  app.delete("/api/historical-data/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'quality_manager' && user.email !== 'coo@sahihcertify.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      const entryId = parseInt(req.params.id);
      
      const existingEntry = await storage.getHistoricalDataEntry(entryId);
      if (!existingEntry) {
        return res.status(404).json({ message: "Historical data entry not found" });
      }

      await storage.deleteHistoricalData(entryId);

      // Log audit trail
      await storage.createAuditLog({
        userId: user.id,
        action: AuditAction.DELETE,
        entityType: 'historical_data',
        entityId: entryId,
        newValue: `Deleted historical data entry for ${existingEntry.month} ${existingEntry.year}`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting historical data:", error);
      res.status(500).json({ message: "Error deleting historical data" });
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
