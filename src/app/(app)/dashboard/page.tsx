import Link from 'next/link';
import { loadContext } from '@/lib/timetable-service';
import { computeAllWorkloads, unscheduledPool } from '@/lib/validation';
import { findExistingConflicts } from '@/lib/collision';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { PageHeader, StatusBadge } from '@/components/ui';
import { WEEKDAY_LABEL } from '@/lib/domain';

export const dynamic = 'force-dynamic';

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' | 'bad' }) {
  const color =
    tone === 'bad'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-ink';
  return (
    <div className="panel p-4">
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const [session, ctx, settings] = await Promise.all([
    getSession(),
    loadContext(),
    prisma.appSetting.findUnique({ where: { id: 'singleton' } }),
  ]);

  const teachers = [...ctx.teachers.values()];
  const workloads = computeAllWorkloads(ctx);
  const conflicts = findExistingConflicts(ctx);
  const pending = unscheduledPool(ctx).reduce((n, p) => n + p.remaining, 0);
  const allocatedSubjectIds = new Set(
    [...ctx.allocations.values()].filter((a) => a.status === 'ACTIVE').map((a) => a.subjectId),
  );
  const unallocated = [...ctx.subjects.values()].filter((s) => !allocatedSubjectIds.has(s.id));
  const maxDay = Math.max(1, ...ctx.workingDays.map((d) => ctx.entries.filter((e) => e.day === d).length));

  return (
    <>
      <PageHeader
        title={`📊 ${settings?.collegeName ?? 'Dashboard'}`}
        subtitle={`Welcome back, ${session?.name ?? ''}`}
        actions={<StatusBadge status={settings?.timetableStatus ?? 'DRAFT'} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Teachers" value={teachers.length} />
        <Stat label="Subjects" value={ctx.subjects.size} />
        <Stat label="Classes" value={ctx.classes.size} />
        <Stat label="Allocations" value={ctx.allocations.size} />
        <Stat label="Scheduled periods" value={ctx.entries.length} />
        <Stat label="Conflicts" value={conflicts.length} tone={conflicts.length ? 'bad' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-bold">Periods scheduled per day</h3>
          {ctx.workingDays.map((day) => {
            const count = ctx.entries.filter((e) => e.day === day).length;
            return (
              <div key={day} className="mb-2 flex items-center gap-2">
                <span className="w-24 text-xs text-muted">{WEEKDAY_LABEL[day]}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-brand/10">
                  <div className="h-full rounded bg-brand" style={{ width: `${(count / maxDay) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-bold">Faculty workload (allocated vs scheduled)</h3>
          <div className="max-h-64 overflow-y-auto">
            <table className="table-simple">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Allocated</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {workloads
                  .sort((a, b) => b.requiredBlocks - a.requiredBlocks)
                  .map((w) => (
                    <tr key={w.teacherId}>
                      <td>
                        {w.teacherName}
                        {w.isOverloaded && (
                          <span className="badge ml-1.5 bg-red-500/15 text-red-600 dark:text-red-400">OVER</span>
                        )}
                      </td>
                      <td>
                        {w.requiredBlocks} / {w.maxWeekly}
                      </td>
                      <td>{w.scheduledPeriods}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel mt-4 p-4">
        <h3 className="mb-3 text-sm font-bold">⚠️ Needs attention</h3>
        {conflicts.length === 0 && unallocated.length === 0 && pending === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Everything looks healthy — no conflicts, every subject allocated, every lecture scheduled.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {conflicts.slice(0, 5).map((c, i) => (
              <li key={i} className="text-red-600 dark:text-red-400">
                ⛔ {c}
              </li>
            ))}
            {pending > 0 && (
              <li className="text-amber-600 dark:text-amber-400">
                ⚠ {pending} lecture block(s) still unscheduled —{' '}
                <Link href="/timetable/builder" className="underline">
                  open the builder
                </Link>
              </li>
            )}
            {unallocated.slice(0, 5).map((s) => (
              <li key={s.id} className="text-amber-600 dark:text-amber-400">
                ⚠ {s.code} — {s.name} has no teacher allocated
              </li>
            ))}
            {workloads
              .filter((w) => w.isOverloaded)
              .slice(0, 5)
              .map((w) => (
                <li key={w.teacherId} className="text-amber-600 dark:text-amber-400">
                  ⚠ {w.teacherName} is allocated {w.requiredBlocks} block(s) against a limit of {w.maxWeekly}
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  );
}
