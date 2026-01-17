# Sahih Certifications QMS

## Overview

A web-based Quality Management System (QMS) application for a Certification Body designed to digitize the certification lifecycle, document control, and compliance monitoring. Built for ISO 17021 compliance, ensuring audit-readiness for UKAS surveillance at all times.

**Core Purpose:** Document Control System with workflow management, user role-based access control, and comprehensive audit trail logging.

**Current Phase:** Phase 1 - Dashboard, User Management (RBAC), Document Control System, and HR Module.

## User Preferences

Preferred communication style: Simple, everyday language.

### Task Completion Tracking
After completing each task, generate a Task Completion Report using this format:

```
TASK COMPLETION NOTE

DATE: [Current Date]
TASK ASSIGNED: [Task Name]
ASSIGNED ON: [Date Assigned]
COMPLETED ON: [Date Completed]
NAME OF THE DOCUMENT: [File/Output Title]
ASSIGNED BY: [User]

POINTS EARNED:
> * (+1 POINT for on-time completion)
> * (-1 POINT for late completion)
```

Maintain a running tally of completed tasks and points.

## System Architecture

### Frontend Architecture
- **Framework:** React with TypeScript
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack React Query for server state
- **UI Components:** shadcn/ui component library built on Radix UI primitives
- **Styling:** Tailwind CSS with custom CSS variables for theming
- **Build Tool:** Vite with React plugin

### Backend Architecture
- **Framework:** Express.js with TypeScript
- **API Design:** RESTful endpoints defined in `shared/routes.ts` with Zod schema validation
- **Database ORM:** Drizzle ORM with PostgreSQL dialect
- **Session Management:** Express sessions with `connect-pg-simple` for PostgreSQL session storage

### Data Storage
- **Database:** PostgreSQL (configured via `DATABASE_URL` environment variable)
- **Schema Location:** `shared/schema.ts` using Drizzle table definitions
- **Migrations:** Drizzle Kit with output to `./migrations` directory

### Key Data Models
- **Users:** Role-based (Admin, Quality Manager, Department Head, Staff, Auditor) with induction status tracking
- **Documents:** Versioned with workflow states (Draft, In-Review, Pending Approval, Approved, Obsolete)
- **Workflow Logs:** Track document state transitions with comments
- **Audit Logs:** ISO 17021 compliant action logging (create, update, delete, approve, reject, assign_task, complete_task)
- **Notifications:** User alerts with urgency levels for compliance monitoring
- **Employees:** HR management with supervisor hierarchy, employment types (full_time, part_time, contract, probation), and status tracking (active, inactive, on_leave, terminated)
- **Employee Tasks:** Training and compliance task assignments linked to documents, with priority levels and due date tracking

### Document Workflow Engine
State machine for document lifecycle:
1. **Draft** → Staff creates document
2. **In-Review** → Submitted for departmental review
3. **Pending Approval** → Reviewer accepts, awaiting Quality Manager approval
4. **Approved** → Published with edition/revision increment, old versions archived
5. **Obsolete** → Archived documents

Rejection at any stage reverts document to Draft with comments.

### Edition/Revision Numbering
- Documents use Edition (Ed.) and Revision (Rev.) numbering instead of simple version numbers
- Revision number auto-increments by 1 on each approval
- Edition number remains constant unless manually incremented for major changes
- Version string format: "Ed.X Rev.Y" (e.g., Ed.1 Rev.3)

### PDF Generation (Puppeteer)
- PDF generation using Puppeteer for server-side HTML-to-PDF conversion
- PDFs include document header, content, and signature blocks
- Generated PDFs stored as base64 data URLs in the database
- "View Final Draft" button to view generated PDFs
- Download functionality for approved documents

### Download Permission System
- Documents can require admin approval before download
- Download request workflow with pending/approved/rejected states
- Admin/Quality Manager can approve or reject download requests
- Notifications sent when requests are submitted or decided
- Full audit trail for download request actions

### Signatory System
- Three signatory roles: Prepared By, Reviewed By, Approved By
- User selection dropdowns for each signatory role
- Signature blocks displayed in document preview
- Timestamps recorded when each signatory signs

