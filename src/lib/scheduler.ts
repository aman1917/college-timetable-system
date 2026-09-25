/**
 * AUTOMATIC TIMETABLE GENERATION.
 *
 * Common Group aware scheduler.
 *
 * IMPORTANT RULE:
 *
 * A normal allocation is one scheduling unit.
 *
 * A Common Group is ALSO one scheduling unit, even though it contains
 * multiple SubjectAllocation records.
 *
 * Example:
 *
 *   FYBCOM  Business Communication
 *   FYBCOMMS Business Communication
 *
 * both belong to:
 *
 *   commonGroupId = CG_001
 *
 * The scheduler will select ONE day/time:
 *
 *   MON 08:00 - 08:50
 *
 * and create:
 *
 *   FYBCOM  -> MON 08:00
 *   FYBCOMMS -> MON 08:00
 *
 * with the SAME timetable groupId.
 *
 * It will NEVER independently schedule one class at 08:00 and
 * the other at 09:00.
 */

import {
  checkPlacementDetailed,
  consecutiveWindows,
  slotsNeeded,
} from './collision';

import type {
  EngineAllocation,
  EngineContext,
  EngineEntry,
  Weekday,
} from './domain';

export interface GenerationShortfall {
  allocationId: string;
  subjectCode: string;
  teacherName: string;
  className: string;
  required: number;
  placed: number;
  sampleReasons: string[];
}

export interface GenerationResult {
  placedGroups: number;
  placedPeriods: number;
  repairedGroups: number;
  shortfalls: GenerationShortfall[];
  entries: EngineEntry[];
  complete: boolean;
}

/** Deterministic PRNG so a generation run can be reproduced from its seed. */
function makeRandom(seed: number) {
  let state = seed >>> 0 || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;

    return state / 0xffffffff;
  };
}

function shuffled<T>(
  arr: T[],
  rand: () => number,
): T[] {
  const out = [...arr];

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(
      rand() * (i + 1),
    );

    [out[i], out[j]] = [
      out[j],
      out[i],
    ];
  }

  return out;
}

function newId(counter: { n: number }): string {
  counter.n += 1;

  return `gen_${Date.now().toString(36)}_${counter.n.toString(36)}`;
}

/**
 * Returns every allocation belonging to one scheduling unit.
 *
 * Normal allocation:
 *
 *   [allocation]
 *
 * Common Group:
 *
 *   [allocation1, allocation2, allocation3]
 */
function getUnitAllocations(
  ctx: EngineContext,
  allocation: EngineAllocation,
): EngineAllocation[] {
  if (
    !allocation.isCommon ||
    !allocation.commonGroupId
  ) {
    return [allocation];
  }

  return [
    ...ctx.allocations.values(),
  ].filter(
    (a) =>
      a.isCommon &&
      a.commonGroupId ===
        allocation.commonGroupId,
  );
}

/**
 * Returns a unique key for a scheduling unit.
 *
 * Common Group:
 *   common:<commonGroupId>
 *
 * Normal allocation:
 *   allocation:<allocationId>
 */
function unitKey(
  allocation: EngineAllocation,
): string {
  if (
    allocation.isCommon &&
    allocation.commonGroupId
  ) {
    return `common:${allocation.commonGroupId}`;
  }

  return `allocation:${allocation.id}`;
}

/**
 * Build unique scheduling units.
 *
 * THIS is the most important change.
 *
 * Previously:
 *
 *   allocation A
 *   allocation B
 *
 * were scheduled separately.
 *
 * Now:
 *
 *   commonGroup A+B
 *
 * is one scheduling unit.
 */
function schedulingUnits(
  ctx: EngineContext,
): EngineAllocation[][] {
  const result: EngineAllocation[][] = [];
  const seen = new Set<string>();

  for (const allocation of ctx.allocations.values()) {
    if (allocation.status !== 'ACTIVE') {
      continue;
    }

    const key = unitKey(allocation);

    if (seen.has(key)) {
      continue;
    }

    const members =
      getUnitAllocations(
        ctx,
        allocation,
      );

    if (members.length === 0) {
      continue;
    }

    seen.add(key);

    result.push(members);
  }

  return result;
}

