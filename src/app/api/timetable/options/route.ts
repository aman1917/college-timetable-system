import { handleError, ok, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';
import { unscheduledPool } from '@/lib/validation';
import { validTargets } from '@/lib/collision';
import { prisma } from '@/lib/prisma';

/**
 * One request returns the whole builder payload: grid, entries, pool, and —
 * when ?allocationId= or ?groupId= is supplied — the legal drop targets.
 *
 * Targets are computed server-side so highlighted cells come from the
 * authoritative engine, not a client approximation that could drift from it.
 */
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const allocationId = url.searchParams.get('allocationId');
    const groupId = url.searchParams.get('groupId');

    const [ctx, settings] = await Promise.all([
      loadContext(),
      prisma.appSetting.findUnique({ where: { id: 'singleton' } }),
    ]);

    let targetAllocationId = allocationId;
    if (!targetAllocationId && groupId) {
      targetAllocationId = ctx.entries.find((e) => e.groupId === groupId)?.allocationId ?? null;
    }
    const targets = targetAllocationId ? [...validTargets(ctx, targetAllocationId, groupId)] : [];

    return ok({
      workingDays: ctx.workingDays,
      slots: ctx.slots,
      entries: ctx.entries,
      allocations: [...ctx.allocations.values()],
      teachers: [...ctx.teachers.values()],
      subjects: [...ctx.subjects.values()],
      classes: [...ctx.classes.values()],
      rooms: [...ctx.rooms.values()],
      pool: unscheduledPool(ctx).map((p) => ({
        allocationId: p.allocation.id,
        remaining: p.remaining,
        periodsEach: p.periodsEach,
        subjectCode: p.subject?.code ?? '?',
        subjectName: p.subject?.name ?? '?',
        color: p.subject?.color ?? '#999999',
        teacherName: p.teacher?.name ?? '?',
        className: p.klass?.label ?? '?',
        roomName: p.room?.name ?? null,
      })),
      targets,
      status: settings?.timetableStatus ?? 'DRAFT',
      collegeName: settings?.collegeName ?? 'College',
    });
  } catch (error) {
    return handleError(error);
  }
}
