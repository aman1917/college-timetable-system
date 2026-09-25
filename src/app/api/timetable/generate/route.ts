import { handleError, HttpError, ok, parseBody, requireAdmin } from '@/lib/api';
import { generateSchema } from '@/lib/schemas';
import { loadContext } from '@/lib/timetable-service';
import { generateTimetable } from '@/lib/scheduler';
import { findExistingConflicts } from '@/lib/collision';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const { seed, clearExisting } = await parseBody(request, generateSchema);

    if (clearExisting) await prisma.timetableEntry.deleteMany({});

    const ctx = await loadContext();
    const result = generateTimetable(ctx, seed ?? Date.now() % 2_147_483_647);

    // console.log(
    //   'COMMON GROUP ALLOCATIONS:',
    //   [...ctx.allocations.values()]
    //     .filter((a) => a.isCommon)
    //     .map((a) => ({
    //       id: a.id,
    //       classId: a.classId,
    //       commonGroupId: a.commonGroupId,
    //       isCommon: a.isCommon,
    //     })),
    // );

    // The engine already guarantees this, but generation writes in bulk, so we
    // verify the whole grid before committing rather than trusting the loop.
    const conflicts = findExistingConflicts(ctx);
    if (conflicts.length > 0) {
      throw new HttpError(500, `Generation aborted — internal conflict check failed:\n${conflicts.join('\n')}`);
    }

    if (result.entries.length > 0) {
      await prisma.timetableEntry.createMany({
        data: result.entries.map((e) => ({
          groupId: e.groupId,
          day: e.day,
          timeSlotId: e.timeSlotId,
          allocationId: e.allocationId,
        })),
      });
    }

    await recordAudit({
      session,
      action: 'GENERATE_TIMETABLE',
      entity: 'Timetable',
      summary: `Auto-generated ${result.placedGroups} lecture block(s)${result.repairedGroups ? `, ${result.repairedGroups} via backtracking` : ''}${result.complete ? '' : `; ${result.shortfalls.length} allocation(s) short`}`,
      after: { placedGroups: result.placedGroups, shortfalls: result.shortfalls.length },
    });
    return ok(result);
  } catch (error) {
    console.error('AUTO GENERATE ERROR:', error);
    return handleError(error);
  }
}