### Compliance Monitoring
- Automated alerts when document review dates approach (yellow: <30 days, red: overdue)
- Dashboard displays compliance health metrics
- All actions logged with timestamp and user ID for audit trail

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components and layout
│   │   ├── hooks/        # React Query hooks for API calls
│   │   ├── pages/        # Page components (Dashboard, Documents, Users, etc.)
│   │   └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts     # API endpoint definitions
│   ├── storage.ts    # Database operations layer
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Drizzle database schema and enums
│   └── routes.ts     # API route definitions with Zod schemas
└── migrations/       # Drizzle database migrations
```

## External Dependencies

### Database
- **PostgreSQL:** Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM:** Database toolkit for TypeScript with type-safe queries

### UI Framework
- **Radix UI:** Accessible component primitives (dialogs, dropdowns, forms, etc.)
- **shadcn/ui:** Pre-styled component collection using Radix + Tailwind

### Data Visualization
- **Recharts:** Dashboard analytics and compliance charts

### Date Handling
- **date-fns:** Date formatting and manipulation for review dates and audit timestamps

### Form Handling
- **react-hook-form:** Form state management
- **@hookform/resolvers:** Zod integration for form validation
- **Zod:** Schema validation for API requests and responses

### Build & Development
- **Vite:** Frontend build tool with HMR
- **esbuild:** Server bundling for production
- **tsx:** TypeScript execution for development

### Gmail OAuth Integration
Per-user Gmail OAuth integration allows each team member to connect their Google Workspace email directly through the web app.

**Email System Priority:**
1. **OAuth (per-user)** - Individual Gmail connections with full send/receive
2. **SMTP (company-wide)** - Fallback using GMAIL_USER and GMAIL_APP_PASSWORD secrets
3. **Replit Connector** - Built-in email integration

**OAuth Configuration:**
- Admin must configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Replit Secrets
- OAuth callback URL: `/api/gmail/callback`
- Tokens stored per-user with automatic refresh using refresh_token

**User Token Storage (users table):**
- `gmail_access_token` - OAuth access token
- `gmail_refresh_token` - OAuth refresh token for auto-renewal
- `gmail_token_expiry` - Token expiration timestamp
- `gmail_connected_at` - When OAuth was connected

**Key Files:**
- `server/gmail-oauth.ts` - OAuth service with token management
- `client/src/hooks/use-gmail.ts` - React hooks for Gmail operations
- `client/src/pages/Email.tsx` - Email UI with Connect/Disconnect functionality

### Dashboard Time Display
Dashboard shows both user's local time and Qatar Standard Time (AST, UTC+3) for international team coordination.

### Bug Report Evidence Attachments
When resolving bug reports, Admin and COO can attach evidence screenshots to demonstrate the fix:
- **Resolution Form:** Includes optional image upload for evidence
- **Storage:** Uses Replit Object Storage for secure file hosting
- **Display:** Evidence images shown in resolution notes section
- **Key Files:**
  - `client/src/pages/BugReports.tsx` - Bug reports UI with evidence upload
  - `server/replit_integrations/object_storage/` - Object storage service
  - `client/src/hooks/use-upload.ts` - File upload hook

### Training and Assessment Module
Complete training management system for employee competency development:
- **Database Tables:** `trainings`, `training_assignments`, `training_completions`
- **Training Types:** Internal, External, Online, On-the-Job, Workshop, Certification
- **Assignment Workflow:** Create training → Assign to employees → Track completion
- **Completion Certificates:** Auto-generated certificate numbers (TC-YYYY-#####)
- **Validity Periods:** Optional expiry tracking based on validity period
- **Notifications:** Automatic alerts to assigned employees
- **Access Control:** Admin, Quality Manager, and HR (hr@sahihcertify.com)
- **Key Files:**
  - `client/src/pages/Trainings.tsx` - Training management UI
  - `shared/schema.ts` - Training database schema
  - `server/routes.ts` - Training API endpoints

## Recent Changes

### January 17, 2026
- **Fixed:** Edition number save issue - Document update endpoint now properly saves `editionNumber` and `revisionNumber` changes (was missing from update handler)