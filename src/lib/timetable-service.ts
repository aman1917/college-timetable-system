/**
 * The bridge between Postgres and the pure scheduling engine.
 *
 * Loads master data into an EngineContext, and persists timetable mutations
 * inside a transaction that RE-VALIDATES against freshly-read rows. That
 * re-check is the important part: two admins dragging lectures at the same
 * moment could each pass validation against stale data, so the authoritative
 * check happens inside the same transaction that writes.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { buildContext, type EngineContext, type Weekday } from './domain';
import { checkPlacementDetailed, slotsNeeded, windowStartingAt } from './collision';
import { HttpError } from './api';

/** Either the base client or a transaction client — both expose the same reads. */
type DbClient = Prisma.TransactionClient | typeof prisma;

export function classLabel(row: {
  year: string;
  division: string;
  semester: number;
  stream: { code: string };
}): string {
  return `${row.year} ${row.stream.code} ${row.division} (Sem ${row.semester})`;
}

/**
 * Read every row the engine needs.
 *
 * One implementation serves both the plain client and a transaction client, so
 * a read added here can never be forgotten in the transactional path — which is
 * exactly where a missing read would cause a collision to slip through.
 */
export async function loadContextIn(db: DbClient): Promise<EngineContext> {
  const [settings, slots, teachers, subjects, classes, rooms, allocations, entries] = await Promise.all([
    db.appSetting.findUnique({ where: { id: 'singleton' } }),
    db.timeSlot.findMany({ orderBy: [{ displayOrder: 'asc' }, { startTime: 'asc' }] }),
    db.teacher.findMany({ include: { availability: true } }),
    db.subject.findMany(),
    db.class.findMany({ include: { stream: true } }),
    db.room.findMany(),
    db.subjectAllocation.findMany(),
    db.timetableEntry.findMany(),
  ]);

  return buildContext({
    workingDays: (settings?.workingDays as Weekday[]) ?? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    slots: slots.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      type: s.type,
      isActive: s.isActive,
      displayOrder: s.displayOrder,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      day: e.day as Weekday,
      timeSlotId: e.timeSlotId,
      allocationId: e.allocationId,
    })),
    allocations: allocations.map((a) => ({
      id: a.id,
      teacherId: a.teacherId,
      subjectId: a.subjectId,
      classId: a.classId,
      roomId: a.roomId,
      weeklyLectures: a.weeklyLectures,
      durationMinutes: a.durationMinutes,
      status: a.status,
    })),
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      employmentType: t.employmentType,
      maxWeeklyLectures: t.maxWeeklyLectures,
      maxDailyLectures: t.maxDailyLectures,
      status: t.status,
      availability: t.availability.map((a) => ({
        day: a.day as Weekday,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    })),
    subjects: subjects.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      type: s.type,
      color: s.color,
      roomType: s.roomType,
      weeklyLectures: s.weeklyLectures,
      durationMinutes: s.durationMinutes,
    })),
    classes: classes.map((c) => ({ id: c.id, label: classLabel(c) })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, type: r.type })),
  });
}

export async function loadContext(): Promise<EngineContext> {
  return loadContextIn(prisma);
}

function randomGroupId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Place a new lecture block. Validation runs INSIDE the transaction against
 * rows read in that transaction, so a concurrent write cannot slip a collision
 * past the check.
 */
export async function placeLecture(params: {
  allocationId: string;
  day: Weekday;
  startSlotId: string;
}): Promise<{ groupId: string }> {
  return prisma.$transaction(async (tx) => {
    const ctx = await loadContextIn(tx);
    const alloc = ctx.allocations.get(params.allocationId);
    if (!alloc) throw new HttpError(404, 'That subject allocation no longer exists.');

    const needed = slotsNeeded(ctx, alloc);
    const window = windowStartingAt(ctx, params.startSlotId, needed);
    if (!window) {
      throw new HttpError(
        409,
        `This lecture needs ${needed} consecutive period(s) starting here, but that run crosses a break, lunch or the end of the day.`,
      );
    }

    const violations = checkPlacementDetailed(ctx, params.allocationId, params.day, window, null);
    if (violations.length > 0) {
      throw new HttpError(409, violations.map((v) => v.message).join('\n'));
    }

    const groupId = randomGroupId();
    await tx.timetableEntry.createMany({
      data: window.map((slotId) => ({
        groupId,
        day: params.day,
        timeSlotId: slotId,
        allocationId: params.allocationId,
      })),
    });
    return { groupId };
  });
}

/** Move an existing block, excluding itself from collision checks. */
export async function moveLecture(params: {
  groupId: string;
  day: Weekday;
  startSlotId: string;
}): Promise<{ groupId: string }> {
  return prisma.$transaction(async (tx) => {
    const ctx = await loadContextIn(tx);
    const existing = ctx.entries.filter((e) => e.groupId === params.groupId);
    if (existing.length === 0) throw new HttpError(404, 'That lecture is no longer on the timetable.');

    const allocationId = existing[0].allocationId;
    const window = windowStartingAt(ctx, params.startSlotId, existing.length);
    if (!window) {
      throw new HttpError(
        409,
        `This lecture needs ${existing.length} consecutive period(s) starting here, but that run is interrupted.`,
      );
    }

    const violations = checkPlacementDetailed(ctx, allocationId, params.day, window, params.groupId);
    if (violations.length > 0) {
      throw new HttpError(409, violations.map((v) => v.message).join('\n'));
    }

    // Replace rather than update: the new window may have a different length if
    // an admin changed the lecture duration since this block was placed.
    await tx.timetableEntry.deleteMany({ where: { groupId: params.groupId } });
    await tx.timetableEntry.createMany({
      data: window.map((slotId) => ({
        groupId: params.groupId,
        day: params.day,
        timeSlotId: slotId,
        allocationId,
      })),
    });
    return { groupId: params.groupId };
  });
}

export async function removeLecture(groupId: string) {
  const deleted = await prisma.timetableEntry.deleteMany({ where: { groupId } });
  if (deleted.count === 0) throw new HttpError(404, 'That lecture is no longer on the timetable.');
  return deleted;
}
