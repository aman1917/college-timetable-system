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

  subjectId: z.string().min(1, 'Subject is required.'),
  teacherId: z.string().min(1, 'Teacher is required.'),

  classIds: z
    .array(z.string().min(1))
    .min(2, 'At least 2 classes are required.'),

  roomId: z.string().nullable().optional(),

  weeklyLectures: z.coerce
    .number()
    .int()
    .min(1)
    .max(20),

  durationMinutes: z.coerce
    .number()
    .int()
    .min(20)
    .max(300),
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

    /*
     * Check whether the Common Group code already exists.
     */
    const existingGroup = await prisma.commonGroup.findUnique({
      where: {
        code: input.code,
      },
    });

    if (existingGroup) {
      return ok(
        {
          error: `A Common Group with code "${input.code}" already exists.`,
        },
        409,
      );
    }

    /*
     * Verify all selected classes exist.
     */
    const classes = await prisma.class.findMany({
      where: {
        id: {
          in: input.classIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (classes.length !== input.classIds.length) {
      return ok(
        {
          error: 'One or more selected classes do not exist.',
        },
        400,
      );
    }

    /*
     * Check whether the subject exists.
     */
    const subject = await prisma.subject.findUnique({
      where: {
        id: input.subjectId,
      },
    });

    if (!subject) {
      return ok(
        {
          error: 'Selected subject does not exist.',
        },
        400,
      );
    }

    /*
     * Check whether the teacher exists.
     */
    const teacher = await prisma.teacher.findUnique({
      where: {
        id: input.teacherId,
      },
    });

    if (!teacher) {
      return ok(
        {
          error: 'Selected teacher does not exist.',
        },
        400,
      );
    }

    /*
     * Check whether one of these classes already
     * has an allocation for this subject.
     */
    const existingAllocations =
      await prisma.subjectAllocation.findMany({
        where: {
          subjectId: input.subjectId,
          classId: {
            in: input.classIds,
          },
        },
        select: {
          id: true,
          classId: true,
        },
      });

    if (existingAllocations.length > 0) {
      return ok(
        {
          error:
            'One or more selected classes already have an allocation for this subject.',
          classIds: existingAllocations.map(
            (allocation) => allocation.classId,
          ),
        },
        409,
      );
    }

    /*
     * Create:
     *
     * CommonGroup
     *      ↓
     * multiple SubjectAllocations
     *
     * All allocations share the same commonGroupId.
     */
    const group = await prisma.$transaction(async (tx) => {
      const createdGroup = await tx.commonGroup.create({
        data: {
          name: input.name,
          code: input.code,
        },
      });

      await tx.subjectAllocation.createMany({
        data: input.classIds.map((classId) => ({
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          classId,

          roomId: input.roomId
            ? input.roomId
            : null,

          weeklyLectures: input.weeklyLectures,
          durationMinutes: input.durationMinutes,

          status: 'ACTIVE',

          commonGroupId: createdGroup.id,
          isCommon: true,
        })),
      });

      return tx.commonGroup.findUnique({
        where: {
          id: createdGroup.id,
        },
        include: {
          allocations: {
            include: {
              subject: true,
              teacher: true,
              room: true,
              class: {
                include: {
                  stream: true,
                  academicYear: true,
                },
              },
            },
          },
        },
      });
    });

    return ok(group, 201);
  } catch (error) {
    return handleError(error);
  }
}