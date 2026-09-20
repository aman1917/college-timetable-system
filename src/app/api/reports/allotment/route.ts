import { handleError, ok, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';

export async function GET() {
  try {
    await requireSession();
    const ctx = await loadContext();
    const rows: string[][] = [];

    for (const teacher of [...ctx.teachers.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const allocs = [...ctx.allocations.values()].filter(
        (a) => a.teacherId === teacher.id && a.status === 'ACTIVE',
      );
      for (const a of allocs) {
        const subject = ctx.subjects.get(a.subjectId);
        rows.push([
          teacher.name,
          subject?.code ?? '?',
          subject?.name ?? '?',
          ctx.classes.get(a.classId)?.label ?? '?',
          subject?.type ?? '?',
          String(a.weeklyLectures),
          ((a.weeklyLectures * a.durationMinutes) / 60).toFixed(2),
        ]);
      }
    }

    return ok({
      headers: ['Teacher', 'Code', 'Subject', 'Class', 'Type', 'Lectures/Week', 'Hours/Week'],
      rows,
    });
  } catch (error) {
    return handleError(error);
  }
}
