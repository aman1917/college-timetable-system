/**
 * PRE-PUBLISH VALIDATION + WORKLOAD DERIVATION.
 *
 * Workload is always COMPUTED from allocations and entries — it is never stored
 * or hand-entered, so it cannot drift out of sync with the timetable.
 */

import { consecutiveWindows, findExistingConflicts, slotsNeeded } from './collision';
import { type EngineContext, type Weekday, timeToMinutes } from './domain';

export interface ValidationCheck {
  key: string;
  label: string;
  pass: boolean;
  details: string[];
}

export interface ValidationReport {
  ok: boolean;
  checks: ValidationCheck[];
  summary: string;
}

export function validateTimetable(ctx: EngineContext): ValidationReport {
  const checks: ValidationCheck[] = [];
  const add = (key: string, label: string, details: string[]) =>
    checks.push({ key, label, pass: details.length === 0, details });

  // 1. Every active subject is allocated to a teacher.
  const allocatedSubjects = new Set(
    [...ctx.allocations.values()].filter((a) => a.status === 'ACTIVE').map((a) => a.subjectId),
  );
  add(
    'subjects_allocated',
    'Every active subject has a teacher allocation',
    [...ctx.subjects.values()]
      .filter((s) => !allocatedSubjects.has(s.id))
      .map((s) => `${s.code} — ${s.name} has no active allocation`),
  );

  // 2. Every allocation reaches its required weekly lecture count.
  const shortfalls: string[] = [];
  for (const alloc of ctx.allocations.values()) {
    if (alloc.status !== 'ACTIVE') continue;
    const placed = new Set(
      ctx.entries.filter((e) => e.allocationId === alloc.id).map((e) => e.groupId),
    ).size;
    if (placed < alloc.weeklyLectures) {
      const s = ctx.subjects.get(alloc.subjectId);
      const t = ctx.teachers.get(alloc.teacherId);
      const c = ctx.classes.get(alloc.classId);
      shortfalls.push(
        `${s?.code ?? '?'} — ${t?.name ?? '?'} — ${c?.label ?? '?'}: ${placed}/${alloc.weeklyLectures} scheduled`,
      );
    }
  }
  add('lectures_complete', 'All required weekly lectures are scheduled', shortfalls);

  // 3. No teacher / class / room collisions anywhere on the grid.
  add('no_collisions', 'No teacher, class or room collisions', findExistingConflicts(ctx));

  // 4. Nobody scheduled outside their availability.
  const availability: string[] = [];
  for (const e of ctx.entries) {
    const alloc = ctx.allocations.get(e.allocationId);
    if (!alloc) continue;
    const teacher = ctx.teachers.get(alloc.teacherId);
    const slot = ctx.slots.find((s) => s.id === e.timeSlotId);
    if (!teacher || !slot) continue;

    const window = teacher.availability.find((a) => a.day === e.day);
    if (!window) {
      availability.push(`${teacher.name} is scheduled on ${e.day} but is not available that day.`);
      continue;
    }
    if (timeToMinutes(slot.startTime) < timeToMinutes(window.startTime)) {
      availability.push(`${teacher.name} is scheduled at ${slot.startTime} on ${e.day}, before ${window.startTime}.`);
    }
    if (timeToMinutes(slot.endTime) > timeToMinutes(window.endTime)) {
      availability.push(`${teacher.name} is scheduled until ${slot.endTime} on ${e.day}, after ${window.endTime}.`);
    }
  }
  add('availability', 'Teachers scheduled only within their availability', [...new Set(availability)]);

  // 5. Nothing sits on a break, lunch, inactive slot or non-working day.
  const slotIssues: string[] = [];
  for (const e of ctx.entries) {
    const slot = ctx.slots.find((s) => s.id === e.timeSlotId);
    if (!slot) {
      slotIssues.push('A scheduled lecture points at a deleted time slot.');
      continue;
    }
    if (slot.type !== 'LECTURE') {
      slotIssues.push(`A lecture sits on a ${slot.type.toLowerCase()} slot at ${e.day} ${slot.startTime}.`);
    } else if (!slot.isActive) {
      slotIssues.push(`A lecture sits on an inactive slot at ${e.day} ${slot.startTime}.`);
    }
    if (!ctx.workingDays.includes(e.day)) {
      slotIssues.push(`A lecture is scheduled on ${e.day}, which is not a working day.`);
    }
  }
  add('slot_legality', 'No lecture on a break, lunch, inactive slot or closed day', [...new Set(slotIssues)]);

  // 6. Room requirements satisfied.
  const roomIssues: string[] = [];
  for (const alloc of ctx.allocations.values()) {
    if (alloc.status !== 'ACTIVE') continue;
    const subject = ctx.subjects.get(alloc.subjectId);
    if (!subject) continue;
    if (subject.roomType && !alloc.roomId) {
      roomIssues.push(`${subject.code} requires a ${subject.roomType.toLowerCase()} but has no room assigned.`);
      continue;
    }
    const room = alloc.roomId ? ctx.rooms.get(alloc.roomId) : null;
    if (subject.roomType && room && room.type !== subject.roomType) {
      roomIssues.push(`${subject.code} needs a ${subject.roomType.toLowerCase()} but is allocated ${room.name}.`);
    }
  }
  add('room_requirements', 'Practical and room-type requirements satisfied', roomIssues);

  // 7. Workload ceilings respected.
  const workloadIssues: string[] = [];
  for (const teacher of ctx.teachers.values()) {
    const load = computeWorkload(ctx, teacher.id);
    if (teacher.maxWeeklyLectures > 0 && load.scheduledPeriods > teacher.maxWeeklyLectures) {
      workloadIssues.push(
        `${teacher.name}: ${load.scheduledPeriods} period(s)/week scheduled, limit ${teacher.maxWeeklyLectures}.`,
      );
    }
    for (const [day, count] of Object.entries(load.perDay)) {
      if (teacher.maxDailyLectures > 0 && count > teacher.maxDailyLectures) {
        workloadIssues.push(
          `${teacher.name}: ${count} period(s) on ${day}, daily limit ${teacher.maxDailyLectures}.`,
        );
      }
    }
  }
  add('workload', 'No teacher exceeds their workload limits', workloadIssues);

  // 8. Structural sanity.
  const dataIssues: string[] = [];
  if (!ctx.slots.some((s) => s.type === 'LECTURE' && s.isActive)) {
    dataIssues.push('No active lecture time slots are defined.');
  }
  if (ctx.workingDays.length === 0) dataIssues.push('No working days are configured.');
  if (ctx.classes.size === 0) dataIssues.push('No classes have been created.');
  for (const alloc of ctx.allocations.values()) {
    if (!ctx.teachers.has(alloc.teacherId)) dataIssues.push('An allocation references a missing teacher.');
    if (!ctx.subjects.has(alloc.subjectId)) dataIssues.push('An allocation references a missing subject.');
    if (!ctx.classes.has(alloc.classId)) dataIssues.push('An allocation references a missing class.');
    if (consecutiveWindows(ctx, slotsNeeded(ctx, alloc)).length === 0) {
      const s = ctx.subjects.get(alloc.subjectId);
      dataIssues.push(
        `${s?.code ?? 'An allocation'} needs ${slotsNeeded(ctx, alloc)} consecutive period(s), but no such run exists in the current slot layout.`,
      );
    }
  }
  add('data_integrity', 'No missing or structurally invalid master data', [...new Set(dataIssues)]);

  const ok = checks.every((c) => c.pass);
  const failed = checks.filter((c) => !c.pass).length;
  return {
    ok,
    checks,
    summary: ok
      ? 'READY TO PUBLISH — all checks passed.'
      : `CANNOT PUBLISH — ${failed} check(s) failed.`,
  };
}

