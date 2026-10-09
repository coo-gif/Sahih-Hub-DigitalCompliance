import { db } from "./db";
import { and, eq, gte, lte, or, isNull, gt } from "drizzle-orm";
import {
  taskRecords, taskAssignments, auditLogs, monthlyPerformanceReports, users,
  TaskRecordStatus, MonthlyReportStatus, DEFAULT_TARGET_DAYS, type TaskRecord,
} from "@shared/schema";
import { collectOpenTasks, POOLED_TASK_TYPES, TASK_TYPE_LABELS, type OpenTask } from "./task-sources";

const MINUTE = 60 * 1000;

// ============================================
// Reconciliation: keep task_records in step with what is currently assigned.
// A record opens when a task first appears in someone's list and closes when it leaves it.
// ============================================
let running: Promise<void> = Promise.resolve();

export function reconcileTasks(): Promise<void> {
  // One run at a time, so the same task is never recorded twice
  running = running.then(runReconcile, runReconcile).catch(err => {
    console.error('[tasks] reconcile failed:', err);
  });
  return running;
}

let queued = false;
// Called after every change made through the API. Runs straight away so even tasks that are
// open for a moment (reviewed and approved within seconds) are recorded; calls that arrive
// while a run is in progress are folded into one follow-up run.
export function scheduleReconcile() {
  if (queued) return;
  queued = true;
  running = running.then(() => {
    queued = false;
    return runReconcile();
  }).catch(err => {
    queued = false;
    console.error('[tasks] reconcile failed:', err);
  });
}

async function runReconcile() {
  const { tasks, existingEntities, cancelledKeys } = await collectOpenTasks();
  const now = new Date();
  const openNow = new Map<string, OpenTask>(tasks.map(t => [`${t.userId}|${t.key}`, t]));
  const ownersByKey = new Map<string, Set<number>>();
  for (const t of tasks) {
    if (!ownersByKey.has(t.key)) ownersByKey.set(t.key, new Set());
    ownersByKey.get(t.key)!.add(t.userId);
  }

  const openRows = await db.select().from(taskRecords).where(eq(taskRecords.status, TaskRecordStatus.OPEN));
  const recorded = new Set(openRows.map(r => `${r.userId}|${r.taskKey}`));

  // Close records whose task is no longer in that person's list
  for (const row of openRows) {
    const current = openNow.get(`${row.userId}|${row.taskKey}`);
    if (current) {
      // The initiator may have moved the target date: measure against the latest one
      const dueChanged = current.dueSource !== 'default' && (current.dueAt?.getTime() ?? null) !== (row.dueAt?.getTime() ?? null);
      if (dueChanged || (current.initiatorId ?? null) !== row.initiatorId) {
        await db.update(taskRecords).set({
          dueAt: dueChanged ? current.dueAt : row.dueAt,
          minutesAllowed: dueChanged
            ? (current.dueAt ? Math.max(1, Math.round((current.dueAt.getTime() - row.assignedAt.getTime()) / MINUTE)) : null)
            : row.minutesAllowed,
          initiatorId: current.initiatorId ?? null,
        }).where(eq(taskRecords.id, row.id));
      }
      continue;
    }
    const status = await closingStatus(row, ownersByKey, existingEntities, cancelledKeys);
    const minutesTaken = Math.max(0, Math.round((now.getTime() - row.assignedAt.getTime()) / MINUTE));
    const counted = status === TaskRecordStatus.COMPLETED;
    await db.update(taskRecords).set({
      status,
      closedAt: now,
      minutesTaken: counted ? minutesTaken : null,
      completedOnTime: counted && row.dueAt ? now <= row.dueAt : null,
    }).where(eq(taskRecords.id, row.id));
  }

  // Open records for newly assigned tasks
  const fresh = tasks.filter(t => !recorded.has(`${t.userId}|${t.key}`));
  if (fresh.length > 0) {
    await db.insert(taskRecords).values(fresh.map(t => ({
      userId: t.userId,
      taskKey: t.key,
      taskType: t.taskType,
      title: t.title,
      reference: t.reference,
      link: t.link,
      entityType: t.entityType,
      entityId: t.entityId,
      initiatorId: t.initiatorId ?? null,
      assignedAt: t.assignedAt,
      dueAt: t.dueAt,
      minutesAllowed: t.dueAt ? Math.max(1, Math.round((t.dueAt.getTime() - t.assignedAt.getTime()) / MINUTE)) : null,
    })));
  }
}

