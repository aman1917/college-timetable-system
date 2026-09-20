/**
 * Generic CRUD route factory.
 *
 * Ten resources behave identically: list, create, update, delete, all
 * admin-guarded and all audited. Writing that ten times invites the copies to
 * drift — a missing auth check in one file is exactly the kind of bug that
 * hides. One factory, ten declarations.
 */

import type { TypeOf, ZodTypeAny } from 'zod';
import { prisma } from './prisma';
import { recordAudit } from './audit';
import { HttpError, handleError, ok, parseBody, requireAdmin, requireSession } from './api';

type PrismaDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<{ id: string }>;
  update: (args: unknown) => Promise<{ id: string }>;
  delete: (args: unknown) => Promise<{ id: string }>;
};

export interface CrudConfig<S extends ZodTypeAny> {
  /** Prisma model key, e.g. "stream". */
  model: keyof typeof prisma;
  /** Human label used in audit lines and error messages. */
  label: string;
  schema: S;
  /** Passed to findMany — include relations, ordering, etc. */
  findManyArgs?: Record<string, unknown>;
  /** Anyone signed in may read (default admin-only). */
  allowTeacherRead?: boolean;
  /** Map validated input to Prisma data (relations, nested writes, coercion). */
  toCreateData?: (input: TypeOf<S>) => unknown;
  toUpdateData?: (input: TypeOf<S>) => unknown;
  /** Build the audit summary line. */
  describe?: (record: unknown, input: TypeOf<S>) => string;
  /**
   * Block deletion when dependent records exist, with a message naming them.
   * Returning a string refuses the delete; returning null allows it.
   */
  guardDelete?: (id: string) => Promise<string | null>;
}

function delegate(model: keyof typeof prisma): PrismaDelegate {
  return prisma[model] as unknown as PrismaDelegate;
}

export function createCollectionHandlers<S extends ZodTypeAny>(config: CrudConfig<S>) {
  async function GET() {
    try {
      if (config.allowTeacherRead) await requireSession();
      else await requireAdmin();
      const rows = await delegate(config.model).findMany(config.findManyArgs ?? {});
      return ok(rows);
    } catch (error) {
      return handleError(error);
    }
  }

  async function POST(request: Request) {
    try {
      const session = await requireAdmin();
      const input = await parseBody(request, config.schema);
      const data = config.toCreateData ? config.toCreateData(input) : input;
      const created = await delegate(config.model).create({ data });
      await recordAudit({
        session,
        action: `CREATE_${config.label.toUpperCase().replace(/\s+/g, '_')}`,
        entity: config.label,
        entityId: created.id,
        summary: config.describe
          ? `Created ${config.label}: ${config.describe(created, input)}`
          : `Created ${config.label}`,
        after: input,
      });
      return ok(created, 201);
    } catch (error) {
      return handleError(error);
    }
  }

  return { GET, POST };
}

export function createItemHandlers<S extends ZodTypeAny>(config: CrudConfig<S>) {
  async function PUT(request: Request, context: { params: { id: string } }) {
    try {
      const session = await requireAdmin();
      const { id } = context.params;
      const input = await parseBody(request, config.schema);

      const before = await delegate(config.model).findUnique({ where: { id } });
      if (!before) throw new HttpError(404, `That ${config.label.toLowerCase()} no longer exists.`);

      const data = config.toUpdateData
        ? config.toUpdateData(input)
        : config.toCreateData
          ? config.toCreateData(input)
          : input;
      const updated = await delegate(config.model).update({ where: { id }, data });

      await recordAudit({
        session,
        action: `UPDATE_${config.label.toUpperCase().replace(/\s+/g, '_')}`,
        entity: config.label,
        entityId: id,
        summary: config.describe
          ? `Updated ${config.label}: ${config.describe(updated, input)}`
          : `Updated ${config.label}`,
        before,
        after: input,
      });
      return ok(updated);
    } catch (error) {
      return handleError(error);
    }
  }

  async function DELETE(_request: Request, context: { params: { id: string } }) {
    try {
      const session = await requireAdmin();
      const { id } = context.params;

      if (config.guardDelete) {
        const refusal = await config.guardDelete(id);
        if (refusal) throw new HttpError(409, refusal);
      }

      const before = await delegate(config.model).findUnique({ where: { id } });
      if (!before) throw new HttpError(404, `That ${config.label.toLowerCase()} no longer exists.`);

      await delegate(config.model).delete({ where: { id } });
      await recordAudit({
        session,
        action: `DELETE_${config.label.toUpperCase().replace(/\s+/g, '_')}`,
        entity: config.label,
        entityId: id,
        summary: `Deleted ${config.label}`,
        before,
      });
      return ok({ id });
    } catch (error) {
      return handleError(error);
    }
  }

  return { PUT, DELETE };
}

/** Helper for guardDelete: refuse when dependants exist, naming the count. */
export async function refuseIfReferenced(
  checks: { count: () => Promise<number>; noun: string }[],
): Promise<string | null> {
  const blocking: string[] = [];
  for (const check of checks) {
    const n = await check.count();
    if (n > 0) blocking.push(`${n} ${check.noun}${n === 1 ? '' : 's'}`);
  }
  if (blocking.length === 0) return null;
  return `Cannot delete — still referenced by ${blocking.join(' and ')}. Remove or reassign those first.`;
}
