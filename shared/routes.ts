import { z } from 'zod';
import { 
  insertUserSchema, 
  insertDocumentSchema,
  users, 
  documents, 
  notifications,
  workflowLogs,
  auditLogs,
  employees,
  employeeTasks,
  documentAccessRequests,
  documentAccess,
  leads,
  UserRole,
  DocumentCategory,
  DocumentStatus,
  UrgencyLevel,
  InductionStatus,
  EmploymentType,
  EmployeeStatus,
  EmployeeRecordStatus,
  TaskStatus,
  TaskPriority,
  LeadSource,
  LeadStatus,
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  forbidden: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// DASHBOARD SCHEMAS
// ============================================
const dashboardStatsSchema = z.object({
  totalDocuments: z.number(),
  approvedDocuments: z.number(),
  pendingApprovals: z.number(),
  expiringDocuments: z.number(),
  nonCompliantDocuments: z.number(),
  totalUsers: z.number(),
  pendingInductions: z.number(),
});

const complianceAlertSchema = z.object({
  id: z.number(),
  documentCode: z.string(),
  title: z.string(),
  nextReviewDate: z.string().nullable(),
  daysUntilExpiry: z.number(),
  alertLevel: z.enum(['yellow', 'red']),
});

// ============================================
// USER RESPONSE SCHEMA (without password)
// ============================================
const userResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  inductionStatus: z.string(),
  isActive: z.boolean().nullable(),
  dateJoined: z.string().nullable(),
  lastLogin: z.string().nullable(),
});

