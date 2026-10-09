# Sahih Hub – Digital Compliance: Task Breakdown

What the system is: a web-based Quality Management System (QMS) for Sahih Certifications, an ISO 17021 certification body.
It is one Express + PostgreSQL (Drizzle) backend (`server/routes.ts`, `server/storage.ts`) and a React/Vite frontend (`client/src/pages/*`).
The table definitions are in `shared/schema.ts`.

This document splits the code into **Modules (Tasks) → Sub-tasks → Steps**. Every sub-task is the smallest unit that still makes a **complete operational cycle**, meaning it starts with a trigger and ends with stored data plus visible output. Each one is written as `Step 1 ---> Step 2 ---> …`.

Roles used throughout: `admin`, `quality_manager` (QM), `department_head`, `staff`, `auditor`. Some powers are tied to fixed email addresses instead of roles: **COO** = `coo@sahihcertify.com`, **CEO** = `ceo@sahihcertify.com`, **HR** = `hr@sahihcertify.com`.

---

## TASK 0 – Platform Foundation (runs before everything else)

### 0.1 Server boot
Step 1: `npm run dev` starts `server/index.ts` --->
Step 2: The Postgres session store is set up (`user_sessions` table, 24 h cookie) --->
Step 3: `initializeDefaultUsers()` creates or re-sets the HR, COO and CEO admin accounts --->
Step 4: `registerRoutes()` mounts the object-storage upload routes and every `/api/*` route --->
Step 5: Vite (dev) or static files (prod) are served on port 5000.

### 0.2 Database schema
Step 1: Tables are defined in `shared/schema.ts` --->
Step 2: `npm run db:push` (drizzle-kit) creates them in Postgres --->
Step 3: Zod insert schemas, built with drizzle-zod, check API input.

### 0.3 File upload (shared service)
Step 1: The client asks for a signed URL with `POST /api/uploads/request-url` --->
Step 2: The browser uploads straight to Replit Object Storage (Uppy / `use-upload.ts`) --->
Step 3: The stored file is served through `GET /objects/:path`.

---

## TASK 1 – Identity & Access

### 1.1 Login
Step 1: App opens → `GET /api/auth/me` returns 401 --->
Step 2: The Login page is shown --->
Step 3: The user enters email and password → `POST /api/auth/login` --->
Step 4: Server checks the password with bcrypt and confirms `isActive` --->
Step 5: `session.userId` is set, and `lastLogin` and activity are updated --->
Step 6: The client calls `/me` again → the Layout and Dashboard load.

### 1.2 First-login user agreement (ISO 27001)
Step 1: `agreementAcceptedAt` is empty → `UserAgreementModal` blocks the app --->
Step 2: The user reads and accepts the terms, confidentiality and security policy --->
Step 3: `POST /api/auth/accept-agreement` --->
Step 4: The timestamp is saved and an audit-log entry is written --->
Step 5: The modal closes and the app can be used.

### 1.3 Activity / online-hours tracking
Step 1: Login → `POST /api/activity/start-session` --->
Step 2: The client sends `session-heartbeat` / `heartbeat` on a timer --->
Step 3: Logout or tab close → `end-session` --->
Step 4: `user_activity_logs` adds up the active minutes, which feed Task 7.3 (monthly report).

### 1.4 Logout
Step 1: The user clicks Logout → `POST /api/auth/logout` --->
Step 2: The session is destroyed and the cookie cleared --->
Step 3: The React Query cache is cleared → the Login page shows.

### 1.5 User management (Users page)
Step 1: Admin opens `/users` → `GET /api/users` --->
Step 2: Creates a user with name, email, password, role and designation → `POST /api/users` (password is hashed) --->
Step 3: Audit log is written --->
Step 4: Edits role, deactivates or deletes the user (`PUT` / `DELETE /api/users/:id`) --->
Step 5: The user uploads a signature → `PUT /api/users/:id/signature`. This signature is later stamped on every PDF report.

---

## TASK 2 – Document Control (core QMS cycle)

Document lifecycle: **Draft → In Review → Pending Approval → Approved (locked) → Document Hub**. Version is shown as `Ed.X Rev.Y`.

