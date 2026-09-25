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
     * 1. Check Common Group code
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
     * 2. Verify all selected classes exist
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
     * 3. Verify subject
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
     * 4. Verify teacher
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
     * 5. Find existing allocations for these classes
     *
     * IMPORTANT:
     * We DO NOT reject existing allocations.
     *
     * Existing allocations will be converted into
     * Common Group allocations.
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
          commonGroupId: true,
          isCommon: true,
        },
      });

    /*
     * 6. Make sure an existing allocation is not already
     * attached to another Common Group.
     */
    const alreadyInAnotherGroup = existingAllocations.filter(
      (allocation) =>
        allocation.commonGroupId &&
        allocation.commonGroupId !== null,
    );

    if (alreadyInAnotherGroup.length > 0) {
      return ok(
        {
          error:
            'One or more selected classes are already part of another Common Group.',
          classIds: alreadyInAnotherGroup.map(
            (allocation) => allocation.classId,
          ),
        },
        409,
      );
    }

    /*
     * 7. Create Common Group and attach allocations
     */
    const group = await prisma.$transaction(async (tx) => {
      /*
       * Create Common Group
       */
      const createdGroup = await tx.commonGroup.create({
        data: {
          name: input.name,
          code: input.code,
        },
      });

      /*
       * Existing allocations
       */
      const existingClassIds = new Set(
        existingAllocations.map(
          (allocation) => allocation.classId,
        ),
      );

      /*
       * 8. Convert existing allocations into
       * Common Group allocations.
       */
      if (existingAllocations.length > 0) {
        await tx.subjectAllocation.updateMany({
          where: {
            id: {
              in: existingAllocations.map(
                (allocation) => allocation.id,
              ),
            },
          },
          data: {
            teacherId: input.teacherId,
            roomId: input.roomId
              ? input.roomId
              : null,
            weeklyLectures: input.weeklyLectures,
            durationMinutes: input.durationMinutes,
            status: 'ACTIVE',
            commonGroupId: createdGroup.id,
            isCommon: true,
          },
        });
      }

      /*
       * 9. Create allocations only for classes
       * that did NOT already have one.
       */
      const missingClassIds = input.classIds.filter(
        (classId) => !existingClassIds.has(classId),
      );

      if (missingClassIds.length > 0) {
        await tx.subjectAllocation.createMany({
          data: missingClassIds.map((classId) => ({
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
      }

      /*
       * 10. Return complete Common Group
       */
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