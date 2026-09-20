'use client';

/**
 * THE TIMETABLE BUILDER.
 *
 * Drop targets are computed by the SERVER engine and returned with the payload,
 * so the green cells you can drop into are the cells the server will actually
 * accept. The client never decides legality on its own — it only asks.
 *
 * Every mutation is re-validated inside a database transaction as well, so a
 * second admin dragging at the same moment cannot slip a collision through.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { del, get, post } from '@/lib/client';
import { ColorLegend, LectureCard } from '@/components/TimetableGrid';
import { ConfirmDialog, Modal, PageHeader, Spinner, StatusBadge, useToast } from '@/components/ui';
import { WEEKDAY_LABEL, type Weekday } from '@/lib/domain';

interface Payload {
  workingDays: Weekday[];
  slots: { id: string; startTime: string; endTime: string; type: 'LECTURE' | 'BREAK' | 'LUNCH'; isActive: boolean }[];
  entries: { id: string; groupId: string; day: Weekday; timeSlotId: string; allocationId: string }[];
  allocations: { id: string; teacherId: string; subjectId: string; classId: string; roomId: string | null }[];
  teachers: { id: string; name: string }[];
  subjects: { id: string; code: string; name: string; color: string }[];
  classes: { id: string; label: string }[];
  rooms: { id: string; name: string }[];
  pool: {
    allocationId: string; remaining: number; periodsEach: number;
    subjectCode: string; subjectName: string; color: string;
    teacherName: string; className: string; roomName: string | null;
  }[];
  targets: string[];
  status: string;
}

interface ValidationReport {
  ok: boolean;
  summary: string;
  checks: { key: string; label: string; pass: boolean; details: string[] }[];
}

type Selection =
  | { mode: 'pool'; allocationId: string }
  | { mode: 'move'; groupId: string }
  | null;

export default function BuilderClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; action: () => void }>(null);
  const toast = useToast();

  /** Reload the grid. Passing a selection asks the server for its legal targets. */
  const load = useCallback(
    async (sel: Selection = null) => {
      const params = new URLSearchParams();
      if (sel?.mode === 'pool') params.set('allocationId', sel.allocationId);
      if (sel?.mode === 'move') params.set('groupId', sel.groupId);
      const qs = params.toString();
      try {
        setData(await get<Payload>(`/api/timetable/options${qs ? `?${qs}` : ''}`));
      } catch (error) {
        toast((error as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const targets = useMemo(() => new Set(data?.targets ?? []), [data]);

  const lookup = useMemo(() => {
    if (!data) return null;
    const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
    return {
      allocations: byId(data.allocations),
      subjects: byId(data.subjects),
      teachers: byId(data.teachers),
      classes: byId(data.classes),
      rooms: byId(data.rooms),
      slotIndex: new Map(data.slots.map((s, i) => [s.id, i])),
    };
  }, [data]);

  async function select(sel: Selection) {
    setSelection(sel);
    await load(sel);
  }

  async function place(day: Weekday, startSlotId: string) {
    if (!selection) return;
    setBusy(true);
    try {
      if (selection.mode === 'pool') {
        await post('/api/timetable/entries', { allocationId: selection.allocationId, day, startSlotId });
      } else {
        await post('/api/timetable/move', { groupId: selection.groupId, day, startSlotId });
      }
      setSelection(null);
      await load(null);
      toast('Lecture placed.');
    } catch (error) {
      // The server's refusal text names the exact clash — show it verbatim.
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup(groupId: string) {
    setBusy(true);
    try {
      await del(`/api/timetable/entries/${groupId}`);
      setSelection(null);
      await load(null);
      toast('Lecture removed.');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function generate(clearExisting: boolean) {
    setBusy(true);
    setConfirm(null);
    try {
      const result = await post<{
        placedGroups: number; repairedGroups: number; complete: boolean;
        shortfalls: { subjectCode: string; teacherName: string; className: string; placed: number; required: number }[];
      }>('/api/timetable/generate', { clearExisting });

      await load(null);
      if (result.complete) {
        toast(`Generated ${result.placedGroups} lecture block(s) — all requirements met, zero conflicts.`);
      } else {
        const lines = result.shortfalls
          .slice(0, 6)
          .map((s) => `${s.subjectCode} — ${s.teacherName} — ${s.className}: ${s.placed}/${s.required}`)
          .join('\n');
        toast(
          `Placed ${result.placedGroups} block(s) with no conflicts.\n${result.shortfalls.length} allocation(s) could not fit:\n${lines}`,
          'error',
        );
      }
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    setBusy(true);
    try {
      setReport(await get<ValidationReport>('/api/timetable/validate'));
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await post('/api/timetable/publish', { status });
      setReport(null);
      await load(null);
      toast(status === 'PUBLISHED' ? 'Timetable published.' : `Status set to ${status}.`);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data || !lookup) return <Spinner label="Loading timetable…" />;

  if (data.slots.length === 0) {
    return (
      <div className="panel p-10 text-center text-sm text-muted">
        No time slots defined yet. Create them under <b>Timetable → Time Slots</b>, then come back here.
      </div>
    );
  }

  function lectureFor(day: Weekday, slotId: string) {
    const entry = data!.entries.find((e) => e.day === day && e.timeSlotId === slotId);
    if (!entry) return null;
    const group = data!.entries
      .filter((e) => e.groupId === entry.groupId)
      .sort((a, b) => lookup!.slotIndex.get(a.timeSlotId)! - lookup!.slotIndex.get(b.timeSlotId)!);
    const alloc = lookup!.allocations.get(entry.allocationId);
    const subject = alloc ? lookup!.subjects.get(alloc.subjectId) : null;
    return {
      entry,
      lecture: {
        groupId: entry.groupId,
        subjectCode: subject?.code ?? '?',
        subjectName: subject?.name ?? '?',
        color: subject?.color ?? '#999999',
        teacherName: alloc ? lookup!.teachers.get(alloc.teacherId)?.name ?? '' : '',
        className: alloc ? lookup!.classes.get(alloc.classId)?.label ?? '' : '',
        roomName: alloc?.roomId ? lookup!.rooms.get(alloc.roomId)?.name ?? null : null,
        continuation: group.length > 1 && group[0].id !== entry.id,
      },
    };
  }

  const legendSubjects = Array.from(
    new Map(
      data.entries
        .map((e) => lookup.allocations.get(e.allocationId))
        .map((a) => (a ? lookup.subjects.get(a.subjectId) : null))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => [s.code, s]),
    ).values(),
  );

  return (
    <>
      <PageHeader
        title="🗓️ Timetable Builder"
        subtitle="Pick a lecture from the pool, then click a green cell — or drag the card onto one. Every placement is validated by the server."
        actions={
          <>
            <StatusBadge status={data.status} />
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: 'Auto-generate timetable?',
                  message:
                    'The scheduler will place every outstanding lecture into free, conflict-free slots. Lectures already on the grid are kept.\n\nIt never breaks a hard constraint to finish — if something genuinely cannot fit, it will tell you what is short.',
                  action: () => generate(false),
                })
              }
            >
              🎯 Auto-Generate
            </button>
            <button className="btn-ghost" disabled={busy} onClick={validate}>
              ✅ Validate
            </button>
            {data.status === 'PUBLISHED' ? (
              <button className="btn-ghost" disabled={busy} onClick={() => setStatus('DRAFT')}>
                ↩ Revert to Draft
              </button>
            ) : (
              <button className="btn-brand" disabled={busy} onClick={validate}>
                🚀 Publish
              </button>
            )}
            <button
              className="btn-danger"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: 'Clear the whole grid?',
                  message:
                    'Every scheduled lecture is removed. Your allocations stay intact, so you can re-generate at any time.',
                  action: () => generate(true),
                })
              }
            >
              🗑 Clear & Regenerate
            </button>
          </>
        }
      />

      {selection && (
        <div className="panel mb-3 flex flex-wrap items-center justify-between gap-2 bg-brand/10 p-3">
          <span className="text-sm">
            {selection.mode === 'pool'
              ? 'Placing a lecture — click a green cell, or drag the card onto one.'
              : 'Moving a scheduled lecture — click a green cell, or remove it.'}
          </span>
          <div className="flex gap-2">
            {selection.mode === 'move' && (
              <button
                className="btn-danger btn-sm"
                onClick={() =>
                  setConfirm({
                    title: 'Remove this lecture?',
                    message: 'It returns to the unscheduled pool and can be placed again.',
                    action: () => removeGroup(selection.groupId),
                  })
                }
              >
                Remove lecture
              </button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => select(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="panel min-w-[320px] flex-1 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-[2] min-w-[92px] border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold">
                  Time
                </th>
                {data.workingDays.map((d) => (
                  <th key={d} className="border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold">
                    {WEEKDAY_LABEL[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slots.map((slot) => {
                const blocked = slot.type !== 'LECTURE' || !slot.isActive;
                return (
                  <tr key={slot.id}>
                    <td className="sticky left-0 z-[1] whitespace-nowrap border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold text-muted">
                      {slot.startTime} – {slot.endTime}
                    </td>
                    {blocked ? (
                      <td
                        colSpan={data.workingDays.length}
                        className="border border-line bg-amber-500/10 px-2 py-2 text-center text-[11px] font-bold text-amber-600 dark:text-amber-400"
                      >
                        {slot.type === 'LECTURE' ? 'INACTIVE' : slot.type}
                      </td>
                    ) : (
                      data.workingDays.map((day) => {
                        const found = lectureFor(day, slot.id);
                        const key = `${day}|${slot.id}`;
                        const isTarget = targets.has(key);

                        return (
                          <td
                            key={day}
                            className="h-16 border border-line bg-panel p-1 align-top"
                            onDragOver={(e) => isTarget && e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData('text/plain');
                              if (!raw) return;
                              const [mode, id] = [raw.slice(0, raw.indexOf(':')), raw.slice(raw.indexOf(':') + 1)];
                              const sel: Selection =
                                mode === 'pool' ? { mode: 'pool', allocationId: id } : { mode: 'move', groupId: id };
                              setSelection(sel);
                              void (async () => {
                                setBusy(true);
                                try {
                                  if (sel.mode === 'pool') {
                                    await post('/api/timetable/entries', {
                                      allocationId: sel.allocationId, day, startSlotId: slot.id,
                                    });
                                  } else {
                                    await post('/api/timetable/move', {
                                      groupId: sel.groupId, day, startSlotId: slot.id,
                                    });
                                  }
                                  setSelection(null);
                                  await load(null);
                                  toast('Lecture placed.');
                                } catch (error) {
                                  toast((error as Error).message, 'error');
                                } finally {
                                  setBusy(false);
                                }
                              })();
                            }}
                          >
                            {found ? (
                              <LectureCard
                                lecture={found.lecture}
                                show={{ teacher: true, klass: true, room: true }}
                                draggable
                                selected={selection?.mode === 'move' && selection.groupId === found.lecture.groupId}
                                onDragStart={(e) =>
                                  e.dataTransfer.setData('text/plain', `move:${found.lecture.groupId}`)
                                }
                                onClick={() =>
                                  select(
                                    selection?.mode === 'move' && selection.groupId === found.lecture.groupId
                                      ? null
                                      : { mode: 'move', groupId: found.lecture.groupId },
                                  )
                                }
                              />
                            ) : (
                              <button
                                type="button"
                                disabled={!isTarget || busy}
                                onClick={() => place(day, slot.id)}
                                className={`flex h-full min-h-[52px] w-full items-center justify-center rounded-lg text-[11px] transition ${
                                  isTarget
                                    ? 'bg-emerald-500/15 text-emerald-700 outline-dashed outline-2 outline-emerald-500 dark:text-emerald-400'
                                    : selection
                                      ? 'text-muted/40'
                                      : 'text-muted'
                                }`}
                              >
                                {isTarget ? '+ Place here' : selection ? '✕' : ''}
                              </button>
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

        <div className="panel w-full shrink-0 p-3 lg:w-[260px]">
          <h3 className="mb-2 text-sm font-bold">📥 Unscheduled Pool</h3>
          {data.pool.length === 0 ? (
            <p className="text-sm text-muted">Every allocation is fully scheduled 🎉</p>
          ) : (
            data.pool.map((p) => (
              <div key={p.allocationId} className="mb-2">
                <LectureCard
                  lecture={{
                    groupId: p.allocationId,
                    subjectCode: `${p.subjectCode} · ${p.remaining} left`,
                    subjectName: p.subjectName,
                    color: p.color,
                    teacherName: p.teacherName,
                    className: p.className,
                    roomName: p.roomName,
                    continuation: false,
                  }}
                  show={{ teacher: true, klass: true, room: false }}
                  draggable
                  selected={selection?.mode === 'pool' && selection.allocationId === p.allocationId}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', `pool:${p.allocationId}`)}
                  onClick={() =>
                    select(
                      selection?.mode === 'pool' && selection.allocationId === p.allocationId
                        ? null
                        : { mode: 'pool', allocationId: p.allocationId },
                    )
                  }
                />
                {p.periodsEach > 1 && (
                  <div className="mt-0.5 text-[10px] text-muted">needs {p.periodsEach} consecutive periods</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <ColorLegend subjects={legendSubjects} />

      {report && (
        <Modal
          title="Pre-Publish Validation"
          onClose={() => setReport(null)}
          footer={
            <>
              {report.ok && (
                <button className="btn-brand" disabled={busy} onClick={() => setStatus('PUBLISHED')}>
                  🚀 Publish Timetable
                </button>
              )}
              <button className="btn-ghost" onClick={() => setReport(null)}>
                Close
              </button>
            </>
          }
        >
          <div
            className={`mb-4 rounded-lg p-3 text-center text-sm font-extrabold ${
              report.ok
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/15 text-red-600 dark:text-red-400'
            }`}
          >
            {report.ok ? '✅ READY TO PUBLISH' : '⛔ CANNOT PUBLISH'}
          </div>
          {report.checks.map((c) => (
            <div key={c.key} className="mb-3">
              <div
                className={`text-[13px] font-semibold ${
                  c.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {c.pass ? '✓' : '✕'} {c.label}
              </div>
              {!c.pass && c.details.length > 0 && (
                <ul className="ml-5 mt-1 list-disc text-xs text-muted">
                  {c.details.slice(0, 10).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                  {c.details.length > 10 && <li>+ {c.details.length - 10} more…</li>}
                </ul>
              )}
            </div>
          ))}
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
