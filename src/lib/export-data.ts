/**
 * Shared shaping for exports, so the PDF and the Excel sheet are generated from
 * one description of the timetable rather than two that can drift apart.
 */

import type { EngineContext, Weekday } from './domain';
import { WEEKDAY_LABEL } from './domain';

export interface ExportCell {
  text: string;
  color: string | null;
}

export interface ExportTable {
  title: string;
  subtitle: string;
  head: string[];
  /** rows[rowIndex][colIndex]; column 0 is the time label. */
  rows: ExportCell[][];
  legend: { code: string; name: string; color: string }[];
}

export type ExportKind = 'class' | 'teacher' | 'room' | 'master';

export function buildExportTable(ctx: EngineContext, kind: ExportKind, id: string): ExportTable {
  const days = ctx.workingDays;

  const matches = (allocationId: string) => {
    const alloc = ctx.allocations.get(allocationId);
    if (!alloc) return false;
    if (kind === 'class') return alloc.classId === id;
    if (kind === 'teacher') return alloc.teacherId === id;
    if (kind === 'room') return alloc.roomId === id;
    return true;
  };

  const entries = ctx.entries.filter((e) => matches(e.allocationId));
  const slotIndex = new Map(ctx.slots.map((s, i) => [s.id, i]));

  const rows: ExportCell[][] = ctx.slots.map((slot) => {
    const label: ExportCell = { text: `${slot.startTime}\n${slot.endTime}`, color: null };

    if (slot.type !== 'LECTURE' || !slot.isActive) {
      const banner = slot.type === 'LECTURE' ? 'INACTIVE' : slot.type;
      return [label, ...days.map(() => ({ text: banner, color: '#fde68a' }))];
    }

    return [
      label,
      ...days.map((day) => {
        const entry = entries.find((e) => e.day === day && e.timeSlotId === slot.id);
        if (!entry) return { text: '', color: null };

        const alloc = ctx.allocations.get(entry.allocationId);
        const subject = alloc ? ctx.subjects.get(alloc.subjectId) : null;
        const group = entries
          .filter((e) => e.groupId === entry.groupId)
          .sort((a, b) => slotIndex.get(a.timeSlotId)! - slotIndex.get(b.timeSlotId)!);
        const isContinuation = group.length > 1 && group[0].id !== entry.id;

        const lines = [subject?.code ?? '?'];
        if (kind !== 'teacher' && alloc) lines.push(ctx.teachers.get(alloc.teacherId)?.name ?? '');
        if (kind !== 'class' && alloc) lines.push(ctx.classes.get(alloc.classId)?.label ?? '');
        if (kind !== 'room' && alloc?.roomId) lines.push(ctx.rooms.get(alloc.roomId)?.name ?? '');
        if (isContinuation) lines[0] += ' (cont.)';

        return { text: lines.filter(Boolean).join('\n'), color: subject?.color ?? '#cccccc' };
      }),
    ];
  });

  const legend = Array.from(
    new Map(
      entries
        .map((e) => ctx.allocations.get(e.allocationId))
        .map((a) => (a ? ctx.subjects.get(a.subjectId) : null))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => [s.code, { code: s.code, name: s.name, color: s.color }]),
    ).values(),
  );

  let subtitle = 'Master Timetable';
  if (kind === 'class') subtitle = ctx.classes.get(id)?.label ?? 'Class';
  if (kind === 'teacher') subtitle = ctx.teachers.get(id)?.name ?? 'Teacher';
  if (kind === 'room') subtitle = ctx.rooms.get(id)?.name ?? 'Room';

  return {
    title: 'Timetable',
    subtitle,
    head: ['Time', ...days.map((d: Weekday) => WEEKDAY_LABEL[d])],
    rows,
    legend,
  };
}
