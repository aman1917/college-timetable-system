import { handleError, ok, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';
import { computeAllWorkloads } from '@/lib/validation';

export async function GET() {
  try {
    await requireSession();
    const ctx = await loadContext();
    return ok({
      headers: ['Teacher', 'Type', 'Theory', 'Practical', 'Total Allocated', 'Scheduled Periods', 'Weekly Limit', 'Status'],
      rows: computeAllWorkloads(ctx)
        .sort((a, b) => b.requiredBlocks - a.requiredBlocks)
        .map((w) => [
          w.teacherName,
          w.employmentType === 'PART_TIME' ? 'Part-Time' : 'Full-Time',
          String(w.theoryBlocks),
          String(w.practicalBlocks),
          String(w.requiredBlocks),
          String(w.scheduledPeriods),
          String(w.maxWeekly),
          w.isOverloaded ? 'OVERLOADED' : 'OK',
        ]),
    });
  } catch (error) {
    return handleError(error);
  }
}
