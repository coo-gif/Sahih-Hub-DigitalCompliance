# Sahih Hub – Digital Compliance: Features, Workflows and Verified Status

What the system is: a web-based Quality Management System (QMS) for Sahih Certifications, an ISO 17021 certification body.
One Express + PostgreSQL (Drizzle) backend (`server/`) and a React frontend (`client/src/pages/*`). Tables: `shared/schema.ts`.

Structure: **Task (module) → Sub-task (one complete workflow) → Steps** (`Step 1 → Step 2 → …`).

Roles: `admin`, `quality_manager` (QM), `department_head`, `staff`, `auditor`. Some powers are tied to fixed emails: **COO** `coo@sahihcertify.com`, **CEO** `ceo@sahihcertify.com`, **HR** `hr@sahihcertify.com`.

## How this was verified (9 Oct 2026)

Every workflow below was **run end to end** against a local copy of the app (code on GitHub `main` + branch `ccr-0eb60590-1vvosy`), not just read. Status marks:

| Mark | Meaning |
|---|---|
| ✅ | Ran it; works as described |
| ⚠️ | Works, but with a gap noted underneath |
| ❌ | Broken: the workflow cannot be completed |
| 🔒 | Security problem: someone can see or change what they shouldn't |
| ⏸ | Not testable here (needs Replit file storage, an OpenAI key, Google keys, or Replit's browser path); code was read instead |

Not covered (not on GitHub, so not checked): `server/google-ai.ts` and `components/form-builder/` (exist only on Replit), and the internal audit module (not pushed yet).

---

## TASK 0 – Platform foundation

### 0.1 Server boot ✅
Step 1: `npm run dev` starts `server/index.ts` → Step 2: sessions stored in Postgres (24 h cookie) → Step 3: HR, COO and CEO accounts created → Step 4: all routes mounted → Step 5: app served.
- ✅ `init-users.ts` creates the HR, COO and CEO accounts only if missing, with passwords from `HR_INITIAL_PASSWORD`, `COO_INITIAL_PASSWORD` and `CEO_INITIAL_PASSWORD`, and never resets an existing password.
- ✅ Fixed today: an error inside any request used to crash the whole server; errors are now logged and the server keeps running.

### 0.2 Database schema ✅
Step 1: tables in `shared/schema.ts` → Step 2: `npm run db:push` creates them → Step 3: input is validated (bad email or role → clear error).

### 0.3 File upload (shared) ⏸
Step 1: ask for an upload URL (`/api/uploads/request-url`) → Step 2: browser uploads to Replit storage → Step 3: file opened through `/objects/...`.
- ✅ Requires login. ⏸ Storage itself only exists on Replit.
- ⚠️ Any logged-in user can open any stored file if they know its address.

---

## TASK 1 – Identity & access

### 1.1 Login ✅
Step 1: app asks who is logged in → Step 2: Login page → Step 3: email + password → Step 4: password checked, account must be active → Step 5: session created, last login saved → Step 6: Dashboard loads.
- Wrong password and deactivated accounts are refused.
- ⚠️ Deactivating a user does not end a session they already have open.

### 1.2 First-login user agreement ✅
Step 1: new user is blocked by the agreement → Step 2: reads and accepts → Step 3: acceptance saved with time → Step 4: audit entry → Step 5: app opens.

### 1.3 Online-hours tracking ❌
Step 1: login starts a session → Step 2: heartbeats add active minutes → Step 3: logout ends it → Step 4: minutes feed the monthly report.
- The server side works, but **the app never calls steps 1–3**, so online hours are always 0.

### 1.4 Logout ✅
Step 1: Logout → Step 2: session destroyed → Step 3: Login page.

### 1.5 User management (Users page) ✅ / 🔒
Step 1: admin opens Users → Step 2: creates a user (password hashed) → Step 3: audit entry → Step 4: edit role / deactivate / delete → Step 5: upload signature (used on PDFs).
- 🔒 **None of the user routes check login or role.** A logged-out visitor or any staff member can create an admin, promote themselves to admin, change others' roles, delete users and read everyone's signature.
- ⚠️ Deleting a user who has data (posts, documents) fails with an error.

---

## TASK 2 – Document control (core QMS cycle)

Lifecycle: **Draft → In Review → Pending Approval → Approved → COO final approval → Stored in the Hub (Current)**. Version shown as `Ed.X Rev.Y`.

### 2.1 Add a document – three ways ✅
**A. Link a Google file** (Docs, Sheets, Slides, Drive) ✅
Step 1: paste the Google link → Step 2: enter Doc Ref, name, type, edition, revision, issue date, prepared / reviewed / approved by → Step 3: Register & send to COO → Step 4: COO approves and classifies → Step 5: stored as Current with the entered edition, revision and issue date; opens in Google.

**B. Upload a Word file** ✅
Step 1: choose .docx / .txt / .html (≤7 MB) → Step 2: content appears in the editor, file name fills the title → Step 3: continue as C.

**C. Type or paste** ✅
Step 1: Doc Ref, name, type → Step 2: write or paste content → Step 3: preparer + due date, staff/departments, next review date → Step 4: saved as Draft → Step 5: logs written; continues at 2.3.

### 2.1b Associated procedures ✅
Step 1: link the procedures a document refers to → Step 2: card shows each one's version and status, plus "Referenced by" → Step 3: links editable by the working team (or COO/admin/QM) → Step 4: when a linked procedure gets a new version, linked documents are flagged → Step 5: owner notified + "Linked Procedure Changed" task → Step 6: owner marks "still valid" (task closes) or raises a change request.

### 2.2 Edit a draft ✅
Step 1: open draft → Step 2: edit / Find & Replace / AI Rewrite / AI Review → Step 3: save (refused when locked) → Step 4: audit entry.
- ⏸ AI Rewrite and AI Review need an OpenAI key.

### 2.3 Preparer confirmation ✅
Step 1: preparer opens draft → Step 2: Confirm Preparation → Step 3: signature date stamped + audit.

### 2.4 Submit for review ✅
Step 1: choose reviewer (+ approver) and review due date → Step 2: submit → Step 3: In Review → Step 4: reviewer notified + task.

### 2.5 Review ✅
Step 1: reviewer's task → Step 2: open, comment if needed → Step 3: complete review with approval due date → Step 4: Pending Approval, approver notified → Step 5: logs.
- ⚠️ The review signature date (`reviewedBySignedAt`) is never filled in.

### 2.6 Inline comments (tags and assignments) ✅
Step 1: select text → right-click → Comment → Step 2: @mention people (tag = notification; Assign = task with due date) → Step 3: on locked documents comments are private reference notes → Step 4: notification clears when the tagged person opens the document → Step 5: highlights, Comments panel, resolve.

### 2.6a Return for revision ✅
Step 1: reviewer / approver / COO opens the document → Step 2: adds at least one comment with the reason → Step 3: Return for Revision → Step 4: goes back one step (reviewer → preparer, approver → reviewer, COO → approver) → Step 5: person notified, banner shows reason → Step 6: logs.

### 2.7 Approve → Document Hub ✅ / ⏸
Step 1: approver's task → Step 2: approve with COO due date → Step 3: Approved, moved to the Hub awaiting COO → Step 4: COO notified + task → Step 5: Document Approval Report PDF → Step 6: PDF saved to User Records → Step 7: stats.
- ⏸ Steps 5–6: the report PDF uses a fixed Replit browser path. It failed here; it works only if that exact path exists on Replit (to be checked there).

### 2.8 COO final approval & storage ✅
Step 1: COO opens Hub → Awaiting Final Approval → Step 2: views → Step 3: picks classification (Confidential / Controlled Copy / Public / Legal) and who gets access → Step 4: document locked and stored → Step 5: access granted, people notified → Step 6: listed in the Hub; COO can change classification later.

### 2.8a Hub status ✅
Step 1: stored as Current → Step 2: COO sets Under Revision / Obsolete / Quarantine → Step 3: people notified → Step 4: Obsolete and Quarantine withdraw it (COO only) → Step 5: badges shown.

### 2.8b Change request → revision → new version ✅
Step 1: on an approved document: View / Request Access / Change Request → Step 2: highlight text, add points with reasons → Step 3: submit to COO (task) → Step 4a: reject (old version stays) or 4b: accept (Current · Under revision, preparer gets task) → Step 5: revision goes through the normal cycle; COO picks new revision or new edition → Step 6: new version Current, old one Obsolete and kept in Version History.

### 2.9 Reassign a step ✅ / ⚠️
Step 1: assignee, admin or QM opens the task → Step 2: chooses new person + reason → Step 3: new person notified + task, old task closes.
- ⚠️ An approved, locked document can still be reassigned, which clears the review signature and gives the new person access.
- ⚠️ The audit entry loses the "before" value.

### 2.10 Official PDF ⚠️ / ⏸
Step 1: allowed user clicks Generate PDF → Step 2: full or light version → Step 3: PDF with logo, Ed/Rev and signatories → Step 4: view / download.
- ✅ With the browser path set, the full PDF came out correctly (header, Ed/Rev, three signatories). Who may generate is enforced on approved documents.
- ⏸ Fails here because the app couldn't find a browser; should work on Replit.
- ⚠️ On drafts, any logged-in user can generate it.

### 2.11 Revision (amendment) history ✅ / ⚠️
Step 1: add amendment entry → Step 2: reviewed → Step 3: approved → Step 4: revision number goes up.
- ✅ Locked documents refuse this (use a change request).
- ⚠️ No permission check: any user can add or approve entries on anyone's draft.

### 2.12 Compliance (review-due) alerts ✅ / 🔒
Step 1: approved documents carry a next review date → Step 2: Dashboard asks for stats and alerts → Step 3: yellow = due within 30 days, red = overdue → Step 4: counters and list.
- ⚠️ The next review date can only be set while the document is a draft.
- 🔒 Dashboard stats, alerts and activity are readable without logging in.

---

## TASK 3 – Document Hub access

### 3.1 Request access to a restricted document ✅
Step 1: non-member sees details only → Step 2: Request Access with reason → Step 3: admins/QM notified, COO task → Step 4: COO approves or rejects → Step 5: access granted, requester notified → Step 6: full content visible ("Access Pending" shows meanwhile).

### 3.2 Direct grant / revoke (COO) ✅
Step 1: COO opens access panel → Step 2: grants one or many → Step 3: revokes → Step 4: notifications + audit.

### 3.3 Download request ❌
Step 1: user requests to download a controlled PDF → Step 2: admins/QM get a task → Step 3: approve / reject → Step 4: requester notified; download allowed only if approved.
- ❌ There is **no button in the app** to make a request (API only).
- ❌ Approval **does not unlock** the download, and anyone with access can already download without asking.
- ⚠️ A decided request can be decided again.

---

## TASK 4 – HR

### 4.1 Employee record approval ✅ / ❌ / 🔒
Step 1: HR creates employee (Draft) → Step 2: submit for review with reviewer + due date → Step 3: reviewer gets task → Step 4: reviewer forwards to approver → Step 5: approver approves or rejects (rejected can be resubmitted) → Step 6: Staff Confirmation Report PDF saved to User Records + notifications. Side cycle: reassign ✅.
- ✅ Steps 1–5 and reassign work, with tasks and due dates.
- ❌ Step 6: the report is **never created** (fixed Replit browser path), so no User Record and no notification, although the approval succeeds.
- ⚠️ Anyone can forward or approve (no check that it's their task), and performance then credits the assigned person.
- 🔒 Employee routes need no login (list readable by anyone; changes possible).

### 4.2 Organogram ✅
Step 1: HR page loads employees → Step 2: tree built from supervisor → Step 3: hierarchy shown.
- ⚠️ People in a supervisor loop disappear from the chart; drafts are included.

### 4.3 Employee tasks ✅
Step 1: create task (optionally linked to a document) → Step 2: update status/priority → Step 3: complete → audit. Appears in the person's My Tasks.
- ⚠️ No notification when assigned; no permission checks.

---

## TASK 5 – Trainings & assessments

### 5.1 Training cycle ❌
Step 1: create training (category, duration, passing score, validity) → Step 2: assign to employee with due date → Step 3: in progress → Step 4: complete with score → Step 5: certificate number + expiry (today + validity) → Step 6: view / print certificate.
- ❌ Step 2: **assigning with a due date always fails**, and the page always sends one, so trainings can't be assigned from the app.
- ⚠️ Step 4: the passing score is ignored (a fail still gets a certificate); completing twice gives two certificates with the same number; employees can certify themselves.
- ❌ Step 6: no certificate view or print in the app (list only).

---

## TASK 6 – Certification process (ISO 17021 client cycle)

### 6.1 Application ✅ / ⚠️
Step 1: QM/auditor enters client, standard, scope → Step 2: review + assign auditor and lead auditor → Step 3: status moves audit scheduled → stage 1 → stage 2 → decision → approved.
- ✅ Assigned auditors get a My Tasks entry.
- ⚠️ No control on the page to assign auditors (API only); any status or order is accepted; any logged-in user can edit an application.

### 6.2 Audits & findings ❌
Step 1: create audit (stage 1/2, surveillance, recert) → Step 2: record findings (major/minor NC, observation, OFI) → Step 3: client corrective action → Step 4: verify, close, recommend, complete.
- ❌ **No screens** for audits or findings.
- ❌ Any date (scheduled, target closure, verified, completed) causes an error.
- ⚠️ Adding a corrective action doesn't move the finding forward; an audit can be completed with major NCs still open.

### 6.3 Certificate issue ❌
Step 1: application approved → Step 2: issue certificate (number, dates, surveillance dates) → Step 3: application becomes "certificate issued" → Step 4: design and print.
- ❌ Step 2 **always fails** (date error), so no certificate can be issued and the application stays open forever.
- ❌ Step 4: designer has no background fields, print or download.

---

## TASK 7 – Tasks, performance & records

### 7.1 My Tasks ✅
Step 1: every open assignment in the system is collected with a due date → Step 2: user's list, soonest first, overdue flagged → Step 3: Open / action buttons → Step 4: disappears when done.
- ✅ Confirmed sources: document steps, comments, returns, linked-procedure reviews, change requests, access and download approvals, employee review/approval, employee tasks, trainings, bug reports, certification and audits, DocuGenie forms, performance report review/approval.

### 7.1a Target dates & initiators ✅
Step 1: due date required when assigning/forwarding (defaults: prepare 2 d, review 1 d, approve 1 d) → Step 2: initiator + date stored → Step 3: shown on the task → Step 4: initiator can move the task or change the date (Assigned by me) → Step 5: performance follows the latest target.

### 7.2 Performance (automatic) ✅ / ❌
Step 1: every task is recorded when it appears → Step 2: closed as completed / transferred / closed by other / cancelled → Step 3: monthly figures (on time, efficiency, delay, score…) → Step 4: draft monthly report per person → Step 5: admin submits → COO reviews → CEO approves → Step 6: shown on Performance Reports and My Tasks.
- ✅ Figures, submit, COO review and figure freeze work.
- ❌ CEO approval returns an error: the report is marked approved but no User Record is saved and the person isn't notified.
- ⚠️ No order checks (CEO can approve a draft directly; approved reports can be moved back).

### 7.3 Compliance Buddy ⚠️
Step 1: score from tasks → Step 2: avatar state → Step 3: messages, acknowledge → 
- ⚠️ Score is always 100 (reads an unused table, not the task records).
- ❌ Push messages are never sent.
- ⚠️ Anyone can acknowledge anyone's message.

### 7.4 User Records ❌
Step 1: approvals save report PDFs → Step 2: user sees own records; admins see all → Step 3: view / download.
- ❌ Step 1: nothing produced records in testing (PDF path for approval reports; error on performance reports).
- ❌ Step 2: admins only see their own records.
- ✅ Step 3: viewing permissions are correct.

### 7.5 Audit trail ✅ / 🔒
Step 1: every change writes an audit entry → Step 2: Audit Log page shows the latest 100.
- 🔒 The audit log is readable by anyone, including logged-out visitors.
- ⚠️ Some modules lose the description text (DocuGenie; the "before" value on reassign).

### 11 – Records & Data Hive (COO, admins, QM) ✅
- 11.1 Change request & revision register → printable Change Request Form ✅
- 11.2 Obsolete documents (superseded versions + withdrawn) ✅
- 11.3 Document Master List (Doc Ref, name, type, edition, revision, issue date, prepared/reviewed/approved by, classification, status, next review; CSV export) ✅

---

## TASK 8 – Communication & support

### 8.1 Notifications 🔒
Step 1: workflows create notifications → Step 2: bell shows them → Step 3: mark read / mark all read.
- 🔒 **Everyone sees everyone's notifications**, including logged-out visitors; anyone can mark others' as read.

### 8.2 Gmail ⏸ / ❌
Step 1: connect Google → Step 2: tokens saved → Step 3: inbox / threads → Step 4: AI draft reply → send → Step 5: star, archive, labels → Step 6: disconnect.
- ⏸ Needs Google keys; without them it fails politely.
- ❌ AI draft reply is broken even with a key (code error).

### 8.3 Dashboard wall posts ✅ / 🔒
Step 1: post → Step 2: edit / pin / delete → Step 3: shown on Dashboard.
- 🔒 Anyone can edit, pin or delete anyone's post.

### 8.4 Hub-eebi AI assistant ⏸
Step 1: open chat, ask → Step 2: AI answer with QMS context → Step 3: shown as it streams. Needs an OpenAI key; fails politely without one.

### 8.5 Bug reports ✅ / ❌
Step 1: user files a bug (ticket number), COO notified → Step 2: COO assigns, in progress → Step 3: resolved with notes/evidence → Step 4: closed, reporter thanked.
- ✅ Works when the COO handles it.
- ❌ If assigned to someone else, they get a task but **cannot see or resolve the bug** (dead end).
- ❌ After any bug report is deleted, **new reports fail** (ticket numbering).

---

## TASK 9 – DocuGenie (form builder)

### 9.1 Convert → publish → collect ✅ / 🔒
Step 1: paste content → AI converts to a form → Step 2: save draft → Step 3: edit → Step 4: publish (share link) → Step 5: public opens link without login → Step 6: submits → Step 7: owner sees submissions.
- ⏸ Step 1 needs an OpenAI key. ✅ Steps 2–7 work.
- 🔒 Any logged-in user can read, edit, republish (breaking the link) or delete anyone's form, and read its submissions.

---

# Open workflows (what still needs steps to complete)

### A. Security – fix before real use 🔒
1. User accounts: anyone can create admins, change roles, delete users (1.5).
2. Notifications: everyone's are visible to everyone (8.1).
3. Audit log and dashboard data readable without login (7.5, 2.12).
4. Employee (HR) routes need no login (4.1).
5. Fixed HR / COO / CEO passwords reset on every restart (0.1).
6. Others' data can be changed by any logged-in user: wall posts (8.3), DocuGenie forms and submissions (9.1), certification applications (6.1), revision-history entries (2.11).
7. Deactivated users stay logged in (1.1).

### B. Broken – the workflow cannot finish ❌
1. Certificate issue always fails → certification cycle never closes (6.3).
2. Audits & findings: no screens, dates fail (6.2).
3. Assigning a training from the app always fails (5.1).
4. Report PDFs (Document Approval, Staff Confirmation) depend on a fixed Replit browser path → no User Records (2.7, 4.1, 7.4). Check on Replit; fix by finding the browser automatically.
5. CEO approval of performance reports errors; no User Record saved (7.2).
6. Download requests: no button, and approval doesn't control the download (3.3).
7. Online-hours tracking never starts (1.3).
8. Bug assigned to a non-COO person is a dead end; ticket numbering breaks after a delete (8.5).
10. Gmail AI draft reply code error (8.2).
11. Certificate view/print for trainings and certificate designer print/download missing (5.1, 6.3).

### C. Works, but needs finishing ⚠️
1. Employee review/approval: check the person acting is the assignee (4.1).
2. Locked documents shouldn't be reassignable (2.9).
3. Performance report steps should follow the order (7.2).
4. Compliance Buddy score should use the task records; push messages never sent (7.3).
5. User Records: admins should see all (7.4).
6. Training: enforce passing score, unique certificate numbers (5.1).
8. Review signature date never recorded (2.5).
9. Assign auditors from the certification page (6.1).

### D. Not testable here ⏸ (check on the live app)
AI features (needs OpenAI key), Gmail (Google keys), file storage (Replit), PDF generation (Replit browser path).

### E. Not on GitHub
`server/google-ai.ts` and `components/form-builder/` exist only on Replit; the internal audit module hasn't been pushed. Push them to GitHub so they can be checked.
