import { handleError, ok, parseBody, requireAdmin } from '@/lib/api';
import { moveSchema } from '@/lib/schemas';
import { moveLecture } from '@/lib/timetable-service';
import { recordAudit } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const input = await parseBody(request, moveSchema);
    const result = await moveLecture(input);
    await recordAudit({
      session,
      action: 'MOVE_LECTURE',
      entity: 'TimetableEntry',
      entityId: input.groupId,
      summary: `Moved a lecture to ${input.day}`,
      after: input,
    });
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
