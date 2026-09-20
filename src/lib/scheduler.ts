/**
 * AUTOMATIC TIMETABLE GENERATION.
 *
 * Runs entirely on top of `checkPlacement`, so a generated timetable is legal by
 * exactly the same rules a hand-built one is. The solver never relaxes a hard
 * constraint to finish: if the grid genuinely cannot fit a requirement, it
 * reports the shortfall rather than producing a conflicted schedule.
 *
 *   Pass 1 — most-constrained-first greedy placement.
 *   Pass 2 — single-level backtracking repair: for anything still short, try
 *            relocating ONE blocking lecture to free the slot.
 *
 * This is a heuristic, not an exhaustive solver. Timetabling is NP-hard; for
 * realistic college inputs this reaches a complete schedule, and where it
 * cannot it tells you precisely what is short and why.
 */

import {
  checkPlacementDetailed,
  consecutiveWindows,
  slotsNeeded,
} from './collision';
import type { EngineAllocation, EngineContext, EngineEntry, Weekday } from './domain';

export interface GenerationShortfall {
  allocationId: string;
  subjectCode: string;
  teacherName: string;
  className: string;
  required: number;
  placed: number;
  /** Why the next placement failed, sampled from the least-bad attempt. */
  sampleReasons: string[];
}

export interface GenerationResult {
  placedGroups: number;
  placedPeriods: number;
  repairedGroups: number;
  shortfalls: GenerationShortfall[];
  /** New entries to persist. The caller writes them in one transaction. */
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

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function newId(counter: { n: number }): string {
  counter.n += 1;
  return `gen_${Date.now().toString(36)}_${counter.n.toString(36)}`;
}

/** How many separate lecture blocks of this allocation are already on the grid. */
function scheduledGroups(ctx: EngineContext, allocationId: string): number {
  return new Set(ctx.entries.filter((e) => e.allocationId === allocationId).map((e) => e.groupId)).size;
}

/**
 * Higher score = harder to place = scheduled earlier.
 *
 * Getting this ordering right matters more than any other single choice in the
 * solver: placing flexible full-time theory lectures first fragments the grid
 * and strands the constrained ones (multi-period practicals, part-time staff
 * with a three-day, five-hour window).
 */
export function placementDifficulty(ctx: EngineContext, alloc: EngineAllocation, remaining: number): number {
  let score = 0;
  score += (slotsNeeded(ctx, alloc) - 1) * 1000; // multi-period blocks are hardest

  const teacher = ctx.teachers.get(alloc.teacherId);
  if (teacher) {
    if (teacher.employmentType === 'PART_TIME') score += 600;
    const days = teacher.availability.length || ctx.workingDays.length;
    score += (10 - Math.min(10, days)) * 40;
    if (teacher.maxDailyLectures > 0) score += (6 - Math.min(6, teacher.maxDailyLectures)) * 30;
  }

  const subject = ctx.subjects.get(alloc.subjectId);
  if (subject?.roomType === 'LAB') score += 120; // labs are a scarce resource

  score += remaining * 10;
  return score;
}

interface WorkItem {
  alloc: EngineAllocation;
  remaining: number;
}

function outstanding(ctx: EngineContext): WorkItem[] {
  const items: WorkItem[] = [];
  for (const alloc of ctx.allocations.values()) {
    if (alloc.status !== 'ACTIVE') continue;
    const remaining = alloc.weeklyLectures - scheduledGroups(ctx, alloc.id);
    if (remaining > 0) items.push({ alloc, remaining });
  }
  return items;
}

function commit(ctx: EngineContext, added: EngineEntry[], alloc: EngineAllocation, day: Weekday, window: string[], ids: { n: number }) {
  const groupId = newId(ids);
  for (const slotId of window) {
    const entry: EngineEntry = { id: newId(ids), groupId, day, timeSlotId: slotId, allocationId: alloc.id };
    ctx.entries.push(entry);
    added.push(entry);
  }
  return groupId;
}

/** Try to seat one block of `alloc`, preferring days it doesn't already occupy. */
function tryPlaceOnce(
  ctx: EngineContext,
  added: EngineEntry[],
  alloc: EngineAllocation,
  windows: string[][],
  rand: () => number,
  ids: { n: number },
): boolean {
  const used = new Set(ctx.entries.filter((e) => e.allocationId === alloc.id).map((e) => e.day));
  // Spreading a subject across the week is a soft preference, so it is expressed
  // as ordering rather than as a constraint that could block a valid timetable.
  const days = shuffled(ctx.workingDays, rand).sort(
    (a, b) => (used.has(a) ? 1 : 0) - (used.has(b) ? 1 : 0),
  );

  for (const day of days) {
    for (const w of shuffled(windows, rand)) {
      if (checkPlacementDetailed(ctx, alloc.id, day, w, null).length === 0) {
        commit(ctx, added, alloc, day, w, ids);
        return true;
      }
    }
  }
  return false;
}

/**
 * Single-level backtracking: find a window blocked by exactly ONE existing
 * lecture, check that lecture can live somewhere else, move it, and take its
 * place. Bounded to one level deep to keep generation fast and predictable.
 */
function repairPlace(
  ctx: EngineContext,
  added: EngineEntry[],
  alloc: EngineAllocation,
  rand: () => number,
  ids: { n: number },
): boolean {
  const windows = consecutiveWindows(ctx, slotsNeeded(ctx, alloc));

  for (const day of shuffled(ctx.workingDays, rand)) {
    for (const w of shuffled(windows, rand)) {
      const blockers = [
        ...new Set(ctx.entries.filter((e) => e.day === day && w.includes(e.timeSlotId)).map((e) => e.groupId)),
      ];
      if (blockers.length !== 1) continue;

      const blockerGroup = blockers[0];
      const blockerEntries = ctx.entries
        .filter((e) => e.groupId === blockerGroup)
        .sort(
          (a, b) =>
            ctx.slots.findIndex((s) => s.id === a.timeSlotId) -
            ctx.slots.findIndex((s) => s.id === b.timeSlotId),
        );
      const blockerAlloc = ctx.allocations.get(blockerEntries[0]?.allocationId ?? '');
      if (!blockerAlloc) continue;

      // Would we actually fit once the blocker steps aside?
      if (checkPlacementDetailed(ctx, alloc.id, day, w, blockerGroup).length > 0) continue;

      const blockerWindows = consecutiveWindows(ctx, blockerEntries.length);
      const original = blockerEntries.map((e) => ({ day: e.day, timeSlotId: e.timeSlotId }));

      for (const bDay of shuffled(ctx.workingDays, rand)) {
        for (const bw of shuffled(blockerWindows, rand)) {
          if (bDay === day && bw[0] === w[0]) continue;
          if (checkPlacementDetailed(ctx, blockerAlloc.id, bDay, bw, blockerGroup).length > 0) continue;

          // Move the blocker...
          blockerEntries.forEach((e, i) => {
            e.day = bDay;
            e.timeSlotId = bw[i];
          });

          // ...then re-verify from scratch before taking the vacated slot.
          if (checkPlacementDetailed(ctx, alloc.id, day, w, null).length > 0) {
            blockerEntries.forEach((e, i) => {
              e.day = original[i].day as Weekday;
              e.timeSlotId = original[i].timeSlotId;
            });
            continue;
          }

          commit(ctx, added, alloc, day, w, ids);
          return true;
        }
      }
    }
  }
  return false;
}

/** Collect a representative failure explanation for a shortfall report. */
function sampleFailureReasons(ctx: EngineContext, alloc: EngineAllocation): string[] {
  const windows = consecutiveWindows(ctx, slotsNeeded(ctx, alloc));
  const tally = new Map<string, number>();
  for (const day of ctx.workingDays) {
    for (const w of windows) {
      for (const v of checkPlacementDetailed(ctx, alloc.id, day, w, null)) {
        tally.set(v.code, (tally.get(v.code) ?? 0) + 1);
      }
    }
  }
  // The constraint that blocked the most candidate windows is the real cause.
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => `${code} blocked ${count} candidate slot(s)`);
}

