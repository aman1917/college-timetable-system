import {
  type EngineAllocation,
  type EngineContext,
  type EngineSlot,
  type Weekday,
  slotDurationMinutes,
  timeToMinutes,
} from './domain';

export interface PlacementResult {
  ok: boolean;
  /** Human-readable, specific, and safe to show straight to the user. */
  reasons: string[];
}

/** Machine-readable reason codes, for tests and for UI that wants to branch. */
export type ViolationCode =
  | 'TEACHER_COLLISION'
  | 'CLASS_COLLISION'
  | 'ROOM_COLLISION'
  | 'TEACHER_UNAVAILABLE_DAY'
  | 'TEACHER_UNAVAILABLE_TIME'
  | 'NON_LECTURE_SLOT'
  | 'NOT_WORKING_DAY'
  | 'DAILY_LIMIT'
  | 'WEEKLY_LIMIT'
  | 'ROOM_TYPE_MISMATCH'
  | 'NOT_CONTIGUOUS'
  | 'UNKNOWN_ALLOCATION'
  | 'INACTIVE_ALLOCATION';

export interface Violation {
  code: ViolationCode;
  message: string;
}

// ---------------------------------------------------------------- common group ---

/**
 * Two allocation rows belong to the same physical lecture when they are
 * members of the same Common Group.
 *
 * Example:
 *
 *   FYBCOM     ─┐
 *               ├── Business Communication
 *   FYBCOMMS ───┘
 *
 * These are two database allocation rows but ONE real lecture.
 *
 * Therefore:
 *   - same teacher is allowed
 *   - same room is allowed
 *   - they must be scheduled at the same time
 *
 * The scheduler is responsible for moving/placing the complete group together.
 */
function sameCommonGroup(
  a: EngineAllocation,
  b: EngineAllocation,
): boolean {
  return (
    a.isCommon === true &&
    b.isCommon === true &&
    !!a.commonGroupId &&
    a.commonGroupId === b.commonGroupId
  );
}

// ---------------------------------------------------------------- geometry ---

export function lectureSlots(ctx: EngineContext): EngineSlot[] {
  return ctx.slots.filter((s) => s.type === 'LECTURE' && s.isActive);
}

/** The length of one grid period, used to convert a duration into a slot count. */
export function unitSlotMinutes(ctx: EngineContext): number {
  const lec = lectureSlots(ctx);
  if (lec.length === 0) return 50;

  // The shortest active lecture slot is the safe unit: it never over-estimates
  // how much a 100-minute practical will consume.
  return Math.min(...lec.map(slotDurationMinutes));
}

/** How many consecutive grid periods this allocation occupies. */
export function slotsNeeded(
  ctx: EngineContext,
  allocation: EngineAllocation,
): number {
  const unit = unitSlotMinutes(ctx);

  return Math.max(
    1,
    Math.round((allocation.durationMinutes || unit) / unit),
  );
}

/**
 * Every run of `n` consecutive lecture slots with no break, lunch or inactive
 * slot inside it. This is what stops a 100-minute practical from being placed
 * across the lunch hour.
 */
export function consecutiveWindows(
  ctx: EngineContext,
  n: number,
): string[][] {
  const windows: string[][] = [];
  const all = ctx.slots;

  for (let i = 0; i + n <= all.length; i++) {
    const run = all.slice(i, i + n);

    if (
      run.every(
        (s) => s.type === 'LECTURE' && s.isActive,
      )
    ) {
      windows.push(run.map((s) => s.id));
    }
  }

  return windows;
}

export function windowStartingAt(
  ctx: EngineContext,
  startSlotId: string,
  n: number,
): string[] | null {
  return (
    consecutiveWindows(ctx, n).find(
      (w) => w[0] === startSlotId,
    ) ?? null
  );
}

// ------------------------------------------------------------ availability ---

function availabilityFor(
  ctx: EngineContext,
  teacherId: string,
  day: Weekday,
) {
  const teacher = ctx.teachers.get(teacherId);

  if (!teacher) return null;

  return (
    teacher.availability.find(
      (a) => a.day === day,
    ) ?? null
  );
}

// ------------------------------------------------------------------ check ---

/**
 * Validate placing `allocationId` on `day` across `slotIds`.
 *
 * @param excludeGroupId when MOVING an existing lecture, pass its groupId so it
 *        does not collide with its own current position.
 */