async function closingStatus(
  row: TaskRecord,
  ownersByKey: Map<string, Set<number>>,
  existingEntities: Set<string>,
  cancelledKeys: Set<string>,
): Promise<string> {
  if (cancelledKeys.has(row.taskKey) || !existingEntities.has(`${row.entityType}:${row.entityId}`)) {
    return TaskRecordStatus.CANCELLED;
  }
  // The same piece of work is now with someone else: it was reassigned
  if (ownersByKey.get(row.taskKey)?.size) {
    return TaskRecordStatus.TRANSFERRED;
  }
  // A shared task: only the person who acted on it gets the credit
  if (POOLED_TASK_TYPES.has(row.taskType)) {
    const [acted] = await db.select({ id: auditLogs.id }).from(auditLogs).where(and(
      eq(auditLogs.userId, row.userId),
      eq(auditLogs.entityType, row.entityType),
      eq(auditLogs.entityId, row.entityId),
      gte(auditLogs.createdAt, row.assignedAt),
    )).limit(1);
    return acted ? TaskRecordStatus.COMPLETED : TaskRecordStatus.CLOSED_BY_OTHER;
  }
  return TaskRecordStatus.COMPLETED;
}

// ============================================
// Target dates set when a task is assigned or forwarded
// ============================================

// End of the day, N days from now: the default target when assigning
export function defaultTargetDate(taskType: string): Date {
  const d = new Date();
  d.setDate(d.getDate() + (DEFAULT_TARGET_DAYS[taskType] ?? 1));
  d.setHours(23, 59, 59, 999);
  return d;
}

// Reads a target date sent by the client (ISO string); falls back to the default for the task type
export function parseTargetDate(value: unknown, taskType: string): Date {
  if (typeof value === 'string' && value) {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new TargetDateError('Invalid target completion date');
    if (d.getTime() < Date.now() - 5 * MINUTE) throw new TargetDateError('The target completion date cannot be in the past');
    return d;
  }
  return defaultTargetDate(taskType);
}

export class TargetDateError extends Error {}

