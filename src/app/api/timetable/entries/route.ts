import { handleError, ok, parseBody, requireAdmin } from '@/lib/api';
import { placeSchema } from '@/lib/schemas';
import { placeLecture } from '@/lib/timetable-service';
import { recordAudit } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const input = await parseBody(request, placeSchema);
    const result = await placeLecture(input);
    await recordAudit({
      session,
      action: 'SCHEDULE_LECTURE',
      entity: 'TimetableEntry',
      entityId: result.groupId,
      summary: `Scheduled a lecture on ${input.day}`,
      after: input,
    });
    return ok(result, 201);
  } catch (error) {
    return handleError(error);
  }
}
