import { prisma } from '@/lib/prisma';
import { createToken, setSessionCookie, verifyPassword } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { loginSchema } from '@/lib/schemas';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await parseBody(request, loginSchema);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Same message and timing path whether the email is unknown or the password
    // is wrong — otherwise this endpoint becomes an account enumerator.
    const valid = user && user.isActive && (await verifyPassword(password, user.passwordHash));
    if (!valid || !user) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teacherId: user.teacherId,
    });
    setSessionCookie(token);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return ok({ id: user.id, name: user.name, role: user.role, teacherId: user.teacherId });
  } catch (error) {
    return handleError(error);
  }
}
