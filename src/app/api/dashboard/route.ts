import { handleError, ok, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';
import { computeAllWorkloads, unscheduledPool } from '@/lib/validation';
import { findExistingConflicts } from '@/lib/collision';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireSession();
    const [ctx, settings] = await Promise.all([
      loadContext(),
      prisma.appSetting.findUnique({ where: { id: 'singleton' } }),
    ]);

    const teachers = [...ctx.teachers.values()];
    const workloads = computeAllWorkloads(ctx);
    const allocatedSubjectIds = new Set(
      [...ctx.allocations.values()].filter((a) => a.status === 'ACTIVE').map((a) => a.subjectId),
    );

    return ok({
      totals: {
        teachers: teachers.length,
        fullTime: teachers.filter((t) => t.employmentType === 'FULL_TIME').length,
        partTime: teachers.filter((t) => t.employmentType === 'PART_TIME').length,
        subjects: ctx.subjects.size,
        classes: ctx.classes.size,
        rooms: ctx.rooms.size,
        allocations: ctx.allocations.size,
        entries: ctx.entries.length,
        highWorkload: workloads.filter((w) => w.isOverloaded).length,
        unallocatedSubjects: [...ctx.subjects.values()].filter((s) => !allocatedSubjectIds.has(s.id)).length,
        conflicts: findExistingConflicts(ctx).length,
        pendingBlocks: unscheduledPool(ctx).reduce((n, p) => n + p.remaining, 0),
      },
      status: settings?.timetableStatus ?? 'DRAFT',
      collegeName: settings?.collegeName ?? 'College',
      workloadChart: workloads
        .slice()
        .sort((a, b) => b.requiredBlocks - a.requiredBlocks)
        .slice(0, 12)
        .map((w) => ({ name: w.teacherName, allocated: w.requiredBlocks, scheduled: w.scheduledPeriods })),
      perDayChart: ctx.workingDays.map((day) => ({
        day,
        periods: ctx.entries.filter((e) => e.day === day).length,
      })),
      subjectTypeChart: ['THEORY', 'PRACTICAL', 'TUTORIAL', 'ELECTIVE', 'SPECIAL'].map((type) => ({
        type,
        count: [...ctx.subjects.values()].filter((s) => s.type === type).length,
      })),
      attention: [
        ...findExistingConflicts(ctx).slice(0, 5).map((c) => ({ level: 'error', message: c })),
        ...[...ctx.subjects.values()]
          .filter((s) => !allocatedSubjectIds.has(s.id))
          .slice(0, 5)
          .map((s) => ({ level: 'warn', message: `${s.code} — ${s.name} has no teacher allocated` })),
        ...workloads
          .filter((w) => w.isOverloaded)
          .slice(0, 5)
          .map((w) => ({ level: 'warn', message: `${w.teacherName} is allocated ${w.requiredBlocks} above their limit of ${w.maxWeekly}` })),
      ],
    });
  } catch (error) {
    return handleError(error);
  }
}
