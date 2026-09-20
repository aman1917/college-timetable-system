/**
 * Shared helpers for route handlers: auth guards and consistent error shapes.
 *
 * Every mutating endpoint calls requireAdmin(). Authorisation is enforced
 * server-side on each request — the sidebar hiding a link is a convenience,
 * never the control.
 */
import { NextResponse } from 'next/server';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';
import { getSession, type SessionPayload } from './auth';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError(401, 'You are not signed in.');
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== 'ADMIN') {
    throw new HttpError(403, 'Administrator access is required for this action.');
  }
  return session;
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Turns thrown errors into a predictable JSON body the client can render. */
export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed.',
        fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 422 },
    );
  }
  const err = error as { code?: string; meta?: { target?: string[]; field_name?: string } };
  if (err?.code === 'P2002') {
    const target = err.meta?.target?.join(', ') ?? 'field';
    return NextResponse.json({ error: `That ${target} is already in use.` }, { status: 409 });
  }
  if (err?.code === 'P2003') {
    return NextResponse.json(
      { error: 'This record is still referenced by other data. Remove or reassign those first.' },
      { status: 409 },
    );
  }
  if (err?.code === 'P2025') {
    return NextResponse.json({ error: 'That record no longer exists.' }, { status: 404 });
  }
  console.error('[api] unhandled error', error);
  return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500 });
}

/**
 * Infers the parsed type from the schema itself rather than taking a separate
 * type parameter. Schemas that use .default() or .refine() have an input type
 * that differs from their output type, so `ZodSchema<T>` (which assumes the two
 * are identical) rejects exactly the schemas we use most.
 */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<TypeOf<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
  return schema.parse(json);
}