export function generateTimetable(ctx: EngineContext, seed = 20260920): GenerationResult {
  const rand = makeRandom(seed);
  const ids = { n: 0 };
  const added: EngineEntry[] = [];
  let repairedGroups = 0;

  // ---- Pass 1: most-constrained-first greedy ----
  const pass1 = outstanding(ctx).sort(
    (a, b) =>
      placementDifficulty(ctx, b.alloc, b.remaining) - placementDifficulty(ctx, a.alloc, a.remaining),
  );
  for (const item of pass1) {
    const windows = consecutiveWindows(ctx, slotsNeeded(ctx, item.alloc));
    for (let k = 0; k < item.remaining; k++) {
      if (!tryPlaceOnce(ctx, added, item.alloc, windows, rand, ids)) break;
    }
  }

  // ---- Pass 2: bounded backtracking repair ----
  for (let round = 0; round < 3; round++) {
    const short = outstanding(ctx).sort(
      (a, b) =>
        placementDifficulty(ctx, b.alloc, b.remaining) - placementDifficulty(ctx, a.alloc, a.remaining),
    );
    if (short.length === 0) break;

    let progressed = false;
    for (const item of short) {
      for (let k = 0; k < item.remaining; k++) {
        if (repairPlace(ctx, added, item.alloc, rand, ids)) {
          repairedGroups += 1;
          progressed = true;
        } else break;
      }
    }
    if (!progressed) break;
  }

  // ---- Report ----
  const shortfalls: GenerationShortfall[] = outstanding(ctx).map((item) => ({
    allocationId: item.alloc.id,
    subjectCode: ctx.subjects.get(item.alloc.subjectId)?.code ?? '?',
    teacherName: ctx.teachers.get(item.alloc.teacherId)?.name ?? '?',
    className: ctx.classes.get(item.alloc.classId)?.label ?? '?',
    required: item.alloc.weeklyLectures,
    placed: scheduledGroups(ctx, item.alloc.id),
    sampleReasons: sampleFailureReasons(ctx, item.alloc),
  }));

  return {
    placedGroups: new Set(added.map((e) => e.groupId)).size,
    placedPeriods: added.length,
    repairedGroups,
    shortfalls,
    entries: added,
    complete: shortfalls.length === 0,
  };
}
