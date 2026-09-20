import { handleError, ok, parseBody, requireAdmin, requireSession } from '@/lib/api';
import { settingsSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export async function GET() {
  try {
    await requireSession();
    const settings = await prisma.appSetting.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
    return ok(settings);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();
    const input = await parseBody(request, settingsSchema);
    const before = await prisma.appSetting.findUnique({ where: { id: 'singleton' } });
    const updated = await prisma.appSetting.update({ where: { id: 'singleton' }, data: input });
    await recordAudit({
      session,
      action: 'UPDATE_SETTINGS',
      entity: 'AppSetting',
      summary: 'Updated college settings',
      before,
      after: input,
    });
    return ok(updated);
  } catch (error) {
    return handleError(error);
  }
}