### 2.1 Create a draft document
Step 1: `/documents/new` → enter code (e.g. SOP-001), title, category (policy/manual/sop/format/JD/training assessment) and importance --->
Step 2: Write the content in the Tiptap editor (tables, images, links) --->
Step 3: Choose the signatories (Prepared by / Reviewed by / Approved by), assigned staff or departments, and the next review date --->
Step 4: `POST /api/documents` → status `draft` (the code must be unique) --->
Step 5: Workflow log, audit log and live performance stat (`document_created`) are written --->
Step 6: The document appears in the `/documents` list.

### 2.2 Edit a draft
Step 1: `/documents/:id/edit` loads the document --->
Step 2: Edit content, or use Find & Replace, or **AI Rewrite** (`/api/ai/rewrite`) / **AI Review** (`/api/ai/review-document`) --->
Step 3: `PUT /api/documents/:id`. This is refused if `isLocked` --->
Step 4: Audit log records the previous and new values.

### 2.3 Preparer confirmation (Prepared-by signature)
Step 1: The assigned preparer opens the draft --->
Step 2: Clicks Confirm Preparation → `POST /api/documents/:id/confirm-preparation` --->
Step 3: `preparerConfirmedAt` / `preparedBySignedAt` are stamped → audit log.

### 2.4 Submit for review
Step 1: The author picks a reviewer (and optionally an approver) on the Documents page --->
Step 2: `POST /api/documents/:id/submit-review` (allowed only from `draft`) --->
Step 3: Status becomes `in_review` --->
Step 4: The reviewer gets a notification → audit log.

### 2.5 Review
Step 1: The reviewer sees a "review" task on Dashboard / My Tasks. These tasks are built on the fly by `GET /api/my-tasks` from document fields --->
Step 2: Opens the document and optionally adds feedback (Task 2.6) --->
Step 3: Completes the review, optionally choosing a new approver → `POST /api/my-tasks/:docId/complete {taskType:"review"}` --->
Step 4: Status becomes `pending_approval` → the approver is notified --->
Step 5: Audit log and live stat (`document_reviewed`).

### 2.6 Inline comments with @mentions
Step 1: Anyone who can view a document that isn't locked selects text in the editor, right-clicks and chooses **Comment**. This also works when the document is read-only --->
Step 2: Typing `@` lists users. Picking one inserts `@Name` and assigns the comment to them. Several users can be mentioned --->
Step 3: `POST /api/documents/:id/comments` stores the comment with the quoted text, its position, the assignees and the workflow stage. The document content itself is not changed --->
Step 4: Mentioned users are notified and get a "Comment Assigned" task in My Tasks --->
Step 5: The commented text is highlighted in the editor, and the Comments panel lists Open, Assigned-to-me and Resolved comments --->
Step 6: The author, an assignee, an admin, the QM or the COO resolves the comment (`POST /api/document-comments/:id/resolve`). The author is notified. Open comments can be deleted only by their author.

### 2.6a Return for revision (one step back)
Step 1: The person currently responsible opens the document. That is the reviewer (In Review), the approver (Pending Approval) or the COO (awaiting final approval in the Hub). A **Comment / Return** button is on their task in My Tasks, in the Dashboard task pop-up, in the Documents list menu, and in the Hub for the COO --->
Step 2: They add at least one comment in the document explaining the reason (2.6). Returning is refused without one --->
Step 3: They click **Return for Revision**, optionally add an overall note → `POST /api/documents/:id/return` --->
Step 4: The document goes back one step and the signature for that step is cleared:
  - reviewer → **Draft**, back to the preparer (or the creator if no preparer is set)
  - approver → **In Review**, back to the reviewer
  - COO → **Pending Approval**, back to the approver (the document leaves the Hub queue) --->
Step 5: The person it goes back to is notified. A returned draft appears as a "Returned for Revision" task, and the document shows a banner with who returned it, when, the note and the open-comment count --->
Step 6: A workflow log and an audit entry (`return_for_revision`) are written. When the document moves forward again, the return banner clears.

