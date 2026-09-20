import { handleError, ok, requireAdmin } from '@/lib/api';
import { removeLecture } from '@/lib/timetable-service';
import { recordAudit } from '@/lib/audit';

/** `id` here is the groupId — a multi-period lecture is removed as one unit. */
export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const { id } = context.params;
    await removeLecture(id);
    await recordAudit({
      session,
      action: 'UNSCHEDULE_LECTURE',
      entity: 'TimetableEntry',
      entityId: id,
      summary: 'Removed a lecture from the timetable',
    });
    return ok({ groupId: id });
  } catch (error) {
    return handleError(error);
  }
}