export function checkPlacementDetailed(
  ctx: EngineContext,
  allocationId: string,
  day: Weekday,
  slotIds: string[],
  excludeGroupId: string | null = null,
): Violation[] {
  const violations: Violation[] = [];

  const push = (
    code: ViolationCode,
    message: string,
  ) => {
    if (
      !violations.some(
        (v) =>
          v.code === code &&
          v.message === message,
      )
    ) {
      violations.push({
        code,
        message,
      });
    }
  };

  const alloc = ctx.allocations.get(allocationId);

  if (!alloc) {
    return [
      {
        code: 'UNKNOWN_ALLOCATION',
        message:
          'That subject allocation no longer exists.',
      },
    ];
  }

  if (alloc.status !== 'ACTIVE') {
    push(
      'INACTIVE_ALLOCATION',
      'This allocation is inactive and cannot be scheduled.',
    );
  }

  const teacher = ctx.teachers.get(alloc.teacherId);
  const klass = ctx.classes.get(alloc.classId);
  const room = alloc.roomId
    ? ctx.rooms.get(alloc.roomId)
    : null;
  const subject = ctx.subjects.get(alloc.subjectId);

  // --- 7. working day -------------------------------------------------------

  if (!ctx.workingDays.includes(day)) {
    push(
      'NOT_WORKING_DAY',
      `${day} is not a configured working day.`,
    );
  }

  // --- 5/6. slot legality ---------------------------------------------------

  for (const slotId of slotIds) {
    const slot = ctx.slots.find(
      (s) => s.id === slotId,
    );

    if (!slot) {
      push(
        'NON_LECTURE_SLOT',
        'That time slot no longer exists.',
      );
      continue;
    }

    if (slot.type !== 'LECTURE') {
      push(
        'NON_LECTURE_SLOT',
        `${slot.startTime}–${slot.endTime} is a ${slot.type.toLowerCase()} slot — no lecture can be placed there.`,
      );
    } else if (!slot.isActive) {
      push(
        'NON_LECTURE_SLOT',
        `${slot.startTime}–${slot.endTime} is inactive and cannot hold a lecture.`,
      );
    }
  }

  // --- 11. contiguity -------------------------------------------------------

  const needed = slotsNeeded(ctx, alloc);

  if (slotIds.length !== needed) {
    push(
      'NOT_CONTIGUOUS',
      `This lecture runs ${alloc.durationMinutes} minutes and needs ${needed} consecutive period(s), but ${slotIds.length} were supplied.`,
    );
  } else {
    const positions = slotIds.map(
      (id) =>
        ctx.slots.findIndex(
          (s) => s.id === id,
        ),
    );

    const contiguous = positions.every(
      (p, i) =>
        i === 0 ||
        p === positions[i - 1] + 1,
    );

    if (
      !contiguous ||
      positions.some((p) => p < 0)
    ) {
      push(
        'NOT_CONTIGUOUS',
        'The selected periods are not consecutive — a break or lunch interrupts the run.',
      );
    }
  }

  // --- 10. room type --------------------------------------------------------

  if (
    subject?.roomType &&
    room &&
    room.type !== subject.roomType
  ) {
    push(
      'ROOM_TYPE_MISMATCH',
      `${subject.code} requires a ${subject.roomType.toLowerCase()} but ${room.name} is a ${room.type.toLowerCase()}.`,
    );
  }

  // --- 1/2/3. occupancy collisions -----------------------------------------

  const sameDay = ctx.entries.filter(
    (e) =>
      e.day === day &&
      e.groupId !== excludeGroupId,
  );

  for (const slotId of slotIds) {
    const slot = ctx.slots.find(
      (s) => s.id === slotId,
    );

    const when = slot
      ? `${day} ${slot.startTime}–${slot.endTime}`
      : day;

    for (const other of sameDay.filter(
      (e) => e.timeSlotId === slotId,
    )) {
      const otherAlloc =
        ctx.allocations.get(
          other.allocationId,
        );

      if (!otherAlloc) continue;

      /*
       * IMPORTANT:
       *
       * If both allocations belong to the SAME Common Group,
       * they represent the SAME physical lecture.
       *
       * Example:
       *
       *   FYBCOM  allocation
       *   FYBCOMMS allocation
       *          ↓
       *      Common Group
       *          ↓
       *   Teacher VN + Room 301
       *
       * Therefore they must NOT generate:
       *
       *   Teacher collision
       *   Room collision
       *
       * They are intentionally using the same teacher and room.
       *
       * The scheduler guarantees that all members of the Common Group
       * are placed together.
       */
      const isSameCommonGroup =
        sameCommonGroup(
          alloc,
          otherAlloc,
        );

      if (!isSameCommonGroup) {
        if (
          otherAlloc.teacherId ===
          alloc.teacherId
        ) {
          const t = ctx.teachers.get(
            otherAlloc.teacherId,
          );

          const otherSubject =
            ctx.subjects.get(
              otherAlloc.subjectId,
            );

          const otherClass =
            ctx.classes.get(
              otherAlloc.classId,
            );

          push(
            'TEACHER_COLLISION',
            `${t?.name ?? 'That teacher'} is already teaching ${otherSubject?.code ?? 'another subject'} to ${otherClass?.label ?? 'another class'} at ${when}.`,
          );
        }

        if (
          otherAlloc.classId ===
          alloc.classId
        ) {
          const otherSubject =
            ctx.subjects.get(
              otherAlloc.subjectId,
            );

          push(
            'CLASS_COLLISION',
            `${klass?.label ?? 'That class'} already has ${otherSubject?.code ?? 'a lecture'} at ${when}.`,
          );
        }

        if (
          alloc.roomId &&
          otherAlloc.roomId ===
            alloc.roomId
        ) {
          const otherClass =
            ctx.classes.get(
              otherAlloc.classId,
            );

          push(
            'ROOM_COLLISION',
            `${room?.name ?? 'That room'} is already booked by ${otherClass?.label ?? 'another class'} at ${when}.`,
          );
        }
      } else {
        /*
         * Same Common Group is intentionally sharing teacher/room.
         *
         * Still check class collision separately. A Common Group should
         * never contain the same class twice.
         */
        if (
          otherAlloc.classId ===
          alloc.classId
        ) {
          const otherSubject =
            ctx.subjects.get(
              otherAlloc.subjectId,
            );

          push(
            'CLASS_COLLISION',
            `${klass?.label ?? 'That class'} already has ${otherSubject?.code ?? 'a lecture'} at ${when}.`,
          );
        }
      }
    }
  }

  // --- 4. teacher availability ---------------------------------------------

  if (teacher) {
    const window =
      availabilityFor(
        ctx,
        teacher.id,
        day,
      );

    if (!window) {
      push(
        'TEACHER_UNAVAILABLE_DAY',
        `${teacher.name} is not available on ${day}${teacher.employmentType === 'PART_TIME' ? ' (part-time availability)' : ''}.`,
      );
    } else {
      const first = ctx.slots.find(
        (s) => s.id === slotIds[0],
      );

      const last = ctx.slots.find(
        (s) =>
          s.id ===
          slotIds[
            slotIds.length - 1
          ],
      );

      if (first && last) {
        if (
          timeToMinutes(
            first.startTime,
          ) <
            timeToMinutes(
              window.startTime,
            ) ||
          timeToMinutes(
            last.endTime,
          ) >
            timeToMinutes(
              window.endTime,
            )
        ) {
          push(
            'TEACHER_UNAVAILABLE_TIME',
            `${teacher.name} is only available ${window.startTime}–${window.endTime} on ${day}.`,
          );
        }
      }
    }

    // --- 8. daily cap -------------------------------------------------------

    const dayLoad =
      ctx.entries.filter((e) => {
        if (
          e.day !== day ||
          e.groupId === excludeGroupId
        ) {
          return false;
        }

        return (
          ctx.allocations.get(
            e.allocationId,
          )?.teacherId === teacher.id
        );
      }).length;

    if (
      teacher.maxDailyLectures > 0 &&
      dayLoad + slotIds.length >
        teacher.maxDailyLectures
    ) {
      push(
        'DAILY_LIMIT',
        `${teacher.name} would exceed their limit of ${teacher.maxDailyLectures} period(s) per day on ${day}.`,
      );
    }

    // --- 9. weekly cap ------------------------------------------------------

    const weekLoad =
      ctx.entries.filter((e) => {
        if (
          e.groupId === excludeGroupId
        ) {
          return false;
        }

        return (
          ctx.allocations.get(
            e.allocationId,
          )?.teacherId === teacher.id
        );
      }).length;

    if (
      teacher.maxWeeklyLectures > 0 &&
      weekLoad + slotIds.length >
        teacher.maxWeeklyLectures
    ) {
      push(
        'WEEKLY_LIMIT',
        `${teacher.name} would exceed their limit of ${teacher.maxWeeklyLectures} period(s) per week.`,
      );
    }
  }

  return violations;
}

