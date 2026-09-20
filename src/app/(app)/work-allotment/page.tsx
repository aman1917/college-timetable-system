import { loadContext } from '@/lib/timetable-service';
import { computeAllWorkloads } from '@/lib/validation';
import { getSession } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { WEEKDAY_LABEL } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export default async function WorkAllotmentPage() {
  const [session, ctx] = await Promise.all([getSession(), loadContext()]);
  const workloads = computeAllWorkloads(ctx);

  // A teacher sees only their own allotment.
  const visible =
    session?.role === 'ADMIN'
      ? workloads
      : workloads.filter((w) => w.teacherId === session?.teacherId);

  return (
    <>
      <PageHeader
        title="📋 Work Allotment"
        subtitle="Derived entirely from subject allocations and the current timetable — never entered by hand, so it cannot drift out of sync."
      />

      {visible.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted">
          No allotment to show. If you are a teacher, ask an administrator to link your login to a teacher record.
        </div>
      ) : (
        visible
          .sort((a, b) => a.teacherName.localeCompare(b.teacherName))
          .map((w) => {
            const allocs = [...ctx.allocations.values()].filter(
              (a) => a.teacherId === w.teacherId && a.status === 'ACTIVE',
            );
            return (
              <div key={w.teacherId} className="panel mb-3 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b>{w.teacherName}</b>{' '}
                    <span className="badge ml-1 bg-brand/15 text-brand">
                      {w.employmentType === 'PART_TIME' ? 'Part-Time' : 'Full-Time'}
                    </span>
                  </div>
                  <div className="text-sm text-muted">
                    {w.requiredBlocks} allocated · {w.scheduledPeriods} scheduled · limit {w.maxWeekly}
                    {w.isOverloaded && (
                      <span className="badge ml-2 bg-red-500/15 text-red-600 dark:text-red-400">OVERLOADED</span>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {ctx.workingDays.map((day) => (
                    <span key={day} className="rounded border border-line px-2 py-0.5 text-[11px]">
                      {WEEKDAY_LABEL[day].slice(0, 3)}: <b>{w.perDay[day] ?? 0}</b>
                    </span>
                  ))}
                </div>

                {allocs.length === 0 ? (
                  <p className="text-sm text-muted">No subjects allocated.</p>
                ) : (
                  <table className="table-simple">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Type</th>
                        <th>Lectures/week</th>
                        <th>Scheduled</th>
                        <th>Hours/week</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocs.map((a) => {
                        const subject = ctx.subjects.get(a.subjectId);
                        const placed = new Set(
                          ctx.entries.filter((e) => e.allocationId === a.id).map((e) => e.groupId),
                        ).size;
                        return (
                          <tr key={a.id}>
                            <td>
                              <span
                                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                                style={{ background: subject?.color ?? '#999' }}
                              />
                              {subject?.code} — {subject?.name}
                            </td>
                            <td>{ctx.classes.get(a.classId)?.label ?? '—'}</td>
                            <td>{subject?.type ?? '—'}</td>
                            <td>{a.weeklyLectures}</td>
                            <td
                              className={
                                placed >= a.weeklyLectures
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {placed}/{a.weeklyLectures}
                            </td>
                            <td>{((a.weeklyLectures * a.durationMinutes) / 60).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
      )}
    </>
  );
}