// ============================================
// API CONTRACT
// ============================================
export const api = {
  // Dashboard
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats',
      responses: {
        200: dashboardStatsSchema,
      },
    },
    alerts: {
      method: 'GET' as const,
      path: '/api/dashboard/alerts',
      responses: {
        200: z.array(complianceAlertSchema),
      },
    },
    recentActivity: {
      method: 'GET' as const,
      path: '/api/dashboard/activity',
      responses: {
        200: z.array(z.custom<typeof auditLogs.$inferSelect>()),
      },
    },
  },

  // Users
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(userResponseSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: userResponseSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum([UserRole.ADMIN, UserRole.QUALITY_MANAGER, UserRole.DEPARTMENT_HEAD, UserRole.STAFF, UserRole.AUDITOR]),
      }),
      responses: {
        201: userResponseSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:id',
      input: z.object({
        name: z.string().min(1).optional(),
        role: z.enum([UserRole.ADMIN, UserRole.QUALITY_MANAGER, UserRole.DEPARTMENT_HEAD, UserRole.STAFF, UserRole.AUDITOR]).optional(),
        inductionStatus: z.enum([InductionStatus.PENDING, InductionStatus.COMPLETED]).optional(),
        isActive: z.boolean().optional(),
      }),
      responses: {
        200: userResponseSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    updateSignature: {
      method: 'PUT' as const,
      path: '/api/users/:id/signature',
      input: z.object({
        signatureDataUrl: z.string().nullable(),
      }),
      responses: {
        200: userResponseSchema,
        404: errorSchemas.notFound,
      },
    },
  },

  // Documents
  documents: {
    list: {
      method: 'GET' as const,
      path: '/api/documents',
      input: z.object({
        status: z.string().optional(),
        category: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof documents.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/documents/:id',
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/documents',
      input: z.object({
        documentCode: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.enum([DocumentCategory.POLICY, DocumentCategory.MANUAL, DocumentCategory.SOP, DocumentCategory.FORMAT, DocumentCategory.JOB_DESCRIPTION, DocumentCategory.TRAINING_ASSESSMENT]),
        content: z.string().optional(),
        fileUrl: z.string().optional(),
        nextReviewDate: z.string().optional(),
        requiresPreparedBy: z.boolean().optional(),
        requiresReviewedBy: z.boolean().optional(),
        requiresApprovedBy: z.boolean().optional(),
        preparedById: z.number().optional(),
        reviewedById: z.number().optional(),
        approvedById: z.number().optional(),
        reviewerId: z.number().optional(),
        status: z.enum([DocumentStatus.DRAFT, DocumentStatus.IN_REVIEW, DocumentStatus.PENDING_APPROVAL, DocumentStatus.APPROVED, DocumentStatus.OBSOLETE]).optional(),
        assignedStaffIds: z.array(z.number()).optional(),
        assignedDepartments: z.array(z.string()).optional(),
      }),
      responses: {
        201: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/documents/:id',
      input: z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        fileUrl: z.string().optional(),
        nextReviewDate: z.string().optional(),
        editionNumber: z.number().optional(),
        revisionNumber: z.number().optional(),
        requiresPreparedBy: z.boolean().optional(),
        requiresReviewedBy: z.boolean().optional(),
        requiresApprovedBy: z.boolean().optional(),
        preparedById: z.number().optional(),
        reviewedById: z.number().optional(),
        approvedById: z.number().optional(),
      }),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/documents/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    submitForReview: {
      method: 'POST' as const,
      path: '/api/documents/:id/submit-review',
      input: z.object({
        reviewerId: z.number(),
        approverId: z.number().optional(),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },

  // Notifications
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications',
      responses: {
        200: z.array(z.custom<typeof notifications.$inferSelect>()),
      },
    },
    markRead: {
      method: 'PUT' as const,
      path: '/api/notifications/:id/read',
      responses: {
        200: z.custom<typeof notifications.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    markAllRead: {
      method: 'PUT' as const,
      path: '/api/notifications/read-all',
      responses: {
        200: z.object({ count: z.number() }),
      },
    },
  },

  // Audit Logs
  auditLogs: {
    list: {
      method: 'GET' as const,
      path: '/api/audit-logs',
      responses: {
        200: z.array(z.custom<typeof auditLogs.$inferSelect>()),
      },
    },
  },


  // Employees (HR)
  employees: {
    list: {
      method: 'GET' as const,
      path: '/api/employees',
      responses: {
        200: z.array(z.custom<typeof employees.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/employees/:id',
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees',
      input: z.object({
        employeeNumber: z.string().min(1),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        jobTitle: z.string().min(1),
        department: z.string().min(1),
        employmentType: z.enum([EmploymentType.FULL_TIME, EmploymentType.PART_TIME, EmploymentType.CONTRACT, EmploymentType.PROBATION]),
        supervisorId: z.number().nullable().optional(),
        hireDate: z.string(),
        status: z.enum([EmployeeStatus.ACTIVE, EmployeeStatus.INACTIVE, EmployeeStatus.ON_LEAVE, EmployeeStatus.TERMINATED]).optional(),
      }),
      responses: {
        201: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/employees/:id',
      input: z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        jobTitle: z.string().min(1).optional(),
        department: z.string().min(1).optional(),
        employmentType: z.enum([EmploymentType.FULL_TIME, EmploymentType.PART_TIME, EmploymentType.CONTRACT, EmploymentType.PROBATION]).optional(),
        supervisorId: z.number().nullable().optional(),
        status: z.enum([EmployeeStatus.ACTIVE, EmployeeStatus.INACTIVE, EmployeeStatus.ON_LEAVE, EmployeeStatus.TERMINATED]).optional(),
      }),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/employees/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    submitForReview: {
      method: 'POST' as const,
      path: '/api/employees/:id/submit-review',
      input: z.object({
        reviewerId: z.number(),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    submitForApproval: {
      method: 'POST' as const,
      path: '/api/employees/:id/submit-approval',
      input: z.object({
        approverId: z.number(),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    approve: {
      method: 'POST' as const,
      path: '/api/employees/:id/approve',
      input: z.object({
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    reject: {
      method: 'POST' as const,
      path: '/api/employees/:id/reject',
      input: z.object({
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    reassign: {
      method: 'POST' as const,
      path: '/api/employees/:id/reassign',
      input: z.object({
        taskType: z.enum(['employee_review', 'employee_approve']),
        newAssigneeId: z.number(),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },

  // Employee Tasks (HR)
  employeeTasks: {
    list: {
      method: 'GET' as const,
      path: '/api/employee-tasks',
      responses: {
        200: z.array(z.custom<typeof employeeTasks.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/employee-tasks/:id',
      responses: {
        200: z.custom<typeof employeeTasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employee-tasks',
      input: z.object({
        employeeId: z.number(),
        documentId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        priority: z.enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.CRITICAL]).optional(),
        notes: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof employeeTasks.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/employee-tasks/:id',
      input: z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        priority: z.enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.CRITICAL]).optional(),
        status: z.enum([TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELLED]).optional(),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof employeeTasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/employee-tasks/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    complete: {
      method: 'POST' as const,
      path: '/api/employee-tasks/:id/complete',
      responses: {
        200: z.custom<typeof employeeTasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Document Access Control
  documentAccessRequests: {
    list: {
      method: 'GET' as const,
      path: '/api/document-access-requests',
      responses: {
        200: z.array(z.custom<typeof documentAccessRequests.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/document-access-requests/:id',
      responses: {
        200: z.custom<typeof documentAccessRequests.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/document-access-requests',
      input: z.object({
        documentId: z.number(),
        requestReason: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof documentAccessRequests.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    approve: {
      method: 'POST' as const,
      path: '/api/document-access-requests/:id/approve',
      input: z.object({
        decisionNote: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof documentAccessRequests.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    reject: {
      method: 'POST' as const,
      path: '/api/document-access-requests/:id/reject',
      input: z.object({
        decisionNote: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof documentAccessRequests.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  documentAccess: {
    list: {
      method: 'GET' as const,
      path: '/api/document-access',
      responses: {
        200: z.array(z.custom<typeof documentAccess.$inferSelect>()),
      },
    },
    check: {
      method: 'GET' as const,
      path: '/api/documents/:id/access',
      responses: {
        200: z.object({ hasAccess: z.boolean() }),
      },
    },
    grant: {
      method: 'POST' as const,
      path: '/api/documents/:id/grant-access',
      input: z.object({
        userId: z.number(),
      }),
      responses: {
        201: z.custom<typeof documentAccess.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    grantMultiple: {
      method: 'POST' as const,
      path: '/api/documents/:id/grant-access-multiple',
      input: z.object({
        userIds: z.array(z.number()).min(1),
      }),
      responses: {
        201: z.object({ 
          granted: z.number(),
          results: z.array(z.custom<typeof documentAccess.$inferSelect>()),
        }),
        400: errorSchemas.validation,
      },
    },
    revoke: {
      method: 'POST' as const,
      path: '/api/documents/:id/revoke-access',
      input: z.object({
        userId: z.number(),
      }),
      responses: {
        200: z.custom<typeof documentAccess.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // CRM - Leads
  leads: {
    list: {
      method: 'GET' as const,
      path: '/api/leads',
      input: z.object({
        status: z.string().optional(),
        assignedToId: z.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof leads.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/leads/:id',
      responses: {
        200: z.custom<typeof leads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/leads',
      input: z.object({
        leadName: z.string().min(1),
        companyName: z.string().optional(),
        phoneEmail: z.string().optional(),
        leadSource: z.enum(['website', 'referral', 'ads', 'whatsapp']),
        interestedCourse: z.string().optional(),
        leadStatus: z.enum(['new', 'contacted', 'qualified', 'not_interested']).optional(),
        assignedToId: z.number().optional(),
        nextFollowUpDate: z.string().optional(),
        notes: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof leads.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/leads/:id',
      input: z.object({
        leadName: z.string().min(1).optional(),
        companyName: z.string().optional(),
        phoneEmail: z.string().optional(),
        leadSource: z.enum(['website', 'referral', 'ads', 'whatsapp']).optional(),
        interestedCourse: z.string().optional(),
        leadStatus: z.enum(['new', 'contacted', 'qualified', 'not_interested']).optional(),
        assignedToId: z.number().optional(),
        nextFollowUpDate: z.string().optional(),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof leads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/leads/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
  },
};

// ============================================
// URL BUILDER HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPE EXPORTS
// ============================================
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type ComplianceAlert = z.infer<typeof complianceAlertSchema>;
export type UserInput = z.infer<typeof api.users.create.input>;
export type UserUpdateInput = z.infer<typeof api.users.update.input>;
export type DocumentInput = z.infer<typeof api.documents.create.input>;
export type DocumentUpdateInput = z.infer<typeof api.documents.update.input>;
export type EmployeeInput = z.infer<typeof api.employees.create.input>;
export type EmployeeUpdateInput = z.infer<typeof api.employees.update.input>;
export type EmployeeTaskInput = z.infer<typeof api.employeeTasks.create.input>;
export type EmployeeTaskUpdateInput = z.infer<typeof api.employeeTasks.update.input>;
export type LeadInput = z.infer<typeof api.leads.create.input>;
export type LeadUpdateInput = z.infer<typeof api.leads.update.input>;