### 2.7 Approve (moves the document to the Document Hub)
Step 1: The approver opens the "approve" task --->
Step 2: `POST /api/my-tasks/:docId/complete {taskType:"approve"}` --->
Step 3: Status becomes `approved` and the approver's signature is stamped. The document is **not locked yet**. It moves to the Document Hub with `hubStatus = pending_coo_approval` and can no longer be edited --->
Step 4: The COO is notified that a document is awaiting final approval --->
Step 5: Puppeteer creates the **Document Approval Report** PDF with signatures and report number `DAR-YYYY-NNN` --->
Step 6: The PDF is saved to User Records for every admin and for the creator, and each of them is notified --->
Step 7: Live stat (`document_approved`).

### 2.8 COO final approval & storage in the Sahih Hub
Step 1: The COO opens `/document-hub` → "Awaiting Final Approval" tab. The Documents list also shows an "Awaiting COO final approval" badge --->
Step 2: The COO views the document, then clicks Approve & Store --->
Step 3: The COO picks a classification: **Confidential**, **Controlled Copy**, **Public Information** or **Legal**. For any classification except public, the COO can also choose who gets access --->
Step 4: `POST /api/documents/:id/hub-approve` (COO only). The document is locked, `hubStatus = stored`, and the classification, COO and timestamp are recorded --->
Step 5: Access is granted to the chosen users. They, the creator and the approver are notified, and an audit log entry is written --->
Step 6: The document appears in the Hub master list with its classification. Public Information documents can be read by every signed-in user. The other three classifications can be read only by people granted access. The COO can change the classification later (`POST /api/documents/:id/classification`).

### 2.9 Reassign a workflow step
Step 1: The current assignee, an admin or the QM opens the task --->
Step 2: Chooses a new preparer, reviewer or approver and gives a reason → `POST /api/documents/:id/reassign` --->
Step 3: The document field is updated → the new assignee is notified → audit log.

### 2.10 Official PDF generation
Step 1: An allowed user (COO, a workflow member, or someone granted access) clicks Generate PDF --->
Step 2: `POST /api/documents/:id/generate-pdf` (full) or `/generate-pdf-light` --->
Step 3: Puppeteer renders the HTML with logo, header, signatories and Ed/Rev → `finalPdfUrl` is saved --->
Step 4: `GET /api/documents/:id/pdf` returns the PDF for viewing or download.

### 2.11 Revision (amendment) history
Step 1: A user adds an amendment entry with description, reason and signatories → `POST /api/documents/:id/revision-history` (status `pending`) --->
Step 2: The entry is reviewed --->
Step 3: `PATCH /api/revision-history/:id {status:"approved"}` --->
Step 4: The next revision number is assigned and the document's `revisionNumber` goes up (Ed.X Rev.Y+1).

### 2.12 Compliance monitoring (review-due alerts)
Step 1: Approved documents carry a `nextReviewDate` --->
Step 2: The Dashboard calls `/api/dashboard/stats` and `/api/dashboard/alerts` --->
Step 3: The server sorts the documents into yellow (due within 30 days) and red (overdue / non-compliant) --->
Step 4: The Dashboard shows the counters and the alert list.

---

## TASK 3 – Document Hub & Access Control

### 3.1 Request access to a restricted document
Step 1: A non-member opens the list. Approved or locked documents come back with metadata only (content, file and PDF stripped) --->
Step 2: The user clicks Request Access and gives a reason → `POST /api/document-access-requests` --->
Step 3: Admins and the QM are notified, and an "access_approval" task appears in their My Tasks --->
Step 4: **Only the COO** can approve or reject (`/document-access-requests/:id/approve|reject`) --->
Step 5: On approval a `document_access` row is created and the requester is notified --->
Step 6: The requester can now see the full content and PDF.

### 3.2 Direct grant / revoke (COO)
Step 1: The COO opens the document access panel → `GET /api/document-access` --->
Step 2: Grants one user or many (`/grant-access`, `/grant-access-multiple`) --->
Step 3: Revokes access when needed (`/revoke-access`, which sets `isRevoked`) --->
Step 4: Notifications and audit log.

### 3.3 Download request
Step 1: A user asks to download a controlled PDF → `POST /api/download-requests` --->
Step 2: A "download_approval" task appears for admins and the QM --->
Step 3: Approve or reject (`/download-requests/:id/approve|reject`) --->
Step 4: The requester is notified, and the download is allowed only if approved.

