# Sahih Certifications QMS

## Overview

A web-based Quality Management System (QMS) application for a Certification Body designed to digitize the certification lifecycle, document control, and compliance monitoring. Built for ISO 17021 compliance, ensuring audit-readiness for UKAS surveillance at all times.

**Core Purpose:** Document Control System with workflow management, user role-based access control, and comprehensive audit trail logging.

**Current Phase:** Phase 1 - Dashboard, User Management (RBAC), Document Control System, and HR Module.

## User Preferences

Preferred communication style: Simple, everyday language.

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
4. **Approved** → Published with version increment, old versions archived
5. **Obsolete** → Archived documents

Rejection at any stage reverts document to Draft with comments.

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