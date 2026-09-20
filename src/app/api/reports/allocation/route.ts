import { handleError, ok, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';

export async function GET() {
  try {
    await requireSession();
    const ctx = await loadContext();
    const rows = [...ctx.allocations.values()].map((a) => {
      const scheduled = new Set(
        ctx.entries.filter((e) => e.allocationId === a.id).map((e) => e.groupId),
      ).size;
      return [
        ctx.subjects.get(a.subjectId)?.code ?? '?',
        ctx.subjects.get(a.subjectId)?.name ?? '?',
        ctx.teachers.get(a.teacherId)?.name ?? '?',
        ctx.classes.get(a.classId)?.label ?? '?',
        String(a.weeklyLectures),
        `${scheduled}/${a.weeklyLectures}`,
        `${a.durationMinutes} min`,
        a.roomId ? ctx.rooms.get(a.roomId)?.name ?? '?' : '—',
        a.status,
      ];
    });
    return ok({
      headers: ['Code', 'Subject', 'Teacher', 'Class', 'Weekly Lectures', 'Scheduled', 'Duration', 'Room', 'Status'],
      rows: rows.sort((a, b) => a[0].localeCompare(b[0])),
    });
  } catch (error) {
    return handleError(error);
  }
}