--->
Step 2: `POST /api/documents/:id/lock` --->
Step 3: `isLocked = true`, access is granted to those users, and they are notified.

---

## TASK 4 – HR

### 4.1 Employee record approval workflow
Step 1: HR creates the employee (number, name, email, job title, department, employment type, supervisor, hire date) → `POST /api/employees` (`draft`) --->
Step 2: Submits for review with a reviewer → `/employees/:id/submit-review` (`in_review`) --->
Step 3: The reviewer gets an "employee_review" task in My Tasks --->
Step 4: The reviewer forwards it with an approver → `/submit-approval` (`pending_approval`) --->
Step 5: The approver approves (`/approve`) or rejects (`/reject`). Rejected records go back to the start and can be resubmitted from Step 2 --->
Step 6: On approval the **Staff Confirmation Report** PDF is created (`SCR-YYYY-NNN`) and saved to User Records for HR, admins and the linked user, and they are notified.
(Side cycle: `/employees/:id/reassign` moves the review or approval to someone else.)

### 4.2 Organogram
Step 1: `/hr` loads the employees --->
Step 2: The tree is built from `supervisorId` --->
Step 3: The reporting hierarchy is shown.

### 4.3 Employee tasks
Step 1: Create a task for an employee, optionally linked to a document → `POST /api/employee-tasks` --->
Step 2: Update status and priority (`PUT`) --->
Step 3: Complete it (`/employee-tasks/:id/complete`) → audit log.

---

## TASK 5 – Trainings & Assessments

### 5.1 Training cycle
Step 1: Create a training, assessment or certification with category, duration, passing score, validity (months) and an optional linked document → `POST /api/trainings` --->
Step 2: Assign it to an employee with a due date → `POST /api/training-assignments` --->
Step 3: The employee works through it (`PUT`, in_progress) --->
Step 4: Complete it with score and passed flag → `/training-assignments/:id/complete` --->
Step 5: A training completion is created with a certificate number, and the expiry date = today + validity --->
Step 6: The completion and certificate can be viewed or printed (`/api/training-completions`).

---

## TASK 6 – Certification Process (ISO 17021 client cycle)

### 6.1 Certification application
Step 1: An auditor, admin or QM enters the client (name, location, contact), the ISO standard, sector code and scope → `POST /api/certification-applications` (`submitted`) --->
Step 2: The application is reviewed and an auditor or lead auditor is assigned (`PUT`, `under_review`) --->
Step 3: The status moves through audit_scheduled → stage1_complete → stage2_scheduled → stage2_complete → pending_decision → approved (or rejected / suspended / withdrawn).

### 6.2 Audits & findings (backend only, no UI yet)
Step 1: Create an audit for the application (stage1/stage2/surveillance/recert/special) → `POST /api/certification-audits` --->
Step 2: Record findings (major NC, minor NC, observation, OFI) with clause and evidence → `POST /api/audit-findings` --->
Step 3: The client adds corrective action → the finding goes to `pending_verification` --->
Step 4: The auditor verifies and closes it → the audit gets a recommendation and is completed.

### 6.3 Certificate issue
Step 1: The application is approved --->
Step 2: Issue the certificate with number, issue and expiry dates, and surveillance dates 1 and 2 → `POST /api/certificates` --->
Step 3: The application status becomes `certificate_issued` → audit log --->
Step 4: Lay out and print the certificate in `CertificateDesigner` (left and right backgrounds).

---

## TASK 7 – Tasks, Performance & Records

### 7.1 My Tasks (unified inbox)
Step 1: `GET /api/my-tasks` collects document review and approve tasks, employee review and approve tasks, and, for admins and the QM, download and access approvals --->
Step 2: They are shown on the Dashboard and `/tasks` --->
Step 3: The user acts on a task, which runs the matching cycle (2.5, 2.7, 3.1, 3.3, 4.1) --->
Step 4: The list refreshes.

