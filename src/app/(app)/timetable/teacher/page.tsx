import Link from 'next/link';
import { loadContext } from '@/lib/timetable-service';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeWorkload } from '@/lib/validation';
import { ColorLegend, TimetableGrid } from '@/components/TimetableGrid';
import { EmptyState, PageHeader } from '@/components/ui';
import { makeLectureLookup } from '../viewHelpers';
import { ExportButtons } from '@/components/ExportButtons';

export const dynamic = 'force-dynamic';

export default async function TeacherTimetablePage({
  searchParams,
}: {
  searchParams: { teacherId?: string };
}) {
  const { teacherId } = searchParams;
  const [session, ctx, settings] = await Promise.all([
    getSession(),
    loadContext(),
    prisma.appSetting.findUnique({ where: { id: 'singleton' } }),
  ]);

  const isAdmin = session?.role === 'ADMIN';
  if (!isAdmin && settings?.timetableStatus !== 'PUBLISHED') {
    return (
      <>
        <PageHeader title="👩‍🏫 Teacher Timetable" />
        <EmptyState message="The timetable has not been published yet." />
      </>
    );
  }

  const teachers = [...ctx.teachers.values()].sort((a, b) => a.name.localeCompare(b.name));
  // A teacher may only ever view their own timetable here.
  const selected = isAdmin
    ? (teacherId ? ctx.teachers.get(teacherId) : teachers[0])
    : session?.teacherId
      ? ctx.teachers.get(session.teacherId)
      : undefined;

  if (!selected) {
    return (
      <>
        <PageHeader title="👩‍🏫 Teacher Timetable" />
        <EmptyState
          message={
            isAdmin
              ? 'No teachers have been created yet.'
              : 'Your login is not linked to a teacher record. Ask an administrator to link it.'
          }
        />
      </>
    );
  }

  // const { lectureAt, subjects } = makeLectureLookup(
  const { lectures, subjects } = makeLectureLookup(
    ctx,
    (allocationId) => ctx.allocations.get(allocationId)?.teacherId === selected.id,
  );
  const load = computeWorkload(ctx, selected.id);

  return (
    <>
      <PageHeader
        title={isAdmin ? '👩‍🏫 Teacher-wise Timetable' : '🗓️ My Timetable'}
        subtitle={selected.name}
        actions={<ExportButtons kind="teacher" id={selected.id} label={selected.name} />}
      />

      {isAdmin && (
        <div className="no-print panel mb-4 flex flex-wrap gap-2 p-3">
          {teachers.map((t) => (
            <Link
              key={t.id}
              href={`/timetable/teacher?teacherId=${t.id}`}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                t.id === selected.id ? 'border-brand bg-brand text-white' : 'border-line hover:bg-brand/10'
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      <div className="panel mb-4 p-4">
        <div className="text-sm">
          <b>{selected.name}</b>{' '}
          <span className="badge ml-1 bg-brand/15 text-brand">
            {selected.employmentType === 'PART_TIME' ? 'Part-Time' : 'Full-Time'}
          </span>
        </div>
        <div className="mt-2 text-sm text-muted">
          Scheduled <b className="text-ink">{load.scheduledPeriods}</b> period(s)/week · allocated{' '}
          <b className="text-ink">{load.requiredBlocks}</b> block(s) · limit{' '}
          <b className="text-ink">{load.maxWeekly}</b>
          {load.isOverloaded && (
            <span className="badge ml-2 bg-red-500/15 text-red-600 dark:text-red-400">OVERLOADED</span>
          )}
        </div>
        {selected.employmentType === 'PART_TIME' && (
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Availability:{' '}
            {selected.availability.map((a) => `${a.day} ${a.startTime}–${a.endTime}`).join(' · ') || 'none set'}
          </div>
        )}
      </div>

      <TimetableGrid
        days={ctx.workingDays}
        slots={ctx.slots}
        // lectureAt={lectureAt}
        lectures={lectures}
        show={{ teacher: false, klass: true, room: true }}
        emptyLabel="Free"
      />
      <ColorLegend subjects={subjects} />
    </>
  );
}
