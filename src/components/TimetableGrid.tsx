'use client';

/**
 * Read-only timetable grid, shared by the class, master, teacher and room views
 * so all four render identically from the same master data.
 */

import { contrastText } from '@/lib/colors';
import { WEEKDAY_LABEL, type Weekday } from '@/lib/domain';

export interface GridSlot {
  id: string;
  startTime: string;
  endTime: string;
  type: 'LECTURE' | 'BREAK' | 'LUNCH';
  isActive: boolean;
}

export interface GridLecture {
  groupId: string;
  subjectCode: string;
  subjectName: string;
  color: string;
  teacherName: string;
  className: string;
  roomName: string | null;
  /** True for the second and later periods of a multi-period block. */
  continuation: boolean;
}

export function LectureCard({
  lecture,
  show,
  draggable,
  onDragStart,
  onClick,
  selected,
}: {
  lecture: GridLecture;
  show?: { teacher?: boolean; klass?: boolean; room?: boolean };
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
  selected?: boolean;
}) {
  const bg = lecture.color || '#999999';
  const fg = contrastText(bg);
  const opts = { teacher: true, klass: false, room: true, ...(show ?? {}) };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      style={{ background: bg, color: fg, outline: selected ? '3px solid rgb(var(--ink))' : undefined }}
      className={`rounded-lg border border-black/10 px-2 py-1.5 text-[11px] leading-snug shadow-sm ${onClick ? 'cursor-pointer' : ''
        }`}
      title={`${lecture.subjectName}\n${lecture.teacherName}\n${lecture.className}${lecture.roomName ? '\n' + lecture.roomName : ''}`}
    >
      <b className="block text-[12px]">
        {lecture.subjectCode}
        {lecture.continuation ? ' ⋯' : ''}
      </b>
      {opts.teacher && lecture.teacherName ? <div>{lecture.teacherName}</div> : null}
      {opts.klass && lecture.className ? <div>{lecture.className}</div> : null}
      {opts.room && lecture.roomName ? <div className="opacity-90">{lecture.roomName}</div> : null}
    </div>
  );
}
//old
// export function TimetableGrid({
//   days,
//   slots,
//   lectureAt,
//   show,
//   emptyLabel = '—',
// }: {
//   days: Weekday[];
//   slots: GridSlot[];
//   lectureAt: (day: Weekday, slotId: string) => GridLecture | null;
//   show?: { teacher?: boolean; klass?: boolean; room?: boolean };
//   emptyLabel?: string;
// }) {
//new
export function TimetableGrid({
  days,
  slots,
  lectures,
  show,
  emptyLabel = '—',
}: {
  days: Weekday[];
  slots: GridSlot[];
  lectures: Record<string, GridLecture>;
  show?: { teacher?: boolean; klass?: boolean; room?: boolean };
  emptyLabel?: string;
}) {
  if (days.length === 0 || slots.length === 0) {
    return <div className="panel p-8 text-center text-sm text-muted">No working days or time slots configured.</div>;
  }

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-[2] min-w-[92px] border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold">
              Time
            </th>
            {days.map((d) => (
              <th key={d} className="border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold">
                {WEEKDAY_LABEL[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const isBreak = slot.type !== 'LECTURE' || !slot.isActive;
            return (
              <tr key={slot.id}>
                <td className="sticky left-0 z-[1] whitespace-nowrap border border-line bg-brand/10 px-2 py-2 text-[11px] font-semibold text-muted">
                  {slot.startTime} – {slot.endTime}
                </td>
                {isBreak ? (
                  <td
                    colSpan={days.length}
                    className="border border-line bg-amber-500/10 px-2 py-2 text-center text-[11px] font-bold text-amber-600 dark:text-amber-400"
                  >
                    {slot.type === 'LECTURE' ? 'INACTIVE' : slot.type}
                  </td>
                ) : (
                  days.map((day) => {
                    //const lecture = lectureAt(day, slot.id);
                    const lecture = lectures[`${day}:${slot.id}`] ?? null;
                    return (
                      <td key={day} className="h-16 border border-line bg-panel p-1 align-top">
                        {lecture ? (
                          <LectureCard lecture={lecture} show={show} />
                        ) : (
                          <div className="flex h-full min-h-[52px] items-center justify-center text-[11px] text-muted">
                            {emptyLabel}
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
  );
}

export function ColorLegend({ subjects }: { subjects: { code: string; name: string; color: string }[] }) {
  const unique = Array.from(new Map(subjects.map((s) => [s.code, s])).values());
  if (unique.length === 0) return null;

  return (
    <div className="panel mt-3 p-3">
      <div className="mb-2 text-[11px] font-bold text-muted">COLOUR LEGEND</div>
      <div className="flex flex-wrap gap-2">
        {unique.map((s) => (
          <span
            key={s.code}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px]"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color || '#999999' }}
            />
            {s.code} — {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
