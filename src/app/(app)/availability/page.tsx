import { loadContext } from '@/lib/timetable-service';
import { computeAllWorkloads } from '@/lib/validation';
import { WEEKDAY_LABEL, type Weekday } from '@/lib/domain';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AvailabilityPage() {
  const ctx = await loadContext();
  const workloads = new Map(computeAllWorkloads(ctx).map((w) => [w.teacherId, w]));
  const teachers = [...ctx.teachers.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="🕐 Teacher Availability"
        subtitle="These windows are hard constraints — the scheduler will not place a lecture outside them."
      />
      <div className="panel overflow-x-auto">
        <table className="table-simple">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Type</th>
              <th>Available windows</th>
              <th>Max/day</th>
              <th>Max/week</th>
              <th>Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => {
              const load = workloads.get(t.id);
              const over = load && t.maxWeeklyLectures > 0 && load.scheduledPeriods > t.maxWeeklyLectures;
              return (
                <tr key={t.id}>
                  <td>
                    <b>{t.name}</b>
                  </td>
                  <td>
                    {t.employmentType === 'PART_TIME' ? (
                      <span className="badge bg-amber-500/15 text-amber-600 dark:text-amber-400">Part-Time</span>
                    ) : (
                      <span className="badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Full-Time</span>
                    )}
                  </td>
                  <td>
                    {t.availability.length === 0 ? (
                      <span className="text-red-600 dark:text-red-400">
                        None set — this teacher cannot be scheduled at all.
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {t.availability.map((a) => (
                          <span
                            key={a.day}
                            className="rounded border border-line px-1.5 py-0.5 text-[11px]"
                          >
                            {WEEKDAY_LABEL[a.day as Weekday].slice(0, 3)} {a.startTime}–{a.endTime}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{t.maxDailyLectures}</td>
                  <td>{t.maxWeeklyLectures}</td>
                  <td className={over ? 'font-bold text-red-600 dark:text-red-400' : ''}>
                    {load?.scheduledPeriods ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
