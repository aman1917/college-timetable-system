import { handleError, ok, parseBody, requireAdmin, HttpError } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';
import { validateTimetable } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { z } from 'zod';

const bodySchema = z.object({
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const { status } = await parseBody(request, bodySchema);

    // Validation gates PUBLISHED specifically. Moving back to DRAFT or ARCHIVED
    // must always be possible, including from a broken state.
    if (status === 'PUBLISHED') {
      const report = validateTimetable(await loadContext());
      if (!report.ok) {
        throw new HttpError(
          409,
          `Cannot publish. ${report.checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.details.length} issue(s)`).join('; ')}`,
        );
      }
    }

    const updated = await prisma.appSetting.update({
      where: { id: 'singleton' },
      data: {
        timetableStatus: status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        publishedBy: status === 'PUBLISHED' ? session.name : null,
      },
    });

    await recordAudit({
      session,
      action: status === 'PUBLISHED' ? 'PUBLISH_TIMETABLE' : 'SET_TIMETABLE_STATUS',
      entity: 'Timetable',
      summary: `Timetable status set to ${status}`,
      after: { status },
    });

    return ok(updated);
  } catch (error) {
    return handleError(error);
  }
}