// ------------------------------------------------------------- workload ----

export interface WorkloadSummary {
  teacherId: string;
  teacherName: string;
  employmentType: string;
  /** Lecture blocks per week the allocations call for. */
  requiredBlocks: number;
  /** Grid periods actually placed (a 2-period practical counts as 2). */
  scheduledPeriods: number;
  theoryBlocks: number;
  practicalBlocks: number;
  perDay: Record<string, number>;
  maxWeekly: number;
  maxDaily: number;
  isOverloaded: boolean;
}

export function computeWorkload(ctx: EngineContext, teacherId: string): WorkloadSummary {
  const teacher = ctx.teachers.get(teacherId);
  const allocs = [...ctx.allocations.values()].filter(
    (a) => a.teacherId === teacherId && a.status === 'ACTIVE',
  );

  let theory = 0;
  let practical = 0;
  for (const a of allocs) {
    const subject = ctx.subjects.get(a.subjectId);
    if (subject?.type === 'PRACTICAL') practical += a.weeklyLectures;
    else theory += a.weeklyLectures;
  }

  const mine = ctx.entries.filter((e) => ctx.allocations.get(e.allocationId)?.teacherId === teacherId);
  const perDay: Record<string, number> = {};
  for (const day of ctx.workingDays) {
    perDay[day] = mine.filter((e) => e.day === day).length;
  }

  const requiredBlocks = allocs.reduce((n, a) => n + a.weeklyLectures, 0);
  const maxWeekly = teacher?.maxWeeklyLectures ?? 0;

  return {
    teacherId,
    teacherName: teacher?.name ?? '?',
    employmentType: teacher?.employmentType ?? 'FULL_TIME',
    requiredBlocks,
    scheduledPeriods: mine.length,
    theoryBlocks: theory,
    practicalBlocks: practical,
    perDay,
    maxWeekly,
    maxDaily: teacher?.maxDailyLectures ?? 0,
    isOverloaded: maxWeekly > 0 && requiredBlocks > maxWeekly,
  };
}

export function computeAllWorkloads(ctx: EngineContext): WorkloadSummary[] {
  return [...ctx.teachers.values()].map((t) => computeWorkload(ctx, t.id));
}

/** Allocations that still need lecture blocks placed — the builder's side panel. */
export function unscheduledPool(ctx: EngineContext) {
  const pool = [];
  for (const alloc of ctx.allocations.values()) {
    if (alloc.status !== 'ACTIVE') continue;
    const placed = new Set(
      ctx.entries.filter((e) => e.allocationId === alloc.id).map((e) => e.groupId),
    ).size;
    const remaining = alloc.weeklyLectures - placed;
    if (remaining <= 0) continue;
    pool.push({
      allocation: alloc,
      remaining,
      subject: ctx.subjects.get(alloc.subjectId) ?? null,
      teacher: ctx.teachers.get(alloc.teacherId) ?? null,
      klass: ctx.classes.get(alloc.classId) ?? null,
      room: alloc.roomId ? ctx.rooms.get(alloc.roomId) ?? null : null,
      periodsEach: slotsNeeded(ctx, alloc),
    });
  }
  return pool.sort((a, b) => (a.subject?.code ?? '').localeCompare(b.subject?.code ?? ''));
}

export const _weekdayOrder: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
