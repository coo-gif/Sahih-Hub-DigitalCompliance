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

### 2.1 Add a document: three ways
`/documents/new` → choose **Link a Google file**, **Upload a Word file** or **Type or paste**. All three take Doc Ref No., Document Name, Document Type and the Associated Procedures (2.1b).

**A. Link a Google file (Docs, Sheets, Slides, any Drive file)**: the document stays in Google
Step 1: Paste the Google link (must start with https://docs.google.com/ or https://drive.google.com/). **Open** checks it in a new tab --->
Step 2: Enter the audit register details: Edition, Revision, Issue date, Prepared by, Reviewed by (optional), Approved by --->
Step 3: **Register & send to COO** → `POST /api/documents/register-link`. The document is created as approved and goes straight to the COO's final approval in the Document Hub (a Final Approval task for the COO) --->
Step 4: The COO approves and classifies it in the Hub (2.8a). It is stored as Current with the entered edition, revision and issue date, and appears in the Document Master List with a link to the Google file --->
Step 5: Opening the document in Sahih Hub shows **Open in Google**. People without access to the document do not get the link.

**B. Upload a Word file**: the file opens in the in-app editor
Step 1: **Choose file** (.docx, .txt or .html, up to 7 MB) → `POST /api/documents/convert-upload` turns it into editor content (bold, italic, underline, alignment, lists, tables and links kept; headings become bold text). Old .doc files must be saved as .docx first --->
Step 2: The content appears in the editor and the file name fills Document Name if empty --->
Step 3: Continue as C from step 2.

**C. Type or paste**
Step 1: Enter Doc Ref No. (e.g. SOP-001), Document Name and Document Type (policy/manual/sop/format/JD/training assessment) --->
Step 2: Write or paste the content in the Tiptap editor (tables, images, links) --->
Step 3: Choose the preparer and preparation due date, assigned staff or departments, and the next review date --->
Step 4: `POST /api/documents` → status `draft` (the code must be unique); `sourceType` is `manual` or `upload` --->
Step 5: Workflow log, audit log and live performance stat (`document_created`) are written. The document then goes through preparation, review, approval and the COO (2.3 onwards).

**Issue date**: for a linked Google file it is the date entered; for documents approved in Sahih Hub it is the date of the COO's final approval, and it moves to the new date each time a new version is approved.

### 2.1b Associated procedures (links that follow changes)
Step 1: When creating a document (or later, from the **Associated Procedures** card on the document page) the user picks the procedures it refers to. Each link remembers the version it was made against (`document_links.linkedVersion`, e.g. Ed.1 Rev.0) --->
Step 2: The card shows each linked procedure with its current version and status, plus the documents that refer to this one ("Referenced by") --->
Step 3: Links can be changed (`PUT /api/documents/:id/links`) by the people working on an unlocked document, or by the COO, an admin or the QM at any time --->
Step 4: When a linked procedure gets a new approved version (change request → revision → COO approval), every document that links to it is flagged `needsReview` with a note (e.g. "SOP-100 changed from Ed.1 Rev.0 to Ed.1 Rev.1 (CR-2026-001)") --->
Step 5: The owner of each flagged document is notified and gets a **Linked Procedure Changed** task (2 days) in My Tasks --->
Step 6: The owner opens the document and either confirms it still fits (**Still valid, mark reviewed** → `POST /api/document-links/:id/reviewed`, the link moves to the new version and the task closes) or, for an approved document, raises a change request (2.8b) to update it.

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

### 2.6 Inline comments: tags and assignments
Step 1: Anyone who can open a document selects text, right-clicks and chooses **Comment**. This works on drafts and on approved, locked documents --->
Step 2: Typing `@` lists users. A tagged person is **notified only**. On documents that aren't locked, ticking **Assign** next to a tagged person also gives them a task with a target date --->
Step 3: On a **locked** document the comment is for reference and discussion only. It is private to the author and the people tagged, it can't assign tasks, and the approved version is never changed --->
Step 4: A tagged person's notifications about the document clear when they open it (`POST /api/documents/:id/seen`) --->
Step 5: The commented text is highlighted. The Comments panel shows tags, assignments, private notes and change-request points. Comments can be resolved by the author, a tagged or assigned person, an admin, the QM or the COO.

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

### 2.8a Document status in the Hub (COO)
Step 1: A stored document starts as **Current**. The Status column is the last column of the Hub's Document Master List --->
Step 2: The COO changes it to **Under Revision**, **Obsolete** or **Quarantine** (`POST /api/documents/:id/lifecycle-status`). Obsolete and Quarantine ask for confirmation and an optional reason --->
Step 3: Everyone with access, and the author, is notified, and an audit entry is written --->
Step 4: Current and Under Revision documents stay readable. Obsolete and Quarantined documents are withdrawn: only the COO can open them, whatever their classification or access grants --->
Step 5: The Documents list shows an Under Revision, Obsolete or Quarantine badge.

### 2.8b Change request → revision → new version (approved documents)
Step 1: Under an approved document (Documents list) a user has **View**, **Request Access** (if they have no access yet) and **Change Request** --->
Step 2: In change-request mode the user highlights text, right-clicks → **Add to Change Request**, writes the change and picks the reason: self observation, standard deviation, audit finding, internal audit, external audit, feedback, legal change, or other (specify). Several points can be added; together they form a draft `CR-YYYY-NNN` --->
Step 3: **Submit to COO** → the COO gets a "Change Request" task (default 2 days) and sees it in Document Hub → **Change Requests** --->
Step 4a: **Reject** → the approved version stays valid, and the initiator is notified --->
Step 4b: **Accept** → the COO picks who prepares the revision and by when. The approved version is recorded and stays in force for readers, while the document shows **Current · Under revision**. The preparer gets a Prepare task with the change-request points highlighted --->
Step 5: The revision goes through prepare → review → approve → COO final approval as usual. At final approval the COO chooses a **new revision** (Ed.X Rev.Y+1) or a **new edition** (Ed.X+1 Rev.0) --->
Step 6: The new version becomes current. The previous version is stamped **Obsolete** and kept. Every version stays available under **Version History** in the Hub. The change request becomes Implemented and an entry is added to the document's revision history.

Locked documents are permanent: they can't be edited, deleted (nor can any document that was ever approved), or amended through the old revision-history route. Changes go through a change request; withdrawal is the COO's Obsolete status.

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

### 7.1 My Tasks (everything assigned to anyone)
Step 1: `server/task-sources.ts` collects every open assignment in the system, each with an assigned date and a due date. Sources without their own due date get a default time allowance (`TASK_SLA_HOURS`):
  - Documents: prepare, review, approve, COO final approval in the Hub, revise (returned), @mention comments, amendment approvals
  - Access: download requests (any admin or QM), access requests (COO)
  - HR: employee review and approval, tasks assigned to an employee, trainings. Employees are matched to their login by `userId`, or else by the same email
  - Reports: performance report review (COO) and approval (CEO)
  - Bug reports: fix (assignee, or the COO if unassigned), then verify and close (COO)
  - CRM: lead follow-ups (on the follow-up date), lead update requests
  - Certification: assigned auditor and lead auditor, certification audits
  - DocuGenie forms assigned to someone --->
Step 2: `GET /api/my-tasks` returns the signed-in user's tasks, soonest due first, with Overdue flags --->
Step 3: My Tasks and the Dashboard show every type. Review, approval and request tasks keep their own buttons; every other task has **Open**, which goes to the page where the work is done --->
Step 4: The task disappears from the list once the work is done.

### 7.1a Target dates and task initiators
Step 1: Whenever work is assigned or forwarded, the person doing it gives a **target completion date**. The field is pre-filled with the default: prepare 2 days, review 1 day, approve 1 day, COO final approval 1 day, revise after a return 2 days, @mention comment 1 day, employee review or approval 1 day (`DEFAULT_TARGET_DAYS`). Where it is asked for:
  - New Document: Prepared by + preparation date
  - Submit for Review: review date
  - Complete Review: approval date
  - Approve: COO final approval date
  - Return for Revision: date for the person it goes back to
  - Comment with @mentions: action date
  - Every Re-assign dialog
  - Employee review and approval steps --->
Step 2: `task_assignments` stores, per task (e.g. `review:12`), the **initiator** (who assigned it) and the target date. A target date always overrides default allowances. Dates in the past are refused --->
Step 3: My Tasks shows "Assigned by …" and the target date on every task --->
Step 4: The initiator, an admin, the QM or the COO opens **My Tasks → Assigned by me** and can move the task to another person (documents, employee records, comments, bug reports, lead follow-ups) or change its target date (any task). This uses `POST /api/tasks/change`. The assignee is notified and an audit entry is written. Managers can switch on "Show everyone's open tasks" --->
Step 5: The task ledger follows the latest target date. A task moved to someone else closes as *transferred* for the first person, so it does not count against them.

### 7.2 Task ledger → individual performance (automatic)
Step 1: After every successful change, and every minute, `server/task-ledger.ts` reconciles open tasks against the `task_records` table. A record opens when a task first appears in someone's list, with its assigned and due dates --->
Step 2: When a task leaves a person's list, the record closes as:
  - **completed**, with time taken and on time or late
  - **transferred**, if it was reassigned
  - **closed by other**, for a shared task someone else handled (decided from the audit log)
  - **cancelled**, if the source was deleted or withdrawn --->
Step 3: For any person and month, `computeTaskMetrics` works out, against each task's target date: tasks assigned, completed, on time and late; on-time rate; completion rate; efficiency (time allowed ÷ time taken); total and average time; average delay; open and overdue; rework (documents returned to them); reassigned or handled by others; a breakdown by task type; and a **Performance Score** (on-time 50%, completion 30%, efficiency 20%) --->
Step 4: Everyone with a task this month automatically gets a draft monthly performance report. Draft reports refresh every 5 minutes and whenever the reports page is opened --->
Step 5: The admin submits the report → the COO reviews it (a task for the COO) → the CEO approves it (a task for the CEO). Figures stop changing once the report is submitted --->
Step 6: The Performance Reports page shows On Time, Efficiency, Overdue and Score in the table, with all task figures and the per-type breakdown in the report detail. My Tasks shows the user's own completed count and on-time rate for the month.

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

## TASK 11 – Records & Data Hive (COO, admins, QM)

### 11.1 Change request & revision register
Step 1: `/records` → **Change Requests & Revision History** lists every submitted change request: date, document, ref, edition, initiator, approver (COO), need of change, status and new version --->
Step 2: **Form** opens the printable Change Request Form (`/records/change-requests/:id`): document, request, points with reasons, the COO's decision and the implementation. It can be printed or saved as PDF.

### 11.2 List of obsolete documents
Step 1: Every superseded version (with what replaced it and the change request), plus documents the COO withdrew as Obsolete. Retained and not for use.

### 11.3 Document Master List
Columns for audit: Doc Ref No., Document Name, Type, Edition, Revision, Issue Date, Prepared by, Reviewed by, Approved by, Classification, Status, Next review (Google files link straight to the file). Export CSV adds the COO's final approval and where the document is kept.
Step 1: Every document with an approved version: ref, title, category, current version, approval date and approver, classification, status, next review date and how many versions are kept. It updates automatically each time a document is approved, and can be exported to CSV or printed.

## Recommended order to build / verify (dependency chain)

TASK 0 Foundation ---> TASK 1 Identity ---> TASK 2 Document Control ---> TASK 3 Hub & Access ---> TASK 7 My Tasks / Records / Audit ---> TASK 4 HR ---> TASK 5 Trainings ---> TASK 6 Certification ---> TASK 8 Communication ---> TASK 9 DocuGenie ---> TASK 10 CRM

---

## Breaks found while reading the code (cycles that do not complete today)

| # | Cycle | Problem | Where |
|---|-------|---------|-------|
| 1 | 2.7 → 2.8 | **Fixed.** Approval used to lock the document, so the follow-up "Lock & Transfer" always failed. Now approval moves the document to the Hub, and the COO gives final approval with a classification. | — |
| 2 | 10.1 Step 3 | **Removed.** The broken lead status-change route and its dialog are gone; status is changed in the lead edit form. The status-history tab and route were removed with it. | — |
| 3 | 10.1 / 10.2 / 10.3 uploads | **Removed.** The CRM upload buttons (lead evidence, contract, proposal) and their `/contract` and `/proposal` routes are gone. Files already attached still show as links. | — |
| 4 | 2.4 / 2.5 | **Fixed.** Reviewer, approver and COO can now return a document one step back, with the reason written as comments in the document. | — |
| 5 | 7.3 Buddy | **Removed.** The per-user score (`calculateUserCompliance`, `/api/buddy/status`, `/api/buddy/refresh`) was unused by the client and is gone. The Buddy avatar uses `/api/buddy/system-status`. | — |
| 6 | 2.x versions | **Removed.** The unused `createDocumentVersion` is gone. Versions are written and archived in `document-control.ts`. | — |
| 7 | 6.2 | **Removed.** The unused audits and findings routes and storage methods are gone. The tables stay in the schema. | — |
| 8 | 7.3 push | **Removed.** The push-subscription routes and storage methods are gone. The table stays in the schema. | — |
| 9 | **Security** | **Fixed.** All routes except login, logout, me, accept-agreement, the Gmail OAuth callback and the public DocuGenie share/submit now need a login. User create, update and delete need the admin role. Notifications are scoped to the signed-in user, signatures to their owner (or admin), audit logs to admin and QM. | — |
| 10 | **Security** | **Fixed.** No passwords in the source. `init-users.ts` creates the HR, COO and CEO accounts only if missing, using `HR_INITIAL_PASSWORD`, `COO_INITIAL_PASSWORD` and `CEO_INITIAL_PASSWORD`, and never resets an existing password. `SESSION_SECRET` is required in production. | — |
| 11 | Maintainability | COO and CEO powers are checked by fixed email strings in more than 40 places instead of by role. `routes.ts` is about 8,000 lines in one file. | `server/routes.ts` |
| 12 | 7.2 reports page | **Fixed.** The Performance Reports list requested `/api/performance-reports/10/2026`, which isn't a real route, so it always showed "No reports". It now passes month and year as query parameters. | — |
| 13 | Document deletion | **Fixed.** `DELETE /api/documents/:id` needed no login and could remove approved documents. It now needs a login and refuses any document that is locked, approved, under revision or has a recorded version. | — |