/**
 * How many lecture blocks are already scheduled for a unit.
 *
 * For a Common Group:
 *
 *   all member allocations share the same groupId,
 *
 * therefore we count UNIQUE groupIds.
 */
function scheduledGroupsForUnit(
  ctx: EngineContext,
  allocations: EngineAllocation[],
): number {
  const allocationIds = new Set(
    allocations.map((a) => a.id),
  );

  return new Set(
    ctx.entries
      .filter((e) =>
        allocationIds.has(
          e.allocationId,
        ),
      )
      .map((e) => e.groupId),
  ).size;
}

/**
 * Higher score = harder to place = scheduled earlier.
 */
export function placementDifficulty(
  ctx: EngineContext,
  alloc: EngineAllocation,
  remaining: number,
): number {
  let score = 0;

  score +=
    (slotsNeeded(ctx, alloc) - 1) *
    1000;

  const teacher =
    ctx.teachers.get(
      alloc.teacherId,
    );

  if (teacher) {
    if (
      teacher.employmentType ===
      'PART_TIME'
    ) {
      score += 600;
    }

    const days =
      teacher.availability.length ||
      ctx.workingDays.length;

    score +=
      (10 - Math.min(10, days)) *
      40;

    if (
      teacher.maxDailyLectures > 0
    ) {
      score +=
        (6 -
          Math.min(
            6,
            teacher.maxDailyLectures,
          )) *
        30;
    }
  }

  const subject =
    ctx.subjects.get(
      alloc.subjectId,
    );

  if (
    subject?.roomType === 'LAB'
  ) {
    score += 120;
  }

  /**
   * Common Groups are slightly more constrained
   * because every participating class must be free.
   */
  if (
    alloc.isCommon &&
    alloc.commonGroupId
  ) {
    const members =
      getUnitAllocations(
        ctx,
        alloc,
      );

    score +=
      members.length * 150;
  }

  score += remaining * 10;

  return score;
}

interface WorkItem {
  allocations: EngineAllocation[];
  representative: EngineAllocation;
  remaining: number;
}

/**
 * Build outstanding work.
 *
 * A Common Group appears ONLY ONCE here.
 */
function outstanding(
  ctx: EngineContext,
): WorkItem[] {
  const items: WorkItem[] = [];

  for (const allocations of schedulingUnits(
    ctx,
  )) {
    const representative =
      allocations[0];

    const remaining =
      representative.weeklyLectures -
      scheduledGroupsForUnit(
        ctx,
        allocations,
      );

    if (remaining > 0) {
      items.push({
        allocations,
        representative,
        remaining,
      });
    }
  }

  return items;
}

/**
 * Add one lecture block.
 *
 * Normal:
 *
 *   one allocation -> one group
 *
 * Common Group:
 *
 *   multiple allocations -> ONE group
 */
function commit(
  ctx: EngineContext,
  added: EngineEntry[],
  allocations: EngineAllocation[],
  day: Weekday,
  window: string[],
  ids: { n: number },
) {
  const groupId =
    newId(ids);

  for (const allocation of allocations) {
    for (const slotId of window) {
      const entry: EngineEntry = {
        id: newId(ids),
        groupId,
        day,
        timeSlotId: slotId,
        allocationId:
          allocation.id,
      };

      ctx.entries.push(entry);
      added.push(entry);
    }
  }

  return groupId;
}

/**
 * Checks whether EVERY allocation in a unit can occupy
 * the exact same day/time.
 */
