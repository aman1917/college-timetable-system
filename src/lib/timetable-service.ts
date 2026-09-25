/**
 * The bridge between Postgres and the pure scheduling engine.
 *
 * Loads master data into an EngineContext, and persists timetable mutations
 * inside a transaction that RE-VALIDATES against freshly-read rows.
 *
 * Common Group behaviour:
 * - A normal allocation creates one timetable lecture.
 * - A Common Group creates ONE timetable group containing all participating
 *   allocations.
 * - Every allocation belonging to the same Common Group receives the same
 *   day, time slots and groupId.
 * - Moving a Common Group moves every participating class together.
 * - Removing a Common Group removes every timetable entry belonging to it.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  buildContext,
  type EngineContext,
  type Weekday,
} from './domain';
import {
  checkPlacementDetailed,
  slotsNeeded,
  windowStartingAt,
} from './collision';
import { HttpError } from './api';

/** Either the base client or a transaction client. */
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
 * Loads the complete scheduling context.
 *
 * IMPORTANT:
 * commonGroupId and isCommon are intentionally passed into the engine.
 * Without these two fields the auto-generator cannot know that several
 * allocations belong to one Common Group.
 */
export async function loadContextIn(
  db: DbClient,
): Promise<EngineContext> {
  const [
    settings,
    slots,
    teachers,
    subjects,
    classes,
    rooms,
    allocations,
    entries,
  ] = await Promise.all([
    db.appSetting.findUnique({
      where: { id: 'singleton' },
    }),

    db.timeSlot.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { startTime: 'asc' },
      ],
    }),

    db.teacher.findMany({
      include: {
        availability: true,
      },
    }),

    db.subject.findMany(),

    db.class.findMany({
      include: {
        stream: true,
      },
    }),

    db.room.findMany(),

    db.subjectAllocation.findMany(),

    db.timetableEntry.findMany(),
  ]);

  return buildContext({
    workingDays:
      (settings?.workingDays as Weekday[]) ??
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],

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

      // -------------------------------------------------------
      // Common Group support
      // -------------------------------------------------------
      commonGroupId: a.commonGroupId,
      isCommon: a.isCommon,
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

    classes: classes.map((c) => ({
      id: c.id,
      label: classLabel(c),
    })),

    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
    })),
  });
}

export async function loadContext(): Promise<EngineContext> {
  return loadContextIn(prisma);
}

function randomGroupId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Returns all allocations belonging to the same Common Group.
 *
 * If the allocation is not part of a Common Group, the returned array
 * contains only that allocation.
 */
function getLectureAllocations(
  ctx: EngineContext,
  allocationId: string,
) {
  const allocation = ctx.allocations.get(allocationId);

  if (!allocation) {
    return [];
  }

  if (!allocation.isCommon || !allocation.commonGroupId) {
    return [allocation];
  }

  return [...ctx.allocations.values()].filter(
    (a) =>
      a.isCommon &&
      a.commonGroupId === allocation.commonGroupId,
  );
}

/**
 * Checks all allocations participating in a lecture.
 *
 * For a Common Group every participating class must be able to use
 * exactly the same day/time window.
 */
function checkLecturePlacement(
  ctx: EngineContext,
  allocationId: string,
  day: Weekday,
  window: string[],
  ignoreGroupId: string | null,
) {
  const allocations = getLectureAllocations(ctx, allocationId);

  const violations = [];

  for (const allocation of allocations) {
    violations.push(
      ...checkPlacementDetailed(
        ctx,
        allocation.id,
        day,
        window,
        ignoreGroupId,
      ),
    );
  }

  return violations;
}

/**
 * Places one lecture.
 *
 * For a Common Group:
 *
 *   FYBCOM allocation
 *   FYBCOMMS allocation
 *
 * are written with:
 *
 *   SAME groupId
 *   SAME day
 *   SAME timeSlotIds
 *
 * Therefore they are one real lecture shared by both classes.
 */
