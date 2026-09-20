import Link from 'next/link';
import { loadContext } from '@/lib/timetable-service';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ColorLegend, LectureCard } from '@/components/TimetableGrid';
import { EmptyState, PageHeader } from '@/components/ui';
import { WEEKDAY_LABEL, type Weekday } from '@/lib/domain';
import { makeLectureLookup } from '../viewHelpers';
import { ExportButtons } from '@/components/ExportButtons';

export const dynamic = 'force-dynamic';

export default async function MasterTimetablePage({
  searchParams,
}: {
  searchParams: { mode?: string; day?: string };
}) {
  const params = searchParams;
  const mode = params.mode === 'tree' ? 'tree' : 'columns';

  const [session, ctx, settings] = await Promise.all([
    getSession(),
    loadContext(),
    prisma.appSetting.findUnique({ where: { id: 'singleton' } }),
  ]);

  if (session?.role !== 'ADMIN' && settings?.timetableStatus !== 'PUBLISHED') {
    return (
      <>
        <PageHeader title="🌐 General / Master Timetable" />
        <EmptyState message="The timetable has not been published yet." />
      </>
    );
  }

  const classes = [...ctx.classes.values()].sort((a, b) => a.label.localeCompare(b.label));
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="🌐 General / Master Timetable" />
        <EmptyState message="No classes have been created yet." />
      </>
    );
  }

  // Mode 1 shows one day at a time with a column per class — a full week across
  // every class at once is unreadable past a handful of divisions.
  const day = (params.day as Weekday) ?? ctx.workingDays[0];
  const all = makeLectureLookup(ctx, () => true);

  // Built once per class, not once per cell: the grid renders
  // slots × classes cells, and rebuilding the lookup inside that loop would
  // rescan every entry thousands of times on a real college's data.
  const perClass = new Map(
    classes.map((c) => [
      c.id,
      makeLectureLookup(ctx, (allocationId) => ctx.allocations.get(allocationId)?.classId === c.id),
    ]),
  );

  const modeSwitch = (
    <div className="no-print panel mb-4 flex flex-wrap items-center gap-2 p-3">
      <Link
        href="/timetable/master?mode=columns"
        className={`rounded-lg border px-2.5 py-1 text-xs ${mode === 'columns' ? 'border-brand bg-brand text-white' : 'border-line hover:bg-brand/10'}`}
      >
        Mode 1 — Class Columns
      </Link>
      <Link
        href="/timetable/master?mode=tree"
        className={`rounded-lg border px-2.5 py-1 text-xs ${mode === 'tree' ? 'border-brand bg-brand text-white' : 'border-line hover:bg-brand/10'}`}
      >
        Mode 2 — Hierarchical
      </Link>
      {mode === 'columns' && (
        <>
          <span className="ml-2 text-xs text-muted">Day:</span>
          {ctx.workingDays.map((d) => (
            <Link
              key={d}
              href={`/timetable/master?mode=columns&day=${d}`}
              className={`rounded-lg border px-2 py-1 text-xs ${d === day ? 'border-brand bg-brand text-white' : 'border-line hover:bg-brand/10'}`}
            >
              {WEEKDAY_LABEL[d].slice(0, 3)}
            </Link>
          ))}
        </>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="🌐 General / Master Timetable"
        subtitle="Built from exactly the same master data as every other view."
        actions={<ExportButtons kind="master" id="all" label="Master Timetable" />}
      />
      {modeSwitch}

      {mode === 'columns' ? (
        <div className="panel overflow-x-auto">
          <table className="w-full border-separate border-spacing-0" style={{ minWidth: 160 + classes.length * 150 }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-[2] min-w-[92px] border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold">
                  {WEEKDAY_LABEL[day]}
                </th>
                {classes.map((c) => (
                  <th key={c.id} className="border border-line bg-brand/10 px-2 py-2 text-[10.5px] font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctx.slots.map((slot) => {
                const blocked = slot.type !== 'LECTURE' || !slot.isActive;
                return (
                  <tr key={slot.id}>
                    <td className="sticky left-0 z-[1] whitespace-nowrap border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold text-muted">
                      {slot.startTime} – {slot.endTime}
                    </td>
                    {blocked ? (
                      <td
                        colSpan={classes.length}
                        className="border border-line bg-amber-500/10 px-2 py-2 text-center text-[11px] font-bold text-amber-600 dark:text-amber-400"
                      >
                        {slot.type === 'LECTURE' ? 'INACTIVE' : slot.type}
                      </td>
                    ) : (
                      classes.map((c) => {
                        // const lecture = perClass.get(c.id)!.lectureAt(day, slot.id);
                        const lecture = perClass.get(c.id)!.lectures[`${day}:${slot.id}`] ?? null;
                        return (
                          <td key={c.id} className="h-16 border border-line bg-panel p-1 align-top">
                            {lecture ? (
                              <LectureCard lecture={lecture} show={{ teacher: true, room: true }} />
                            ) : (
                              <div className="flex h-full min-h-[52px] items-center justify-center text-[11px] text-muted">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {[...ctx.classes.values()]
            .reduce<{ streamLabel: string; items: typeof classes }[]>((groups, c) => {
              // Classes are labelled "TY BSCIT A (Sem 5)" — group by the stream token.
              const streamLabel = c.label.split(' ')[1] ?? 'Other';
              const found = groups.find((g) => g.streamLabel === streamLabel);
              if (found) found.items.push(c);
              else groups.push({ streamLabel, items: [c] });
              return groups;
            }, [])
            .map((group) => (
              <div key={group.streamLabel} className="panel p-4">
                <h3 className="mb-2 font-bold">{group.streamLabel}</h3>
                {group.items.map((c) => {
                  const counts = perClass.get(c.id)!;
                  return (
                    <details key={c.id} className="mb-2 border-l-2 border-line pl-3">
                      <summary className="cursor-pointer py-1 text-sm font-semibold">
                        {c.label}{' '}
                        <span className="font-normal text-muted">
                          ({counts.entries.length} period{counts.entries.length === 1 ? '' : 's'})
                        </span>
                      </summary>
                      <div className="mt-2">
                        <Link href={`/timetable/class?classId=${c.id}`} className="text-xs text-brand underline">
                          Open full class timetable →
                        </Link>
                      </div>
                    </details>
                  );
                })}
              </div>
            ))}
        </div>
      )}

      <ColorLegend subjects={all.subjects} />
    </>
  );
}