### 7.2 Monthly performance report
Step 1: An admin generates a report for user, month and year → `POST /api/performance-reports/generate`. It counts active hours, documents created, reviewed and approved, and tasks --->
Step 2: While it is in `draft`, the counts update live (`updateLiveReportStats`) --->
Step 3: The admin submits it to the COO → `/submit` (`in_review`) --->
Step 4: The COO reviews it with comments → `/review` (`pending_approval`) --->
Step 5: The CEO approves it → `/approve`. Either the COO or the CEO can reject it → `/reject` --->
Step 6: The approved report PDF is saved.

### 7.3 Compliance Buddy (avatar)
Step 1: `GET /api/buddy/status` / `system-status` work out the compliance score from tasks --->
Step 2: The score is mapped to a state (flexing ≥90, healthy, tired, weak, critical <60) → the BuddyAvatar is drawn --->
Step 3: Dialogues are created (reminder, congratulation, warning) → the user acknowledges them (`/buddy/dialogues/:id/acknowledge`) --->
Step 4: An optional push subscription is saved (`/buddy/subscribe`).

### 7.4 User Records
Step 1: Approval cycles (2.7, 4.1) save report PDFs --->
Step 2: `/user-records` lists the user's own records. Admins see all of them --->
Step 3: View or download through `GET /api/user-records/:id/pdf`.

### 7.5 Audit trail (ISO 17021)
Step 1: Every create, update, delete and workflow action writes an `audit_logs` row (user, entity, previous and new JSON, timestamp) --->
Step 2: `/audit-log` shows the latest 100 entries for surveillance and audit evidence.

---

## TASK 8 – Communication & Support

### 8.1 Notifications
Step 1: Workflow cycles create notifications with an urgency level --->
Step 2: `NotificationManager` and the bell poll `/api/notifications` --->
Step 3: The user marks one read or all read.

### 8.2 Gmail integration
Step 1: The user clicks Connect → `/api/gmail/connect` → Google OAuth consent --->
Step 2: `/api/gmail/callback` saves the tokens on the user --->
Step 3: Inbox → `/gmail/emails` → open an email or thread --->
Step 4: Optional **AI draft** reply (`/gmail/ai-draft`, gpt-4o) → `/gmail/send` (SMTP is the fallback) --->
Step 5: Star, archive, spam, move or mark read and unread; labels --->
Step 6: Disconnect.

### 8.3 Dashboard wall posts
Step 1: The user posts an update → `POST /api/wall-posts` --->
Step 2: Edit, pin or delete it --->
Step 3: It shows on the Dashboard feed.

### 8.4 Hub-eebi AI assistant
Step 1: The user opens the chat bubble → types a question --->
Step 2: `POST /api/hubeebi/chat` streams a gpt-4o-mini answer with QMS context --->
Step 3: The answer is drawn as it streams in.

### 8.5 Bug reports
Step 1: Any user files a bug with title, description, priority and screenshot → `POST /api/bug-reports` (ticket number) → the COO is notified --->
Step 2: The COO or an admin assigns it and sets it in progress (`PATCH`) --->
Step 3: Resolves it with notes and an evidence attachment (`/resolve`) --->
Step 4: Closes it (`/close`) → the reporter gets a thank-you notification (`userNotified`).

---

## TASK 9 – DocuGenie (AI form builder)

### 9.1 Convert → publish → collect
Step 1: Paste content from a document or Google Form → `POST /api/docugenie/convert` (gpt-4o returns fields and HTML) --->
Step 2: Save it as a draft form → `POST /api/docugenie/forms` --->
Step 3: Edit or adjust it (`PATCH`) --->
Step 4: Publish → `/forms/:id/publish` creates a `shareToken` --->
Step 5: Someone outside opens `/form/:token`. This page is public and needs no login --->
Step 6: They submit → `POST /api/docugenie/submit/:token` --->
Step 7: The owner views the submissions → `/forms/:id/submissions`.

---

## TASK 10 – CRM (admin / QM / COO only)

### 10.1 Lead management
Step 1: Create a lead with name, company, contact, source (website/referral/ads/WhatsApp) and interested course or ISO → `POST /api/leads` --->
Step 2: Assign it to a salesperson and set the next follow-up date --->
Step 3: Change status with a reason and an evidence file → `POST /api/leads/:id/status` → a `lead_status_history` row is written --->
Step 4: The COO asks the assignee for an update → `POST /api/leads/:id/update-requests` → the assignee is notified --->
Step 5: The assignee replies and resolves it → `/lead-update-requests/:id/resolve` --->
Step 6: The lead ends at approved, lost, not_interested or not_relevant.

