import { z } from 'zod';
import { 
  insertUserSchema, 
  insertDocumentSchema,
  users, 
  documents, 
  notifications,
  workflowLogs,
  auditLogs,
  UserRole,
  DocumentCategory,
  DocumentStatus,
  UrgencyLevel,
  InductionStatus,
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
        category: z.enum([DocumentCategory.POLICY, DocumentCategory.MANUAL, DocumentCategory.SOP, DocumentCategory.FORMAT]),
        content: z.string().optional(),
        fileUrl: z.string().optional(),
        nextReviewDate: z.string().optional(),
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
    // Workflow actions
    submitForReview: {
      method: 'POST' as const,
      path: '/api/documents/:id/submit-review',
      input: z.object({
        reviewerId: z.number(),
        comments: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    approve: {
      method: 'POST' as const,
      path: '/api/documents/:id/approve',
      input: z.object({
        comments: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    reject: {
      method: 'POST' as const,
      path: '/api/documents/:id/reject',
      input: z.object({
        comments: z.string().min(1),
      }),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    publish: {
      method: 'POST' as const,
      path: '/api/documents/:id/publish',
      input: z.object({
        comments: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    workflowHistory: {
      method: 'GET' as const,
      path: '/api/documents/:id/workflow',
      responses: {
        200: z.array(z.custom<typeof workflowLogs.$inferSelect>()),
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
export type SubmitForReviewInput = z.infer<typeof api.documents.submitForReview.input>;
export type ApproveInput = z.infer<typeof api.documents.approve.input>;
export type RejectInput = z.infer<typeof api.documents.reject.input>;