export function checkPlacement(
  ctx: EngineContext,
  allocationId: string,
  day: Weekday,
  slotIds: string[],
  excludeGroupId: string | null = null,
): PlacementResult {
  const violations =
    checkPlacementDetailed(
      ctx,
      allocationId,
      day,
      slotIds,
      excludeGroupId,
    );

  return {
    ok: violations.length === 0,
    reasons: violations.map(
      (v) => v.message,
    ),
  };
}

/**
 * Every (day, startSlotId) the given allocation may legally start at.
 * The builder uses this to highlight drop targets BEFORE the user drags, so an
 * illegal drop is usually impossible rather than merely rejected.
 */
export function validTargets(
  ctx: EngineContext,
  allocationId: string,
  excludeGroupId: string | null = null,
): Set<string> {
  const targets = new Set<string>();

  const alloc =
    ctx.allocations.get(
      allocationId,
    );

  if (!alloc) return targets;

  const windows =
    consecutiveWindows(
      ctx,
      slotsNeeded(ctx, alloc),
    );

  for (const day of ctx.workingDays) {
    for (const w of windows) {
      if (
        checkPlacementDetailed(
          ctx,
          allocationId,
          day,
          w,
          excludeGroupId,
        ).length === 0
      ) {
        targets.add(
          `${day}|${w[0]}`,
        );
      }
    }
  }

  return targets;
}

