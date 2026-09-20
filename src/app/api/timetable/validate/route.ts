import { handleError, ok, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';
import { validateTimetable } from '@/lib/validation';

export async function GET() {
  try {
    await requireSession();
    const ctx = await loadContext();
    return ok(validateTimetable(ctx));
  } catch (error) {
    return handleError(error);
  }
}
