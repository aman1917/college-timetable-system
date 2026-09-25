import { prisma } from '@/lib/prisma';
import {
  handleError,
  ok,
  requireAdmin,
  requireSession,
} from '@/lib/api';
import { z } from 'zod';

const commonGroupSchema = z.object({
  name: z.string().min(1, 'Common group name is required.').max(120),
  code: z.string().min(1, 'Common group code is required.').max(30),
});

export async function GET() {
  try {
    await requireSession();

    const groups = await prisma.commonGroup.findMany({
      include: {
        allocations: {
          include: {
            subject: true,
            class: {
              include: {
                stream: true,
                academicYear: true,
              },
            },
            teacher: true,
            room: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return ok(groups);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const input = commonGroupSchema.parse(body);

    const existing = await prisma.commonGroup.findUnique({
      where: {
        code: input.code,
      },
    });

    if (existing) {
      return ok(
        {
          error: `A common group with code "${input.code}" already exists.`,
        },
        409,
      );
    }

    const group = await prisma.commonGroup.create({
      data: {
        name: input.name,
        code: input.code,
      },
    });

    return ok(group, 201);
  } catch (error) {
    return handleError(error);
  }
}