/**
 * Detect collisions in an ALREADY-PERSISTED timetable
 * (used before publishing).
 */
export function findExistingConflicts(
  ctx: EngineContext,
): string[] {
  const conflicts: string[] = [];
  const buckets =
    new Map<string, typeof ctx.entries>();

  for (const e of ctx.entries) {
    const key =
      `${e.day}|${e.timeSlotId}`;

    const list =
      buckets.get(key) ?? [];

    list.push(e);
    buckets.set(key, list);
  }

  for (const [key, list] of buckets) {
    if (list.length < 2) continue;

    const [day, slotId] =
      key.split('|');

    const slot =
      ctx.slots.find(
        (s) => s.id === slotId,
      );

    const when = slot
      ? `${day} ${slot.startTime}–${slot.endTime}`
      : day;

    for (
      let i = 0;
      i < list.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < list.length;
        j++
      ) {
        const a =
          ctx.allocations.get(
            list[i].allocationId,
          );

        const b =
          ctx.allocations.get(
            list[j].allocationId,
          );

        if (!a || !b) continue;

        /*
         * Multiple allocation rows from the same Common Group represent
         * ONE physical lecture.
         *
         * Therefore teacher and room sharing is intentional.
         */
        if (sameCommonGroup(a, b)) {
          /*
           * A Common Group should contain different classes.
           * Keep class collision protection in case malformed data ever
           * puts the same class into the same group.
           */
          if (a.classId === b.classId) {
            conflicts.push(
              `Class clash at ${when}: ${
                ctx.classes.get(
                  a.classId,
                )?.label ??
                a.classId
              }`,
            );
          }

          continue;
        }

        if (
          a.teacherId ===
          b.teacherId
        ) {
          conflicts.push(
            `Teacher clash at ${when}: ${
              ctx.teachers.get(
                a.teacherId,
              )?.name ??
              a.teacherId
            }`,
          );
        }

        if (
          a.classId ===
          b.classId
        ) {
          conflicts.push(
            `Class clash at ${when}: ${
              ctx.classes.get(
                a.classId,
              )?.label ??
              a.classId
            }`,
          );
        }

        if (
          a.roomId &&
          a.roomId === b.roomId
        ) {
          conflicts.push(
            `Room clash at ${when}: ${
              ctx.rooms.get(
                a.roomId,
              )?.name ??
              a.roomId
            }`,
          );
        }
      }
    }
  }

  return [
    ...new Set(conflicts),
  ];
}