export async function setTaskTarget(taskKey: string, data: { assigneeId?: number | null; initiatorId: number; targetDate: Date; note?: string | null }) {
  await db.insert(taskAssignments).values({
    taskKey,
    assigneeId: data.assigneeId ?? null,
    initiatorId: data.initiatorId,
    targetDate: data.targetDate,
    note: data.note ?? null,
  }).onConflictDoUpdate({
    target: taskAssignments.taskKey,
    set: {
      assigneeId: data.assigneeId ?? null,
      initiatorId: data.initiatorId,
      targetDate: data.targetDate,
      note: data.note ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function getTaskTarget(taskKey: string) {
  const [row] = await db.select().from(taskAssignments).where(eq(taskAssignments.taskKey, taskKey));
  return row;
}

export async function getOpenTaskRecords(userId: number): Promise<TaskRecord[]> {
  return db.select().from(taskRecords).where(and(eq(taskRecords.userId, userId), eq(taskRecords.status, TaskRecordStatus.OPEN)));
}

// ============================================
// Performance metrics for one person over a period
// ============================================
export interface TypeBreakdown {
  label: string;
  completed: number;
  onTime: number;
  late: number;
  open: number;
  avgMinutes: number | null;
}

export interface TaskMetrics {
  tasksAssigned: number;
  tasksCompleted: number;
  tasksCompletedOnTime: number;
  tasksCompletedLate: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksTransferred: number;
  reworkCount: number;
  totalTaskMinutes: number;
  totalTargetMinutes: number;
  avgTurnaroundMinutes: number | null;
  avgDelayMinutes: number | null;
  onTimeRate: number | null;
  completionRate: number | null;
  efficiencyPercent: number | null;
  performanceScore: number | null;
  breakdown: Record<string, TypeBreakdown>;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export async function computeTaskMetrics(userId: number, start: Date, end: Date): Promise<TaskMetrics> {
  const now = new Date();
  // Everything this person had open during the period, or that closed / was due / was assigned in it
  const rows = await db.select().from(taskRecords).where(and(
    eq(taskRecords.userId, userId),
    lte(taskRecords.assignedAt, end),
    or(isNull(taskRecords.closedAt), gte(taskRecords.closedAt, start)),
  ));

  const inPeriod = (d: Date | null) => !!d && d >= start && d <= end;
  const completed = rows.filter(r => r.status === TaskRecordStatus.COMPLETED && inPeriod(r.closedAt));
  const withDeadline = completed.filter(r => r.completedOnTime !== null);
  const onTime = withDeadline.filter(r => r.completedOnTime);
  const late = withDeadline.filter(r => !r.completedOnTime);
  // Still open at the end of the period (or now, for the current month)
  const asOf = end < now ? end : now;
  const open = rows.filter(r =>
    r.status === TaskRecordStatus.OPEN || (r.closedAt !== null && r.closedAt > asOf &&
      (r.status === TaskRecordStatus.COMPLETED || r.status === TaskRecordStatus.TRANSFERRED || r.status === TaskRecordStatus.CLOSED_BY_OTHER))
  );
  const overdue = open.filter(r => r.dueAt && r.dueAt < asOf);

  const totalTaskMinutes = completed.reduce((sum, r) => sum + (r.minutesTaken || 0), 0);
  const allowed = withDeadline.reduce((sum, r) => sum + (r.minutesAllowed || 0), 0);
  const taken = withDeadline.reduce((sum, r) => sum + Math.max(1, r.minutesTaken || 0), 0);
  const delays = late.map(r => Math.round((r.closedAt!.getTime() - r.dueAt!.getTime()) / MINUTE));

  // Completion rate: of the tasks that fell due in the period (up to now), how many were done
  const dueInPeriod = rows.filter(r =>
    inPeriod(r.dueAt) && (
      r.status === TaskRecordStatus.COMPLETED ||
      (r.status === TaskRecordStatus.OPEN && r.dueAt! <= asOf)
    )
  );
  const dueAndDone = dueInPeriod.filter(r => r.status === TaskRecordStatus.COMPLETED);

  const onTimeRate = pct(onTime.length, withDeadline.length);
  const completionRate = pct(dueAndDone.length, dueInPeriod.length);
  const efficiencyPercent = taken > 0 ? Math.min(200, Math.round((allowed / taken) * 100)) : null;

  // Score out of 100: on-time 50%, completion 30%, efficiency 20% (efficiency capped at 100)
  const parts: Array<[number | null, number]> = [
    [onTimeRate, 0.5],
    [completionRate, 0.3],
    [efficiencyPercent === null ? null : Math.min(100, efficiencyPercent), 0.2],
  ];
  const known = parts.filter(([v]) => v !== null) as Array<[number, number]>;
  const weight = known.reduce((s, [, w]) => s + w, 0);
  const performanceScore = weight > 0 ? Math.round(known.reduce((s, [v, w]) => s + v * w, 0) / weight) : null;

  const breakdown: Record<string, TypeBreakdown> = {};
  const bucket = (type: string) => (breakdown[type] ??= {
    label: TASK_TYPE_LABELS[type] || type, completed: 0, onTime: 0, late: 0, open: 0, avgMinutes: null,
  });
  for (const r of completed) {
    const b = bucket(r.taskType);
    b.completed++;
    if (r.completedOnTime === true) b.onTime++;
    if (r.completedOnTime === false) b.late++;
  }
  for (const r of open) bucket(r.taskType).open++;
  for (const [type, b] of Object.entries(breakdown)) {
    const done = completed.filter(r => r.taskType === type);
    b.avgMinutes = done.length ? Math.round(done.reduce((s, r) => s + (r.minutesTaken || 0), 0) / done.length) : null;
  }

  return {
    tasksAssigned: rows.filter(r => inPeriod(r.assignedAt)).length,
    tasksCompleted: completed.length,
    tasksCompletedOnTime: onTime.length,
    tasksCompletedLate: late.length,
    tasksPending: open.length,
    tasksOverdue: overdue.length,
    tasksTransferred: rows.filter(r =>
      (r.status === TaskRecordStatus.TRANSFERRED || r.status === TaskRecordStatus.CLOSED_BY_OTHER) && inPeriod(r.closedAt)
    ).length,
    reworkCount: rows.filter(r => r.taskType === 'revise' && inPeriod(r.assignedAt)).length,
    totalTaskMinutes,
    totalTargetMinutes: allowed,
    avgTurnaroundMinutes: completed.length ? Math.round(totalTaskMinutes / completed.length) : null,
    avgDelayMinutes: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
    onTimeRate,
    completionRate,
    efficiencyPercent,
    performanceScore,
    breakdown,
  };
}

export function monthRange(month: number, year: number) {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59, 999) };
}

export function reportFieldsFromMetrics(m: TaskMetrics) {
  return {
    tasksAssigned: m.tasksAssigned,
    tasksCompleted: m.tasksCompleted,
    tasksCompletedOnTime: m.tasksCompletedOnTime,
    tasksCompletedLate: m.tasksCompletedLate,
    tasksPending: m.tasksPending,
    tasksOverdue: m.tasksOverdue,
    tasksTransferred: m.tasksTransferred,
    reworkCount: m.reworkCount,
    totalTaskMinutes: m.totalTaskMinutes,
    totalTargetMinutes: m.totalTargetMinutes,
    avgTurnaroundMinutes: m.avgTurnaroundMinutes,
    avgDelayMinutes: m.avgDelayMinutes,
    onTimeRate: m.onTimeRate,
    completionRate: m.completionRate,
    efficiencyPercent: m.efficiencyPercent,
    performanceScore: m.performanceScore,
    taskBreakdown: JSON.stringify(m.breakdown),
  };
}

// ============================================
// Keep monthly reports filled in automatically
// ============================================
export async function refreshPerformanceReports(): Promise<void> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const { start } = monthRange(month, year);

  // Everyone who has had a task this month gets a draft report for the month
  const activeRows = await db.selectDistinct({ userId: taskRecords.userId }).from(taskRecords).where(or(
    eq(taskRecords.status, TaskRecordStatus.OPEN),
    gt(taskRecords.assignedAt, start),
    gt(taskRecords.closedAt, start),
  ));
  const activeUsers = await db.select({ id: users.id, isActive: users.isActive }).from(users);
  const activeIds = new Set(activeUsers.filter(u => u.isActive !== false).map(u => u.id));
  const { storage } = await import("./storage");
  for (const { userId } of activeRows) {
    if (activeIds.has(userId)) await storage.generateMonthlyReport(userId, month, year);
  }

  // Draft reports (any month) track the live numbers until they are submitted
  const drafts = await db.select().from(monthlyPerformanceReports)
    .where(eq(monthlyPerformanceReports.status, MonthlyReportStatus.DRAFT));
  for (const report of drafts) {
    const { start: s, end: e } = monthRange(report.reportMonth, report.reportYear);
    const metrics = await computeTaskMetrics(report.userId, s, e);
    await db.update(monthlyPerformanceReports)
      .set({ ...reportFieldsFromMetrics(metrics), updatedAt: new Date() })
      .where(eq(monthlyPerformanceReports.id, report.id));
  }
}

let started = false;
// Background upkeep: reconcile tasks every minute and refresh draft reports every five
export function startTaskTracking() {
  if (started) return;
  started = true;
  reconcileTasks().then(() => refreshPerformanceReports()).catch(err => console.error('[tasks] startup failed:', err));
  setInterval(() => reconcileTasks(), 60 * 1000);
  setInterval(() => {
    reconcileTasks().then(() => refreshPerformanceReports()).catch(err => console.error('[tasks] report refresh failed:', err));
  }, 5 * 60 * 1000);
}
