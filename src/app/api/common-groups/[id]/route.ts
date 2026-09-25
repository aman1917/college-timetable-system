import { prisma } from '@/lib/prisma';
import {
  handleError,
  ok,
  requireAdmin,
  requireSession,
} from '@/lib/api';
import { z } from 'zod';

const commonGroupUpdateSchema = z.object({
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession();

    const { id } = await params;

    const group = await prisma.commonGroup.findUnique({
      where: { id },
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

    if (!group) {
      return ok(
        { error: 'Common Group not found.' },
        404,
      );
    }

    return ok(group);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();

    const { id } = await params;

    const body = await request.json();
    const input = commonGroupUpdateSchema.parse(body);

    const existingGroup = await prisma.commonGroup.findUnique({
      where: { id },
      include: {
        allocations: true,
      },
    });

    if (!existingGroup) {
      return ok(
        { error: 'Common Group not found.' },
        404,
      );
    }

    const duplicateCode = await prisma.commonGroup.findFirst({
      where: {
        code: input.code,
        NOT: {
          id,
        },
      },
    });

    if (duplicateCode) {
      return ok(
        {
          error: `A Common Group with code "${input.code}" already exists.`,
        },
        409,
      );
    }

    const duplicateAllocation = await prisma.subjectAllocation.findFirst({
      where: {
        subjectId: input.subjectId,
        classId: {
          in: input.classIds,
        },
        NOT: {
          commonGroupId: id,
        },
      },
    });

    if (duplicateAllocation) {
      return ok(
        {
          error:
            'One of the selected classes already has an allocation for this subject.',
        },
        409,
      );
    }

    const group = await prisma.$transaction(async (tx) => {
      await tx.timetableEntry.deleteMany({
        where: {
          allocationId: {
            in: existingGroup.allocations.map(
              (allocation) => allocation.id,
            ),
          },
        },
      });

      await tx.subjectAllocation.deleteMany({
        where: {
          commonGroupId: id,
        },
      });

      return tx.commonGroup.update({
        where: {
          id,
        },
        data: {
          name: input.name,
          code: input.code,
          allocations: {
            create: input.classIds.map((classId) => ({
              subjectId: input.subjectId,
              teacherId: input.teacherId,
              classId,
              roomId: input.roomId || null,
              weeklyLectures: input.weeklyLectures,
              durationMinutes: input.durationMinutes,
              status: 'ACTIVE',
              isCommon: true,
            })),
          },
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

    return ok(group);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();

    const { id } = await params;

    const existingGroup = await prisma.commonGroup.findUnique({
      where: { id },
      include: {
        allocations: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existingGroup) {
      return ok(
        { error: 'Common Group not found.' },
        404,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.timetableEntry.deleteMany({
        where: {
          allocationId: {
            in: existingGroup.allocations.map(
              (allocation) => allocation.id,
            ),
          },
        },
      });

      await tx.subjectAllocation.deleteMany({
        where: {
          commonGroupId: id,
        },
      });

      await tx.commonGroup.delete({
        where: {
          id,
        },
      });
    });

    return ok({
      success: true,
      message: 'Common Group deleted successfully.',
    });
  } catch (error) {
    return handleError(error);
  }
}