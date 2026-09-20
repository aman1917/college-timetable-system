import { handleError, ok, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const take = Math.min(Number(url.searchParams.get('take') ?? 200), 500);
    const logs = await prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take });
    return ok(logs);
  } catch (error) {
    return handleError(error);
  }
}