### 10.2 Customer management
Step 1: Create a customer with contacts, address, industry and account owner → `POST /api/customers` --->
Step 2: Log the communication history (`PUT`) --->
Step 3: Upload the contract → `POST /api/customers/:id/contract` --->
Step 4: View or download the contract.

### 10.3 Opportunity pipeline
Step 1: Create an opportunity linked to a customer, with course or ISO, deal value, discount and expected close date → `POST /api/opportunities` (`qualified`) --->
Step 2: Upload the proposal → `/opportunities/:id/proposal` → stage becomes proposal_sent --->
Step 3: negotiation → won or lost (`PUT`) --->
Step 4: The pipeline dashboard shows total value, qualified, proposals, won and lost.

### 10.4 Historical performance data
Step 1: Enter a year and month with leads, deals, revenue, trainings and certifications → `POST /api/historical-data` --->
Step 2: Edit or delete --->
Step 3: Filter by year → the stats cards and table update.

---

## Recommended order to build / verify (dependency chain)

TASK 0 Foundation ---> TASK 1 Identity ---> TASK 2 Document Control ---> TASK 3 Hub & Access ---> TASK 7 My Tasks / Records / Audit ---> TASK 4 HR ---> TASK 5 Trainings ---> TASK 6 Certification ---> TASK 8 Communication ---> TASK 9 DocuGenie ---> TASK 10 CRM

---

## Breaks found while reading the code (cycles that do not complete today)

| # | Cycle | Problem | Where |
|---|-------|---------|-------|
| 1 | 2.7 → 2.8 | **Fixed.** Approval used to lock the document, so the follow-up "Lock & Transfer" always failed. Now approval moves the document to the Hub, and the COO gives final approval with a classification. | — |
| 2 | 10.1 Step 3 | The lead status change reads `existingLead.status` and writes `status:`. The real column is `leadStatus`, so the new status is never saved and `previousStatus` is empty. `reason` is NOT NULL in the DB, but the code sends `null` when no reason is given. | `server/routes.ts` ~7312, ~7326 |
| 3 | 10.1 / 10.2 / 10.3 uploads | The CRM pages call `POST /api/upload`, but no such route exists. Lead evidence, contract and proposal uploads fail. | `CrmLeads.tsx:279`, `CrmCustomers.tsx:134`, `CrmOpportunities.tsx:168` |
| 4 | 2.4 / 2.5 | **Fixed.** Reviewer, approver and COO can now return a document one step back, with the reason written as comments in the document. | — |
| 5 | 7.3 Buddy | The score is worked out from the `document_tasks` table, but nothing ever writes to it (`createDocumentTask` is never called). So every score is always 100% "flexing", and the poke/buzz endpoints work on empty data. | `storage.calculateUserCompliance` |
| 6 | 2.x versions | `document_versions` is never written (`createDocumentVersion` is unused). Old approved versions are not archived, and status `obsolete` is never set. | storage / routes |
| 7 | 6.2 | The audits and findings APIs exist, but `CertificationProcess.tsx` has no UI for them. | client |
| 8 | 7.3 push | Push subscriptions are stored, but no web-push sender exists, so no push is ever delivered. | buddy routes |
| 9 | **Security** | 51 routes have no `requireAuth`. Among them: create, update and delete **users** (anyone could create an admin), documents CRUD, employees workflow, document-access grant and approve, dashboard and audit logs. `GET /api/notifications` returns **all users'** notifications. | `server/routes.ts` 431–4092 |
| 10 | **Security** | `init-users.ts` hard-codes the passwords for the HR, COO and CEO accounts and **resets them on every boot**. The session secret has a hard-coded fallback. | `server/init-users.ts`, `server/index.ts` |
| 11 | Maintainability | COO and CEO powers are checked by fixed email strings in more than 40 places instead of by role. `routes.ts` is about 8,000 lines in one file. | `server/routes.ts` |
