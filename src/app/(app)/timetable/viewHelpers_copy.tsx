import { loadContext } from '@/lib/timetable-service';
import type { EngineContext, Weekday } from '@/lib/domain';
import type { GridLecture } from '@/components/TimetableGrid';

/** Build the lookup a read-only grid needs for one filtered set of entries. */
export function makeLectureLookup(ctx: EngineContext, entryFilter: (allocationId: string) => boolean) {
  const slotIndex = new Map(ctx.slots.map((s, i) => [s.id, i]));
  const entries = ctx.entries.filter((e) => entryFilter(e.allocationId));

  function lectureAt(day: Weekday, slotId: string): GridLecture | null {
    const entry = entries.find((e) => e.day === day && e.timeSlotId === slotId);
    if (!entry) return null;

    const group = entries
      .filter((e) => e.groupId === entry.groupId)
      .sort((a, b) => slotIndex.get(a.timeSlotId)! - slotIndex.get(b.timeSlotId)!);
    const alloc = ctx.allocations.get(entry.allocationId);
    const subject = alloc ? ctx.subjects.get(alloc.subjectId) : null;

    return {
      groupId: entry.groupId,
      subjectCode: subject?.code ?? '?',
      subjectName: subject?.name ?? '?',
      color: subject?.color ?? '#999999',
      teacherName: alloc ? ctx.teachers.get(alloc.teacherId)?.name ?? '' : '',
      className: alloc ? ctx.classes.get(alloc.classId)?.label ?? '' : '',
      roomName: alloc?.roomId ? ctx.rooms.get(alloc.roomId)?.name ?? null : null,
      continuation: group.length > 1 && group[0].id !== entry.id,
    };
  }

  const subjects = Array.from(
    new Map(
      entries
        .map((e) => ctx.allocations.get(e.allocationId))
        .map((a) => (a ? ctx.subjects.get(a.subjectId) : null))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => [s.code, { code: s.code, name: s.name, color: s.color }]),
    ).values(),
  );

  return { lectureAt, entries, subjects };
}

export async function getViewContext() {
  return loadContext();
}
