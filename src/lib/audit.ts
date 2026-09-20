/**
 * Audit trail. Records who changed what, with before/after snapshots for the
 * fields that matter, so a timetable dispute can be traced to a decision.
 */
import { prisma } from './prisma';
import type { SessionPayload } from './auth';

export async function recordAudit(params: {
  session: SessionPayload | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        summary: params.summary,
        before: (params.before as never) ?? undefined,
        after: (params.after as never) ?? undefined,
        userId: params.session?.userId ?? null,
        userLabel: params.session?.name ?? 'system',
      },
    });
  } catch (error) {
    // An audit failure must never block the operation the user asked for.
    console.error('[audit] write failed', error);
  }
}