function unitCanUseWindow(
  ctx: EngineContext,
  allocations: EngineAllocation[],
  day: Weekday,
  window: string[],
  ignoreGroupId: string | null,
): boolean {
  for (const allocation of allocations) {
    if (
      checkPlacementDetailed(
        ctx,
        allocation.id,
        day,
        window,
        ignoreGroupId,
      ).length > 0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Try to place one block.
 *
 * For Common Groups all allocations are checked together.
 */
function tryPlaceOnce(
  ctx: EngineContext,
  added: EngineEntry[],
  allocations: EngineAllocation[],
  windows: string[][],
  rand: () => number,
  ids: { n: number },
): boolean {
  const allocationIds =
    new Set(
      allocations.map(
        (a) => a.id,
      ),
    );

  const used =
    new Set<Weekday>();

  for (const entry of ctx.entries) {
    if (
      allocationIds.has(
        entry.allocationId,
      )
    ) {
      used.add(entry.day);
    }
  }

  const days =
    shuffled(
      ctx.workingDays,
      rand,
    ).sort(
      (a, b) =>
        (used.has(a) ? 1 : 0) -
        (used.has(b) ? 1 : 0),
    );

  for (const day of days) {
    for (const w of shuffled(
      windows,
      rand,
    )) {
      if (
        unitCanUseWindow(
          ctx,
          allocations,
          day,
          w,
          null,
        )
      ) {
        commit(
          ctx,
          added,
          allocations,
          day,
          w,
          ids,
        );

        return true;
      }
    }
  }

  return false;
}

/**
 * Get all allocations participating in a timetable group.
 */
function getGroupAllocations(
  ctx: EngineContext,
  groupId: string,
): EngineAllocation[] {
  const ids = [
    ...new Set(
      ctx.entries
        .filter(
          (e) =>
            e.groupId ===
            groupId,
        )
        .map(
          (e) =>
            e.allocationId,
        ),
    ),
  ];

  return ids
    .map((id) =>
      ctx.allocations.get(id),
    )
    .filter(
      (
        a,
      ): a is EngineAllocation =>
        Boolean(a),
    );
}

/**
 * Return the number of periods occupied by ONE allocation
 * inside a group.
 *
 * For Common Group:
 *
 *   FYBCOM  -> 1 period
 *   FYBCOMMS -> 1 period
 *
 * Total entries = 2, but lecture length = 1.
 */
function groupWindowLength(
  ctx: EngineContext,
  groupId: string,
  allocationId: string,
): number {
  return ctx.entries.filter(
    (e) =>
      e.groupId === groupId &&
      e.allocationId ===
        allocationId,
  ).length;
}

/**
 * Move an entire existing group in the in-memory engine.
 *
 * IMPORTANT:
 *
 * For Common Group, ALL allocations move together.
 */
function moveExistingGroup(
  ctx: EngineContext,
  groupId: string,
  day: Weekday,
  window: string[],
): boolean {
  const allocations =
    getGroupAllocations(
      ctx,
      groupId,
    );

  if (
    allocations.length === 0
  ) {
    return false;
  }

  /**
   * Validate every allocation first.
   */
  for (const allocation of allocations) {
    if (
      checkPlacementDetailed(
        ctx,
        allocation.id,
        day,
        window,
        groupId,
      ).length > 0
    ) {
      return false;
    }
  }

  /**
   * Find the existing entries.
   */
  const entries =
    ctx.entries.filter(
      (e) =>
        e.groupId ===
        groupId,
    );

  /**
   * Move every allocation's entries
   * to the SAME new window.
   */
  for (const allocation of allocations) {
    const allocationEntries =
      entries
        .filter(
          (e) =>
            e.allocationId ===
            allocation.id,
        )
        .sort(
          (a, b) =>
            ctx.slots.findIndex(
              (s) =>
                s.id ===
                a.timeSlotId,
            ) -
            ctx.slots.findIndex(
              (s) =>
                s.id ===
                b.timeSlotId,
            ),
        );

    if (
      allocationEntries.length !==
      window.length
    ) {
      return false;
    }

    allocationEntries.forEach(
      (entry, index) => {
        entry.day = day;
        entry.timeSlotId =
          window[index];
      },
    );
  }

  return true;
}

/**
 * Single-level backtracking.
 *
 * If a candidate window is blocked by exactly ONE timetable group,
 * move that ENTIRE group somewhere else.
 *
 * This is Common Group safe:
 *
 *   FYBCOM + FYBCOMMS
 *
 * are moved together.
 */
function repairPlace(
  ctx: EngineContext,
  added: EngineEntry[],
  allocations: EngineAllocation[],
  rand: () => number,
  ids: { n: number },
): boolean {
  const representative =
    allocations[0];

  const windows =
    consecutiveWindows(
      ctx,
      slotsNeeded(
        ctx,
        representative,
      ),
    );

  for (const day of shuffled(
    ctx.workingDays,
    rand,
  )) {
    for (const w of shuffled(
      windows,
      rand,
    )) {
      const blockers = [
        ...new Set(
          ctx.entries
            .filter(
              (e) =>
                e.day === day &&
                w.includes(
                  e.timeSlotId,
                ),
            )
            .map(
              (e) =>
                e.groupId,
            ),
        ),
      ];

      if (
        blockers.length !== 1
      ) {
        continue;
      }

      const blockerGroup =
        blockers[0];

      /**
       * The requested lecture must fit once
       * the blocker is removed.
       */
      if (
        !unitCanUseWindow(
          ctx,
          allocations,
          day,
          w,
          blockerGroup,
        )
      ) {
        continue;
      }

      const blockerAllocations =
        getGroupAllocations(
          ctx,
          blockerGroup,
        );

      if (
        blockerAllocations.length ===
        0
      ) {
        continue;
      }

      const blockerRepresentative =
        blockerAllocations[0];

      const blockerLength =
        groupWindowLength(
          ctx,
          blockerGroup,
          blockerRepresentative.id,
        );

      if (
        blockerLength <= 0
      ) {
        continue;
      }

      const blockerWindows =
        consecutiveWindows(
          ctx,
          blockerLength,
        );

      /**
       * Save original positions so we can roll back.
       */
      const blockerEntries =
        ctx.entries.filter(
          (e) =>
            e.groupId ===
            blockerGroup,
        );

      const originalPositions =
        blockerEntries.map(
          (e) => ({
            entry: e,
            day: e.day,
            timeSlotId:
              e.timeSlotId,
          }),
        );

      for (const bDay of shuffled(
        ctx.workingDays,
        rand,
      )) {
        for (const bw of shuffled(
          blockerWindows,
          rand,
        )) {
          /**
           * Don't move the blocker to exactly
           * the same position.
           */
          if (
            bDay === day &&
            bw[0] === w[0]
          ) {
            continue;
          }

          /**
           * Check whether the ENTIRE blocker group
           * can move.
           */
          let blockerCanMove =
            true;

          for (const blockerAllocation of blockerAllocations) {
            if (
              checkPlacementDetailed(
                ctx,
                blockerAllocation.id,
                bDay,
                bw,
                blockerGroup,
              ).length > 0
            ) {
              blockerCanMove =
                false;
              break;
            }
          }

          if (
            !blockerCanMove
          ) {
            continue;
          }

          /**
           * Temporarily move the complete blocker.
           */
          if (
            !moveExistingGroup(
              ctx,
              blockerGroup,
              bDay,
              bw,
            )
          ) {
            continue;
          }

          /**
           * Re-check requested lecture.
           */
          if (
            !unitCanUseWindow(
              ctx,
              allocations,
              day,
              w,
              null,
            )
          ) {
            /**
             * Roll back blocker.
             */
            for (const original of originalPositions) {
              original.entry.day =
                original.day;

              original.entry.timeSlotId =
                original.timeSlotId;
            }

            continue;
          }

          /**
           * Requested lecture fits.
           */
          commit(
            ctx,
            added,
            allocations,
            day,
            w,
            ids,
          );

          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Collect representative failure explanations.
 */
function sampleFailureReasons(
  ctx: EngineContext,
  allocations: EngineAllocation[],
): string[] {
  const representative =
    allocations[0];

  const windows =
    consecutiveWindows(
      ctx,
      slotsNeeded(
        ctx,
        representative,
      ),
    );

  const tally =
    new Map<
      string,
      number
    >();

  for (const day of ctx.workingDays) {
    for (const w of windows) {
      for (const allocation of allocations) {
        for (const v of checkPlacementDetailed(
          ctx,
          allocation.id,
          day,
          w,
          null,
        )) {
          tally.set(
            v.code,
            (tally.get(
              v.code,
            ) ?? 0) + 1,
          );
        }
      }
    }
  }

  return [
    ...tally.entries(),
  ]
    .sort(
      (a, b) =>
        b[1] - a[1],
    )
    .slice(0, 3)
    .map(
      ([code, count]) =>
        `${code} blocked ${count} candidate slot(s)`,
    );
}

/**
 * AUTO GENERATE
 */
export function generateTimetable(
  ctx: EngineContext,
  seed = 20260920,
): GenerationResult {
  const rand =
    makeRandom(seed);

  const ids = {
    n: 0,
  };

  const added: EngineEntry[] =
    [];

  let repairedGroups = 0;

  // -----------------------------------------------------------
  // Pass 1: most-constrained-first greedy
  // -----------------------------------------------------------

  const pass1 =
    outstanding(ctx).sort(
      (a, b) =>
        placementDifficulty(
          ctx,
          b.representative,
          b.remaining,
        ) -
        placementDifficulty(
          ctx,
          a.representative,
          a.remaining,
        ),
    );

  for (const item of pass1) {
    const windows =
      consecutiveWindows(
        ctx,
        slotsNeeded(
          ctx,
          item.representative,
        ),
      );

    for (
      let k = 0;
      k < item.remaining;
      k++
    ) {
      if (
        !tryPlaceOnce(
          ctx,
          added,
          item.allocations,
          windows,
          rand,
          ids,
        )
      ) {
        break;
      }
    }
  }

  // -----------------------------------------------------------
  // Pass 2: bounded backtracking repair
  // -----------------------------------------------------------

  for (
    let round = 0;
    round < 3;
    round++
  ) {
    const short =
      outstanding(ctx).sort(
        (a, b) =>
          placementDifficulty(
            ctx,
            b.representative,
            b.remaining,
          ) -
          placementDifficulty(
            ctx,
            a.representative,
            a.remaining,
          ),
      );

    if (
      short.length === 0
    ) {
      break;
    }

    let progressed =
      false;

    for (const item of short) {
      for (
        let k = 0;
        k < item.remaining;
        k++
      ) {
        if (
          repairPlace(
            ctx,
            added,
            item.allocations,
            rand,
            ids,
          )
        ) {
          repairedGroups += 1;
          progressed =
            true;
        } else {
          break;
        }
      }
    }

    if (!progressed) {
      break;
    }
  }

  // -----------------------------------------------------------
  // Report
  // -----------------------------------------------------------

  const shortfalls: GenerationShortfall[] =
    outstanding(ctx).map(
      (item) => {
        const representative =
          item.representative;

        return {
          allocationId:
            representative.id,

          subjectCode:
            ctx.subjects.get(
              representative.subjectId,
            )?.code ?? '?',

          teacherName:
            ctx.teachers.get(
              representative.teacherId,
            )?.name ?? '?',

          className:
            ctx.classes.get(
              representative.classId,
            )?.label ?? '?',

          required:
            representative.weeklyLectures,

          placed:
            scheduledGroupsForUnit(
              ctx,
              item.allocations,
            ),

          sampleReasons:
            sampleFailureReasons(
              ctx,
              item.allocations,
            ),
        };
      },
    );

  return {
    placedGroups:
      new Set(
        added.map(
          (e) => e.groupId,
        ),
      ).size,

    placedPeriods:
      added.length,

    repairedGroups,

    shortfalls,

    entries: added,

    complete:
      shortfalls.length === 0,
  };
}