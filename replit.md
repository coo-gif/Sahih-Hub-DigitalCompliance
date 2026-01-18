# Sahih Certifications QMS

## Overview

Sahih Certifications QMS is a web-based Quality Management System (QMS) designed to digitize the entire certification lifecycle for a Certification Body. Its primary purpose is to provide a robust Document Control System with workflow management, role-based access, and comprehensive audit trails, ensuring ISO 17021 compliance and audit-readiness for UKAS surveillance. The project aims to streamline document management, enhance compliance monitoring, and improve operational efficiency.

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
- **Routing:** Wouter
- **State Management:** TanStack React Query
- **UI Components:** shadcn/ui (built on Radix UI primitives)
- **Styling:** Tailwind CSS with custom CSS variables
- **Build Tool:** Vite

### Backend Architecture
- **Framework:** Express.js with TypeScript
- **API Design:** RESTful endpoints with Zod schema validation
- **Database ORM:** Drizzle ORM with PostgreSQL dialect
- **Session Management:** Express sessions with `connect-pg-simple`

### Data Storage
- **Database:** PostgreSQL
- **Schema:** Defined in `shared/schema.ts` using Drizzle
- **Migrations:** Drizzle Kit

### Key Data Models
- **Users:** Role-based (Admin, Quality Manager, Department Head, Staff, Auditor)
- **Documents:** Versioned with states (Draft, In-Review, Pending Approval, Approved, Obsolete), Edition/Revision numbering (Ed.X Rev.Y)
- **Workflow Logs:** Document state transitions
- **Audit Logs:** ISO 17021 compliant action logging
- **Notifications:** User alerts for compliance
- **Employees:** HR management with supervisor hierarchy and employment status
- **Employee Tasks:** Training and compliance tasks
- **Trainings:** Manages training types, assignments, completions, and certificates.
- **DocuGenie Forms:** AI-generated HTML forms and submissions.
- **CRM Leads:** Tracks sales leads with various attributes and statuses.
- **CRM Customers:** Manages customer accounts with contact info, industry, account owners, communication history, and contract file uploads.
- **CRM Opportunities:** Sales pipeline tracking with customer lookup, course/certification selection, deal value, discount, expected close date, stage management (Qualified → Proposal Sent → Negotiation → Won/Lost), and proposal file uploads.

### Core Features
- **Document Workflow Engine:** State machine for document lifecycle (Draft -> In-Review -> Pending Approval -> Approved / Obsolete).
- **PDF Generation:** Server-side HTML-to-PDF conversion using Puppeteer for official documents.
- **Download Permission System:** Admin-approved download requests with audit trails.
- **Signatory System:** Three roles (Prepared By, Reviewed By, Approved By) with timestamps.
- **Compliance Monitoring:** Automated alerts for document review dates and dashboard metrics.
- **Gmail OAuth Integration:** Per-user OAuth for sending/receiving emails, with SMTP and Replit Connector fallbacks.
- **Dashboard Time Display:** Shows user's local time and Qatar Standard Time.
- **Bug Report Evidence Attachments:** Admins/COOs can attach screenshots to bug resolutions via Replit Object Storage.
- **User Agreement System:** Mandatory acceptance of terms, confidentiality, and security policies on first login (ISO 27001 compliant).
- **Document Editor Find & Replace:** In-editor search and mass amendment functionality.
- **Lock and Transfer to Document Hub:** Post-approval archiving with granular access control.
- **DocuGenie - AI-Powered Form Conversion System:** Converts documents into embeddable HTML forms, supports public submissions and tracking.
- **CRM - Leads Management:** Comprehensive lead tracking, qualification, and assignment for sales.
- **CRM - Customers Management:** Customer account management with contract uploads, account owner assignment, communication history logging, and industry tracking.
- **CRM - Opportunities Management:** Sales pipeline with dashboard stats (total pipeline value, qualified leads, proposals sent, won/lost deals), customer linking, ISO certification/training course selection, deal value and discount tracking, expected close dates, stage progression, notes, and proposal document upload/download.

### Project Structure
- `client/`: React frontend
- `server/`: Express backend
- `shared/`: Shared code (schema, routes)
- `migrations/`: Drizzle database migrations

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **UI Framework:** Radix UI, shadcn/ui
- **Data Visualization:** Recharts
- **Date Handling:** date-fns
- **Form Handling:** react-hook-form, @hookform/resolvers, Zod
- **Build & Development:** Vite, esbuild, tsx
- **PDF Generation:** Puppeteer
- **Email:** Gmail OAuth API, SMTP, Replit Connector
- **Cloud Storage:** Replit Object Storage (for bug report attachments)