export async function placeLecture(params: {
  allocationId: string;
  day: Weekday;
  startSlotId: string;
}): Promise<{ groupId: string }> {
  return prisma.$transaction(async (tx) => {
    const ctx = await loadContextIn(tx);

    const alloc = ctx.allocations.get(params.allocationId);

    if (!alloc) {
      throw new HttpError(
        404,
        'That subject allocation no longer exists.',
      );
    }

    const allocations = getLectureAllocations(
      ctx,
      params.allocationId,
    );

    const needed = slotsNeeded(ctx, alloc);

    const window = windowStartingAt(
      ctx,
      params.startSlotId,
      needed,
    );

    if (!window) {
      throw new HttpError(
        409,
        `This lecture needs ${needed} consecutive period(s) starting here, but that run crosses a break, lunch or the end of the day.`,
      );
    }

    const violations = checkLecturePlacement(
      ctx,
      params.allocationId,
      params.day,
      window,
      null,
    );

    if (violations.length > 0) {
      throw new HttpError(
        409,
        violations
          .map((v) => v.message)
          .join('\n'),
      );
    }

    const groupId = randomGroupId();

    const data = [];

    for (const allocation of allocations) {
      for (const slotId of window) {
        data.push({
          groupId,
          day: params.day,
          timeSlotId: slotId,
          allocationId: allocation.id,
        });
      }
    }

    await tx.timetableEntry.createMany({
      data,
    });

    return { groupId };
  });
}

/**
 * Moves an entire timetable lecture.
 *
 * If the group is a Common Group, ALL allocations in that group move
 * together to the new day/time.
 */
export async function moveLecture(params: {
  groupId: string;
  day: Weekday;
  startSlotId: string;
}): Promise<{ groupId: string }> {
  return prisma.$transaction(async (tx) => {
    const ctx = await loadContextIn(tx);

    const existing = ctx.entries.filter(
      (e) => e.groupId === params.groupId,
    );

    if (existing.length === 0) {
      throw new HttpError(
        404,
        'That lecture is no longer on the timetable.',
      );
    }

    /**
     * Find every allocation participating in this timetable group.
     */
    const allocationIds = [
      ...new Set(
        existing.map((e) => e.allocationId),
      ),
    ];

    const allocations = allocationIds
      .map((id) => ctx.allocations.get(id))
      .filter(
        (a): a is NonNullable<typeof a> =>
          Boolean(a),
      );

    if (allocations.length === 0) {
      throw new HttpError(
        404,
        'The allocations for this lecture no longer exist.',
      );
    }

    /**
     * The number of periods is based on one allocation.
     *
     * A Common Group has multiple allocations, but each allocation
     * occupies the same number of periods.
     */
    const firstAllocationEntries = existing.filter(
      (e) =>
        e.allocationId ===
        allocations[0].id,
    );

    const needed = firstAllocationEntries.length;

    const window = windowStartingAt(
      ctx,
      params.startSlotId,
      needed,
    );

    if (!window) {
      throw new HttpError(
        409,
        `This lecture needs ${needed} consecutive period(s) starting here, but that run is interrupted.`,
      );
    }

    /**
     * Validate EVERY allocation in the group against the new
     * position.
     */
    const violations = [];

    for (const allocation of allocations) {
      violations.push(
        ...checkPlacementDetailed(
          ctx,
          allocation.id,
          params.day,
          window,
          params.groupId,
        ),
      );
    }

    if (violations.length > 0) {
      throw new HttpError(
        409,
        violations
          .map((v) => v.message)
          .join('\n'),
      );
    }

    /**
     * Remove the old group.
     */
    await tx.timetableEntry.deleteMany({
      where: {
        groupId: params.groupId,
      },
    });

    /**
     * Re-create every allocation at exactly the same
     * day/time window.
     */
    const data = [];

    for (const allocation of allocations) {
      for (const slotId of window) {
        data.push({
          groupId: params.groupId,
          day: params.day,
          timeSlotId: slotId,
          allocationId: allocation.id,
        });
      }
    }

    await tx.timetableEntry.createMany({
      data,
    });

    return {
      groupId: params.groupId,
    };
  });
}

export async function removeLecture(
  groupId: string,
) {
  const deleted =
    await prisma.timetableEntry.deleteMany({
      where: {
        groupId,
      },
    });

  if (deleted.count === 0) {
    throw new HttpError(
      404,
      'That lecture is no longer on the timetable.',
    );
  }

  return deleted;
}