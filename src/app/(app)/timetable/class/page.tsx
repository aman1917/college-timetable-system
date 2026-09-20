import Link from 'next/link';
import { loadContext } from '@/lib/timetable-service';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ColorLegend, TimetableGrid } from '@/components/TimetableGrid';
import { EmptyState, PageHeader } from '@/components/ui';
import { makeLectureLookup } from '../viewHelpers';
import { ExportButtons } from '@/components/ExportButtons';

export const dynamic = 'force-dynamic';

export default async function ClassTimetablePage({
  searchParams,
}: {
  searchParams: { classId?: string };
}) {
  const { classId } = searchParams;
  const [session, ctx, settings] = await Promise.all([
    getSession(),
    loadContext(),
    prisma.appSetting.findUnique({ where: { id: 'singleton' } }),
  ]);

  // Teachers only see the timetable once it has been published.
  if (session?.role !== 'ADMIN' && settings?.timetableStatus !== 'PUBLISHED') {
    return (
      <>
        <PageHeader title="🏫 Class-wise Timetable" />
        <EmptyState message="The timetable has not been published yet. It will appear here once the administrator publishes it." />
      </>
    );
  }

  const classes = [...ctx.classes.values()].sort((a, b) => a.label.localeCompare(b.label));
  const selected = classId ? ctx.classes.get(classId) : classes[0];

  if (!selected) {
    return (
      <>
        <PageHeader title="🏫 Class-wise Timetable" />
        <EmptyState message="No classes have been created yet." />
      </>
    );
  }

  // const { lectureAt, subjects } = makeLectureLookup(
  const { lectures, subjects } = makeLectureLookup(
    ctx,
    (allocationId) => ctx.allocations.get(allocationId)?.classId === selected.id,
  );

  return (
    <>
      <PageHeader
        title="🏫 Class-wise Timetable"
        subtitle={selected.label}
        actions={<ExportButtons kind="class" id={selected.id} label={selected.label} />}
      />

      <div className="no-print panel mb-4 flex flex-wrap gap-2 p-3">
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/timetable/class?classId=${c.id}`}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              c.id === selected.id ? 'border-brand bg-brand text-white' : 'border-line hover:bg-brand/10'
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <TimetableGrid
        days={ctx.workingDays}
        slots={ctx.slots}
        // lectureAt={lectureAt}
        lectures={lectures}
        show={{ teacher: true, room: true }}
      />
      <ColorLegend subjects={subjects} />
    </>
  );
}
