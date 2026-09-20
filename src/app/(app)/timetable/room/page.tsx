import Link from 'next/link';
import { loadContext } from '@/lib/timetable-service';
import { ColorLegend, TimetableGrid } from '@/components/TimetableGrid';
import { EmptyState, PageHeader } from '@/components/ui';
import { lectureSlots } from '@/lib/collision';
import { makeLectureLookup } from '../viewHelpers';
import { ExportButtons } from '@/components/ExportButtons';

export const dynamic = 'force-dynamic';

export default async function RoomTimetablePage({
  searchParams,
}: {
  searchParams: { roomId?: string };
}) {
  const { roomId } = searchParams;
  const ctx = await loadContext();

  const rooms = [...ctx.rooms.values()].sort((a, b) => a.name.localeCompare(b.name));
  const selected = roomId ? ctx.rooms.get(roomId) : rooms[0];

  if (!selected) {
    return (
      <>
        <PageHeader title="🚪 Room-wise Timetable" />
        <EmptyState message="No rooms have been created yet." />
      </>
    );
  }

  // const { lectureAt, entries, subjects } = makeLectureLookup(
  const { lectures, entries, subjects } = makeLectureLookup(
    ctx,
    (allocationId) => ctx.allocations.get(allocationId)?.roomId === selected.id,
  );
  const capacity = ctx.workingDays.length * lectureSlots(ctx).length;

  return (
    <>
      <PageHeader
        title="🚪 Room-wise Timetable"
        subtitle={`${selected.name} · ${selected.type.toLowerCase()}`}
        actions={<ExportButtons kind="room" id={selected.id} label={selected.name} />}
      />

      <div className="no-print panel mb-4 flex flex-wrap gap-2 p-3">
        {rooms.map((r) => (
          <Link
            key={r.id}
            href={`/timetable/room?roomId=${r.id}`}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              r.id === selected.id ? 'border-brand bg-brand text-white' : 'border-line hover:bg-brand/10'
            }`}
          >
            {r.name}
          </Link>
        ))}
      </div>

      <div className="panel mb-4 p-4 text-sm text-muted">
        Utilisation: <b className="text-ink">{entries.length}</b> of {capacity} period slots (
        {capacity ? Math.round((entries.length / capacity) * 100) : 0}%)
      </div>

      <TimetableGrid
        days={ctx.workingDays}
        slots={ctx.slots}
        // lectureAt={lectureAt}
        lectures={lectures}
        show={{ teacher: true, klass: true, room: false }}
        emptyLabel="Vacant"
      />
      <ColorLegend subjects={subjects} />
    </>
  );
}
